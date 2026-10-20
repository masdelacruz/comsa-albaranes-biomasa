import { useNavigate } from 'react-router-dom'
import { Plus, CalendarClock, Truck, PenLine, Droplets, CheckCircle2, ChevronRight, ArrowRight, List } from 'lucide-react'
import { prepararVista } from '../hooks/useEstadoSesion'
import { isoWeek, isoWeekYear } from '../utils/semana'
import '../components/shared.css'
import './Dashboard.css'

// Resumen del día: dónde está cada albarán del proceso y qué espera a la
// oficina. El listado completo vive en Albaranes y las gráficas en
// Estadísticas; aquí solo lo accionable.

const MAX_FILAS = 5

const saludo = () => {
  const h = new Date().getHours()
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

const hace = (fecha) => {
  if (!fecha) return ''
  const dias = Math.floor((Date.now() - new Date(fecha.slice(0, 10)).getTime()) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

// Por qué un albarán necesita a la oficina (orden = prioridad)
const motivoAtencion = (a) => {
  if (a.solicitaRevision)               return 'Revisión solicitada desde campo'
  if (a.estado === 'pendiente_oficina') return 'Falta la firma de oficina'
  if (a.estado === 'humedad_pendiente') return 'Falta el análisis de humedad'
  return null
}
const motivoEnCurso = (a) => a.estado === 'programado' ? 'Programado, sin enviar a campo' : 'En campo, esperando firmas'

export default function Dashboard({ albaranes, usuario }) {
  const navigate = useNavigate()

  const hoy = new Date()
  const semana = isoWeek(hoy), anio = isoWeekYear(hoy)
  const esEstaSemana = (f) => { if (!f) return false; const d = new Date(f); return isoWeek(d) === semana && isoWeekYear(d) === anio }

  const deEstado = (e) => albaranes.filter(a => a.estado === e)
  const programados  = deEstado('programado')
  const enCampo      = deEstado('pendiente_campo')
  const oficina      = deEstado('pendiente_oficina')
  const humedad      = deEstado('humedad_pendiente')
  const cerradosSem  = deEstado('cerrado').filter(a => esEstaSemana(a.fecha))

  const porAntiguedad = (x, y) => (x.fecha || '').localeCompare(y.fecha || '')
  const atencion = albaranes.filter(a => motivoAtencion(a) && a.estado !== 'cerrado').sort(porAntiguedad)
  const enCurso  = [...programados, ...enCampo].sort(porAntiguedad)

  // Abre Albaranes con la vista ya filtrada (sustituye los filtros que hubiera)
  const abrirListado = (valores) => { prepararVista('historial', valores); navigate('/albaranes') }

  // Las fases del proceso, en orden: el albarán avanza de izquierda a derecha
  const fases = [
    { key: 'prog', label: 'Programados',       valor: programados.length, Icon: CalendarClock, vista: { vista: 'activos', filtroEstado: ['programado'] } },
    { key: 'camp', label: 'En campo',          valor: enCampo.length,     Icon: Truck,         vista: { vista: 'activos', filtroEstado: ['pendiente_campo'] } },
    { key: 'ofi',  label: 'Firma de oficina',  valor: oficina.length,     Icon: PenLine,       vista: { vista: 'activos', filtroEstado: ['pendiente_oficina'] }, aviso: true },
    { key: 'hum',  label: 'Humedad pendiente', valor: humedad.length,     Icon: Droplets,      vista: { vista: 'activos', filtroEstado: ['humedad_pendiente'] }, aviso: true },
    { key: 'fin',  label: 'Cerrados',          sub: 'esta semana', valor: cerradosSem.length, Icon: CheckCircle2, vista: { vista: 'cerrados' }, fin: true },
  ]

  const nombre = usuario?.nombre?.split(' ')[0]
  const fechaLarga = hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="dash-hero">
          <div>
            <div className="dash-hero-fecha">{fechaLarga} · Semana {semana}</div>
            <h1 className="dash-hero-saludo">{saludo()}{nombre ? `, ${nombre}` : ''}</h1>
            <p className="dash-hero-resumen">
              {atencion.length === 0
                ? <>Todo al día: ningún albarán espera a la oficina.</>
                : <><strong>{atencion.length} {atencion.length === 1 ? 'albarán necesita' : 'albaranes necesitan'}</strong> tu atención</>}
              {enCurso.length > 0 && <> · {enCurso.length} en curso</>}
            </p>
          </div>
          <div className="dash-hero-acciones">
            <button className="btn" onClick={() => abrirListado({ vista: 'activos' })}>
              <List size={15} /> Ver albaranes
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/nuevo')}>
              <Plus size={16} /> Nuevo albarán
            </button>
          </div>
        </div>
      </div>

      <div className="dash-content">
        {/* Proceso: una sola tira con las fases encadenadas */}
        <nav className="dash-proceso" aria-label="Albaranes por fase">
          {fases.map(({ key, label, sub, valor, Icon, vista, aviso, fin }) => (
            <button key={key} type="button" onClick={() => abrirListado(vista)}
              className={`dash-fase${valor === 0 ? ' cero' : ''}${aviso && valor > 0 ? ' aviso' : ''}${fin ? ' fin' : ''}`}
              title={`Ver en Albaranes`}>
              <span className="dash-fase-cab"><Icon size={15} strokeWidth={1.8} /> {label}</span>
              <span className="dash-fase-num">{valor}</span>
              <span className="dash-fase-sub">{sub || (valor === 1 ? 'albarán' : 'albaranes')}</span>
            </button>
          ))}
        </nav>

        {/* Bandeja: lo que espera a la oficina y lo que está en marcha */}
        <section className="dash-bandeja">
          <Grupo
            titulo="Requieren tu atención" items={atencion} motivo={motivoAtencion} aviso
            vacio="Nada pendiente para la oficina. Todo al día."
            onAbrir={a => navigate(`/albaran/${a.id}`)}
            onVerTodos={() => abrirListado({ vista: 'activos', filtroEstado: ['pendiente_oficina', 'humedad_pendiente'] })}
          />
          <Grupo
            titulo="En curso" items={enCurso} motivo={motivoEnCurso}
            vacio="No hay albaranes programados ni en campo."
            onAbrir={a => navigate(`/albaran/${a.id}`)}
            onVerTodos={() => abrirListado({ vista: 'activos', filtroEstado: ['programado', 'pendiente_campo'] })}
          />
        </section>
      </div>
    </div>
  )
}

function Grupo({ titulo, items, motivo, aviso, vacio, onAbrir, onVerTodos }) {
  return (
    <div className="dash-grupo">
      <header className="dash-grupo-head">
        <h2 className="dash-grupo-titulo">
          {aviso && items.length > 0 && <span className="dash-grupo-punto" aria-hidden="true" />}
          {titulo} <span className="dash-grupo-num">{items.length}</span>
        </h2>
        {items.length > MAX_FILAS && (
          <button className="dash-grupo-ver" onClick={onVerTodos}>Ver los {items.length} <ArrowRight size={13} /></button>
        )}
      </header>
      {items.length === 0 ? (
        <div className="dash-grupo-vacio"><CheckCircle2 size={16} /> {vacio}</div>
      ) : (
        <ul className="dash-filas">
          {items.slice(0, MAX_FILAS).map(a => (
            <li key={a.id}>
              <button className="dash-fila" onClick={() => onAbrir(a)}>
                <span className="dash-fila-id">{a.id}</span>
                <span className="dash-fila-empresa">{a.proveedor || '—'}</span>
                <span className="dash-fila-inst">{a.instalacion || ''}</span>
                <span className={`dash-fila-motivo${aviso ? ' aviso' : ''}`}>{motivo(a)}</span>
                <span className="dash-fila-fecha">{hace(a.fecha)}</span>
                <ChevronRight size={14} className="dash-fila-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

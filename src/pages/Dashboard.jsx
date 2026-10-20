import { useNavigate } from 'react-router-dom'
import { Plus, CalendarClock, Truck, PenLine, Droplets, CheckCircle2, ChevronRight, ArrowRight, List } from 'lucide-react'
import { prepararVista } from '../hooks/useEstadoSesion'
import { isoWeek, isoWeekYear } from '../utils/semana'
import '../components/shared.css'
import './Dashboard.css'

// Resumen del día: qué hay que hacer y qué está en marcha. El listado completo
// vive en Albaranes y las gráficas en Estadísticas; aquí solo lo accionable.

const MAX_FILAS = 6

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

  const kpis = [
    { key: 'prog', label: 'Programados',          valor: programados.length, Icon: CalendarClock, tono: 'blue',  vista: { vista: 'activos', filtroEstado: ['programado'] } },
    { key: 'camp', label: 'En campo',             valor: enCampo.length,     Icon: Truck,         tono: 'gray',  vista: { vista: 'activos', filtroEstado: ['pendiente_campo'] } },
    { key: 'ofi',  label: 'Pendientes de oficina', valor: oficina.length,     Icon: PenLine,       tono: 'amber', vista: { vista: 'activos', filtroEstado: ['pendiente_oficina'] } },
    { key: 'hum',  label: 'Humedad pendiente',    valor: humedad.length,     Icon: Droplets,      tono: 'red',   vista: { vista: 'activos', filtroEstado: ['humedad_pendiente'] } },
    { key: 'fin',  label: 'Finalizados esta semana', valor: cerradosSem.length, Icon: CheckCircle2, tono: 'green', vista: { vista: 'cerrados' } },
  ]

  const nombre = usuario?.nombre?.split(' ')[0]
  const fechaLarga = hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="dashboard">
      <div className="page-header">
        <div className="dash-hero">
          <div className="dash-hero-texto">
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
        <div className="stat-grid">
          {kpis.map(({ key, label, valor, Icon, tono, vista }) => (
            <button key={key} type="button" className={`stat-card stat-${tono} stat-clickable dash-kpi`}
              onClick={() => abrirListado(vista)} title={`Ver ${label.toLowerCase()} en Albaranes`}>
              <div className="stat-top">
                <span className="stat-label">{label}</span>
                <span className="stat-icon"><Icon size={26} strokeWidth={1.6} /></span>
              </div>
              <div className="stat-val">{valor}</div>
            </button>
          ))}
        </div>

        <div className="dash-colas">
          <Cola
            titulo="Requieren tu atención"
            sub="Lo más antiguo primero"
            vacio="Nada pendiente para la oficina"
            items={atencion}
            motivo={motivoAtencion}
            tonoMotivo="aviso"
            onAbrir={a => navigate(`/albaran/${a.id}`)}
            onVerTodos={() => abrirListado({ vista: 'activos', filtroEstado: ['pendiente_oficina', 'humedad_pendiente'] })}
          />
          <Cola
            titulo="En curso"
            sub="Programados y en campo"
            vacio="No hay albaranes en curso"
            items={enCurso}
            motivo={motivoEnCurso}
            onAbrir={a => navigate(`/albaran/${a.id}`)}
            onVerTodos={() => abrirListado({ vista: 'activos', filtroEstado: ['programado', 'pendiente_campo'] })}
          />
        </div>
      </div>
    </div>
  )
}

function Cola({ titulo, sub, vacio, items, motivo, tonoMotivo, onAbrir, onVerTodos }) {
  return (
    <section className="dash-cola">
      <header className="dash-cola-head">
        <div>
          <h2 className="dash-cola-titulo">{titulo} <span className="dash-cola-num">{items.length}</span></h2>
          <div className="dash-cola-sub">{sub}</div>
        </div>
        {items.length > 0 && (
          <button className="dash-cola-ver" onClick={onVerTodos}>Ver en Albaranes <ArrowRight size={13} /></button>
        )}
      </header>
      {items.length === 0 ? (
        <div className="dash-cola-vacio"><CheckCircle2 size={22} /> {vacio}</div>
      ) : (
        <ul className="dash-cola-lista">
          {items.slice(0, MAX_FILAS).map(a => (
            <li key={a.id}>
              <button className="dash-cola-fila" onClick={() => onAbrir(a)}>
                <span className="dash-cola-id">{a.id}</span>
                <span className="dash-cola-info">
                  <span className="dash-cola-empresa">{a.proveedor || a.instalacion || '—'}</span>
                  <span className={`dash-cola-motivo${tonoMotivo ? ` ${tonoMotivo}` : ''}`}>{motivo(a)}</span>
                </span>
                <span className="dash-cola-fecha">{hace(a.fecha)}</span>
                <ChevronRight size={14} className="dash-cola-chevron" />
              </button>
            </li>
          ))}
          {items.length > MAX_FILAS && (
            <li><button className="dash-cola-mas" onClick={onVerTodos}>y {items.length - MAX_FILAS} más</button></li>
          )}
        </ul>
      )}
    </section>
  )
}

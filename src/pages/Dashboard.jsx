import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Plus, CalendarClock, Truck, PenLine, Droplets, CheckCircle2, List, Users, Mail, Check } from 'lucide-react'
import { prepararVista } from '../hooks/useEstadoSesion'
import { isoWeek, isoWeekYear } from '../utils/semana'
import { api } from '../lib/api'
import { contactosEmpresa } from '../utils/clientes'
import { pasoPendiente, pendientesPorCliente, mensajeCliente, asuntoCliente, textoNotificado, ROL_CLIENTE } from '../utils/pasos'
import CompartirWhatsApp, { WaIcon } from '../components/CompartirWhatsApp'
import '../components/shared.css'
import './Dashboard.css'

// Resumen del día: dónde está cada albarán del proceso y qué espera a la
// oficina. El listado completo vive en Albaranes y las gráficas en
// Estadísticas; aquí solo lo accionable.

const MAX_TARJETAS = 4

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

const necesitaOficina = (a) => a.estado !== 'cerrado' && (a.solicitaRevision || a.estado === 'pendiente_oficina' || a.estado === 'humedad_pendiente')

export default function Dashboard({ albaranes, empresas = [], usuario, refetch, onEmpresaActualizada }) {
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

  const sinNotificar = enCampo.filter(a => { const p = pasoPendiente(a); return p && !p.notificado }).length

  const porAntiguedad = (x, y) => (x.fecha || '').localeCompare(y.fecha || '')
  const atencion = albaranes.filter(necesitaOficina)
  const enCurso  = [...programados, ...enCampo]

  // Abre Albaranes con la vista ya filtrada (sustituye los filtros que hubiera)
  const abrirListado = (valores) => { prepararVista('historial', valores); navigate('/albaranes') }

  // Las fases del proceso, en orden: el albarán avanza de izquierda a derecha
  const fases = [
    { key: 'prog', label: 'Programados',       items: programados.sort(porAntiguedad), valor: programados.length, Icon: CalendarClock, vista: { vista: 'activos', filtroEstado: ['programado'] } },
    { key: 'camp', label: 'En campo',          sub: sinNotificar > 0 ? `${sinNotificar} sin notificar` : null, items: enCampo.sort(porAntiguedad), valor: enCampo.length,     Icon: Truck,         vista: { vista: 'activos', filtroEstado: ['pendiente_campo'] } },
    { key: 'ofi',  label: 'Firma de oficina',  items: oficina.sort(porAntiguedad), valor: oficina.length,     Icon: PenLine,       vista: { vista: 'activos', filtroEstado: ['pendiente_oficina'] }, aviso: true },
    { key: 'hum',  label: 'Humedad pendiente', items: humedad.sort(porAntiguedad), valor: humedad.length,     Icon: Droplets,      vista: { vista: 'activos', filtroEstado: ['humedad_pendiente'] }, aviso: true },
    { key: 'fin',  label: 'Cerrados',          sub: 'esta semana', items: cerradosSem.sort((x, y) => porAntiguedad(y, x)), valor: cerradosSem.length, Icon: CheckCircle2, vista: { vista: 'cerrados' }, fin: true },
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
        {/* Proceso + tablero en una sola tarjeta: cada columna bajo su fase */}
        <div className="dash-panel">
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

        {/* Tablero: bajo cada fase, sus albaranes (lo más antiguo arriba) */}
        <div className="dash-tablero">
          {fases.map(fase => (
            <Columna key={fase.key} fase={fase}
              onAbrir={a => navigate(`/albaran/${a.id}`)}
              onVerTodos={() => abrirListado(fase.vista)} />
          ))}
        </div>
        </div>

        <PendientesPorCliente albaranes={albaranes} empresas={empresas} refetch={refetch} onEmpresaActualizada={onEmpresaActualizada}
          onAbrir={a => navigate(`/albaran/${a.id}`)} />
      </div>
    </div>
  )
}

function Columna({ fase, onAbrir, onVerTodos }) {
  const { items } = fase
  if (items.length === 0) return <div className="dash-col vacia"><span className="dash-col-vacio">Sin albaranes</span></div>
  return (
    <div className="dash-col">
      {items.slice(0, MAX_TARJETAS).map(a => (
        <button key={a.id} className="dash-tarjeta" onClick={() => onAbrir(a)}>
          <span className="dash-tarjeta-cab">
            <span className="dash-tarjeta-id">{a.id}</span>
            <span className="dash-tarjeta-fecha">{hace(a.fecha)}</span>
          </span>
          <span className="dash-tarjeta-empresa">{a.proveedor || '—'}</span>
          <span className="dash-tarjeta-inst">{a.instalacion || ''}</span>
          {a.solicitaRevision && <span className="dash-tarjeta-aviso">Revisión solicitada</span>}
          {pasoPendiente(a)?.notificado && <span className="dash-tarjeta-notif"><Check size={11} /> Notificado</span>}
        </button>
      ))}
      {items.length > MAX_TARJETAS && (
        <button className="dash-col-mas" onClick={onVerTodos}>+{items.length - MAX_TARJETAS} más</button>
      )}
    </div>
  )
}

// Clientes con albaranes en campo esperando su gestión: un aviso por cliente
// con todo lo que tiene pendiente y el enlace a su panel. Al avisar, esos
// albaranes quedan marcados como "Notificado" (solo informativo).
function PendientesPorCliente({ albaranes, empresas, refetch, onEmpresaActualizada, onAbrir }) {
  const [waModal, setWaModal] = useState(null)
  const [marcando, setMarcando] = useState(null)
  const grupos = pendientesPorCliente(albaranes)
  if (!grupos.length) return null

  const filaEmpresa = g => empresas.find(e => e.nombre === g.nombre && e.tipo === g.rol) || empresas.find(e => e.nombre === g.nombre)
  const sinNotificar = grupos.reduce((n, g) => n + g.sinNotificar.length, 0)

  const marcar = async (g, medio) => {
    setMarcando(g.clave)
    try {
      await api.post('/albaranes/notificar', { ids: g.albaranes.map(a => a.id), medio })
      await refetch?.()
    } catch { /* la marca es informativa: si falla, el aviso ya se ha enviado */ }
    setMarcando(null)
  }

  const whatsapp = g => setWaModal({
    titulo: `${g.albaranes.length} pendiente${g.albaranes.length === 1 ? '' : 's'} · ${ROL_CLIENTE[g.rol]}`,
    empresa: filaEmpresa(g), nombreEmpresa: g.nombre,
    mensaje: nombre => mensajeCliente({ rol: g.rol, nombre, albaranes: g.albaranes, panelUrl: g.panelUrl }),
    onEnviado: () => marcar(g, 'whatsapp'),
  })

  const email = g => {
    const emp = filaEmpresa(g)
    const nombre = (contactosEmpresa(emp)[0]?.nombre || '').trim().split(/\s+/)[0]
    const body = mensajeCliente({ rol: g.rol, nombre, albaranes: g.albaranes, panelUrl: g.panelUrl, fmt: 'email' })
    window.open(`mailto:${emp?.email || ''}?subject=${encodeURIComponent(asuntoCliente(g.rol, g.albaranes.length))}&body=${encodeURIComponent(body)}`, '_blank')
    marcar(g, 'email')
  }

  return (
    <section className="dash-panel dash-clientes" aria-label="Pendientes por cliente">
      <div className="dash-sec-cab">
        <span className="dash-sec-titulo"><Users size={15} strokeWidth={1.8} /> Pendientes por cliente</span>
        <span className="dash-sec-sub">
          {grupos.length} {grupos.length === 1 ? 'cliente' : 'clientes'}
          {sinNotificar > 0 && <> · <span className="sin">{sinNotificar} sin notificar</span></>}
        </span>
      </div>
      {grupos.map(g => {
        const emp = filaEmpresa(g)
        const todos = g.sinNotificar.length === 0
        return (
          <div key={g.clave} className="dash-cli">
            <div className="dash-cli-info">
              <div className="dash-cli-nombre">{g.nombre} <span className="dash-cli-rol">{ROL_CLIENTE[g.rol]}</span></div>
              <div className="dash-cli-meta">
                {g.albaranes.length} {g.albaranes.length === 1 ? 'albarán' : 'albaranes'}
                {' · '}
                {todos
                  ? <span className="ok"><Check size={11} /> {textoNotificado(g.ultimoAviso)}</span>
                  : <span className="sin">{g.sinNotificar.length === g.albaranes.length ? 'Sin notificar' : `${g.sinNotificar.length} sin notificar`}</span>}
              </div>
              <div className="dash-cli-ids">
                {g.albaranes.map(a => (
                  <button key={a.id} type="button" onClick={() => onAbrir(a)} className={a.paso.notificado ? '' : 'sin'}
                    title={a.paso.notificado ? textoNotificado(a.paso.notificado, { conQuien: true }) : 'Sin notificar'}>{a.id}</button>
                ))}
              </div>
            </div>
            <div className="dash-cli-acc">
              <button type="button" className="btn dash-cli-wa" onClick={() => whatsapp(g)} disabled={marcando === g.clave}>
                <WaIcon size={13} /> WhatsApp
              </button>
              <button type="button" className="btn" onClick={() => email(g)} disabled={!emp?.email || marcando === g.clave}
                title={emp?.email ? `Email a ${emp.email}` : 'Sin email registrado'}>
                <Mail size={13} /> Email
              </button>
              {!todos && (
                <button type="button" className="btn dash-cli-marcar" onClick={() => marcar(g, 'manual')} disabled={marcando === g.clave}
                  title="Dejar constancia de que ya se le ha avisado (p. ej. por teléfono)">
                  <Check size={13} /> Marcar notificado
                </button>
              )}
            </div>
          </div>
        )
      })}
      {waModal && (
        <CompartirWhatsApp {...waModal} onClose={() => setWaModal(null)} onContactoGuardado={onEmpresaActualizada} />
      )}
    </section>
  )
}

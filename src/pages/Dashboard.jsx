import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Plus, CalendarClock, Truck, PenLine, Droplets, CheckCircle2, List, Users, Check, ChevronRight, Send } from 'lucide-react'
import { prepararVista } from '../hooks/useEstadoSesion'
import { isoWeek, isoWeekYear } from '../utils/semana'
import { api } from '../lib/api'
import { pendientesPorCliente, seguimientoPorCliente, etiquetaDia, pasoPendiente, mensajeCliente, asuntoCliente, textoCompartido, ROL_CLIENTE } from '../utils/pasos'
import EnviarMensaje from '../components/EnviarMensaje'
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
  const [tableroAbierto, setTableroAbierto] = useState(false)

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
  const atencion = albaranes.filter(necesitaOficina)
  const enCurso  = [...programados, ...enCampo]

  // Abre Albaranes con la vista ya filtrada (sustituye los filtros que hubiera)
  const abrirListado = (valores) => { prepararVista('historial', valores); navigate('/albaranes') }

  // Las fases del proceso, en orden: el albarán avanza de izquierda a derecha
  const fases = [
    { key: 'prog', label: 'Programados',       items: programados.sort(porAntiguedad), valor: programados.length, Icon: CalendarClock, vista: { vista: 'activos', filtroEstado: ['programado'] } },
    { key: 'camp', label: 'En campo',          items: enCampo.sort(porAntiguedad), valor: enCampo.length,     Icon: Truck,         vista: { vista: 'activos', filtroEstado: ['pendiente_campo'] } },
    { key: 'ofi',  label: 'Firma de oficina',  items: oficina.sort(porAntiguedad), valor: oficina.length,     Icon: PenLine,       vista: { vista: 'activos', filtroEstado: ['pendiente_oficina'] }, aviso: true },
    { key: 'hum',  label: 'Humedad pendiente', items: humedad.sort(porAntiguedad), valor: humedad.length,     Icon: Droplets,      vista: { vista: 'activos', filtroEstado: ['humedad_pendiente'] }, aviso: true },
    { key: 'fin',  label: 'Cerrados',          sub: 'esta semana', items: cerradosSem.sort((x, y) => porAntiguedad(y, x)), valor: cerradosSem.length, Icon: CheckCircle2, vista: { vista: 'cerrados' }, fin: true },
  ]

  const faseMasLarga = fases.reduce((m, f) => f.items.length > m.items.length ? f : m, fases[0]).key

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
            <Columna key={fase.key} fase={fase} abierto={tableroAbierto} onAlternar={() => setTableroAbierto(v => !v)}
              esLaMasLarga={fase.key === faseMasLarga}
              onAbrir={a => navigate(`/albaran/${a.id}`)} />
          ))}
        </div>
        </div>

        <PendientesPorCliente albaranes={albaranes} empresas={empresas} refetch={refetch} onEmpresaActualizada={onEmpresaActualizada}
          onAbrir={a => navigate(`/albaran/${a.id}`)} />
      </div>
    </div>
  )
}

// "+N más" despliega todo el tablero en el sitio (para ir al listado completo
// de una fase está su cabecera en la tira de arriba). Desplegado, el "Ver
// menos" va solo al pie de la columna más larga.
function Columna({ fase, abierto, onAlternar, esLaMasLarga, onAbrir }) {
  const { items } = fase
  if (items.length === 0) return <div className="dash-col vacia"><span className="dash-col-vacio">Sin albaranes</span></div>
  return (
    <div className="dash-col">
      {(abierto ? items : items.slice(0, MAX_TARJETAS)).map(a => (
        <button key={a.id} className="dash-tarjeta" onClick={() => onAbrir(a)}>
          <span className="dash-tarjeta-cab">
            <span className="dash-tarjeta-id">{a.id}</span>
            <span className="dash-tarjeta-fecha">{hace(a.fecha)}</span>
          </span>
          <span className="dash-tarjeta-empresa">{a.proveedor || '—'}</span>
          <span className="dash-tarjeta-inst">{a.instalacion || ''}</span>
          {a.solicitaRevision && <span className="dash-tarjeta-aviso">Revisión solicitada</span>}
        </button>
      ))}
      {!abierto && items.length > MAX_TARJETAS && (
        <button className="dash-col-mas" onClick={onAlternar} aria-expanded={false}>+{items.length - MAX_TARJETAS} más</button>
      )}
      {abierto && esLaMasLarga && (
        <button className="dash-col-mas" onClick={onAlternar} aria-expanded={true}>Ver menos</button>
      )}
    </div>
  )
}

// Clientes con albaranes en campo esperando su gestión. El sistema ya les
// avisa solo (email y aviso en su panel) al enviar a campo; desde aquí se
// puede mandar un recordatorio con todo lo pendiente y el enlace a su panel
// (queda registrado en la actividad de cada albarán).
// Por cliente, una fila por día: "7 de 8 gestionados". Al abrir el día se ve
// cada albarán (gestionado cuándo y por quién, pendiente o no gestionado).
// Todo mensaje se puede ver y copiar antes de enviarlo.
function PendientesPorCliente({ albaranes, empresas, refetch, onEmpresaActualizada, onAbrir }) {
  const [envio, setEnvio] = useState(null)        // props de EnviarMensaje
  const [marcando, setMarcando] = useState(null)
  const [abiertos, setAbiertos] = useState(() => new Set())
  const grupos = pendientesPorCliente(albaranes)
  const seguimiento = seguimientoPorCliente(albaranes)
  if (!grupos.length) return null

  const filaEmpresa = g => empresas.find(e => e.nombre === g.nombre && e.tipo === g.rol) || empresas.find(e => e.nombre === g.nombre)
  const alternar = k => setAbiertos(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  const marcar = async (ids, clave, medio) => {
    setMarcando(clave)
    try {
      await api.post('/albaranes/notificar', { ids, medio })
      await refetch?.()
    } catch { /* la marca es informativa: si falla, el aviso ya se ha enviado */ }
    setMarcando(null)
  }

  // pendientes: albaranes a incluir en el mensaje (todos los del cliente o los de un día)
  const titulo = (g, pendientes, dia) =>
    `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'} · ${g.nombre}${dia ? ` · ${etiquetaDia(dia)}` : ''}`

  // Un único "Enviar mensaje": en el pop-up se elige vía, persona y se ve/edita el texto
  const enviar = (g, pendientes, dia) => setEnvio({
    titulo: titulo(g, pendientes, dia),
    empresa: filaEmpresa(g), nombreEmpresa: g.nombre,
    asunto: asuntoCliente(g.rol, pendientes.length),
    mensaje: (nombre, via) => mensajeCliente({ rol: g.rol, nombre, albaranes: pendientes, panelUrl: g.panelUrl, fmt: via === 'email' ? 'email' : 'wa' }),
    onEnviado: via => marcar(pendientes.map(a => a.id), g.clave, via),
  })

  return (
    <section className="dash-panel dash-clientes" aria-label="Pendientes por cliente">
      <div className="dash-sec-cab">
        <span className="dash-sec-titulo"><Users size={15} strokeWidth={1.8} /> Pendientes por cliente</span>
        <span className="dash-sec-sub">
          {grupos.length} {grupos.length === 1 ? 'cliente' : 'clientes'} · pulsa un día para ver el detalle
        </span>
      </div>
      {grupos.map(g => {
        const dias = seguimiento.get(g.clave) || []
        return (
          <div key={g.clave} className="dash-cli">
            <div className="dash-cli-top">
              <div className="dash-cli-info">
                <div className="dash-cli-nombre">{g.nombre} <span className="dash-cli-rol">{ROL_CLIENTE[g.rol]}</span></div>
                <div className="dash-cli-meta">
                  {g.albaranes.length} {g.albaranes.length === 1 ? 'pendiente' : 'pendientes'}
                  {g.ultimoAviso && <> · <span className="compartido"><Check size={11} /> {textoCompartido(g.ultimoAviso, { conQuien: true })}</span></>}
                </div>
              </div>
              <div className="dash-cli-acc">
                <button type="button" className="btn" onClick={() => enviar(g, g.albaranes)} disabled={marcando === g.clave}
                  title="Elegir WhatsApp o email, contacto y revisar el mensaje">
                  <Send size={13} /> Enviar mensaje
                </button>
              </div>
            </div>

            <div className="dash-dias">
              {dias.map(d => {
                const k = `${g.clave}|${d.dia}`
                const abierto = abiertos.has(k)
                const pendientesDia = d.items.filter(i => i.estado === 'pendiente').map(i => ({ ...i.a, paso: pasoPendiente(i.a) }))
                const completo = d.gestionados === d.total
                return (
                  <div key={d.dia} className={`dash-dia${abierto ? ' abierto' : ''}`}>
                    <button type="button" className="dash-dia-fila" onClick={() => alternar(k)} aria-expanded={abierto}>
                      <ChevronRight size={14} className="dash-dia-chevron" />
                      <span className="dash-dia-nombre">{etiquetaDia(d.dia)}</span>
                      <span className="dash-dia-barra" aria-hidden="true"><span style={{ width: `${(d.gestionados / d.total) * 100}%` }} /></span>
                      <span className={`dash-dia-cuenta${completo ? ' completo' : ''}`}>
                        <strong>{d.gestionados} de {d.total}</strong> gestionados
                        {d.pendientes > 0 && <span className="dash-dia-resto"> · {d.pendientes} {d.pendientes === 1 ? 'pendiente' : 'pendientes'}</span>}
                        {d.rechazados > 0 && <span className="dash-dia-resto"> · {d.rechazados} no {d.rechazados === 1 ? 'gestionado' : 'gestionados'}</span>}
                      </span>
                    </button>
                    {abierto && (
                      <div className="dash-dia-detalle">
                        {d.items.map(({ a, estado, firma }) => (
                          <div key={a.id} className="dash-dia-alb">
                            <button type="button" className="dash-dia-id" onClick={() => onAbrir(a)} title="Abrir albarán">{a.id}</button>
                            <span className="dash-dia-hora">{a.hora ? String(a.hora).slice(0, 5) : ''}</span>
                            <span className={`dash-dia-estado ${estado}`}>
                              {estado === 'gestionado' && <><Check size={11} /> Gestionado{firma.fecha ? ` · ${fechaFirma(firma.fecha)}` : ''}{firma.nombrePersona ? ` · ${firma.nombrePersona}` : ''}</>}
                              {estado === 'pendiente' && <>Pendiente{firma.notificado && <span className="compartido"> · {textoCompartido(firma.notificado)}</span>}</>}
                              {estado === 'rechazado' && <>No gestionado{a.motivoRechazoCampo ? ` · ${a.motivoRechazoCampo}` : ''}</>}
                            </span>
                          </div>
                        ))}
                        {pendientesDia.length > 0 && (
                          <div className="dash-dia-msg">
                            <button type="button" onClick={() => enviar(g, pendientesDia, d.dia)}><Send size={12} /> Enviar mensaje solo de este día</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {envio && <EnviarMensaje {...envio} onClose={() => setEnvio(null)} onContactoGuardado={onEmpresaActualizada} />}
    </section>
  )
}

// Firma "6/11/2026, 10:32:15" → "06/11 10:32"
function fechaFirma(f) {
  const [fecha, hora] = String(f).split(', ')
  const [d, m] = (fecha || '').split('/')
  if (!m) return String(f)
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}${hora ? ' ' + hora.slice(0, 5) : ''}`
}

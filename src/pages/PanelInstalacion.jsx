import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, ChevronRight, Leaf, RefreshCw, Clock } from 'lucide-react'
import NotificacionesBell from '../components/NotificacionesBell'
import PanelCompletados from '../components/PanelCompletados'
import { completadosFuera } from '../utils/panelCompletados'
import { useLogoEmpresa } from '../hooks/useLogoEmpresa'
import { rutaNombre, nombreDeRuta } from '../utils/clientes'
import './PanelInstalacion.css'

const fmtFecha = (f) => f ? String(f).slice(0,10).split('-').reverse().join('/') : null

const MESES_C   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_ABR  = ['L','M','X','J','V','S','D']
const DIAS_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtHoyHeader() {
  const d = new Date()
  const dia = DIAS_FULL[d.getDay()]
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1,3)} · ${d.getDate()} ${MESES_C[d.getMonth()]}`
}

function labelFechaSec(fechaISO) {
  if (!fechaISO || fechaISO === 'Sin fecha') return 'Sin fecha'
  const [y, m, d] = fechaISO.split('-').map(Number)
  const hoy = isoLocal(new Date())
  const man = isoLocal(new Date(new Date().setDate(new Date().getDate() + 1)))
  const aye = isoLocal(new Date(new Date().setDate(new Date().getDate() - 1)))
  const dow  = new Date(y, m-1, d).getDay()
  const base = `${DIAS_FULL[dow].slice(0,3)} ${d} ${MESES_C[m-1]}`
  if (fechaISO === hoy) return `Hoy · ${base}`
  if (fechaISO === man) return `Mañana · ${base}`
  if (fechaISO === aye) return `Ayer · ${base}`
  return base
}

function CalendarioSemana({ albaranes, diaSeleccionado, onDiaClick }) {
  const hoy    = new Date()
  const hoyStr = isoLocal(hoy)

  // Ventana móvil de 7 días empezando siempre en hoy (no la semana L-D fija)
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(hoy); d.setDate(hoy.getDate() + i)
    const key = isoLocal(d)
    return {
      key, dow: DIAS_ABR[(d.getDay() + 6) % 7], diaN: d.getDate(),
      countActivo: albaranes.filter(a => a.fecha === key && !a.planificado).length,
      countPlan:   albaranes.filter(a => a.fecha === key &&  a.planificado).length,
      esHoy: i === 0,
    }
  })

  // El primer día (hoy) agrega además los pendientes atrasados de días anteriores
  const atrasados = albaranes.filter(a => !a.planificado && a.fecha < hoyStr && !a.instalacionFirmada).length

  const maxTotal = Math.max(...dias.map((d, i) => d.countActivo + d.countPlan + (i === 0 ? atrasados : 0)), 1)

  const barStyleFor = (countActivo, countPlan, verdeIntenso) => {
    const activoH = countActivo > 0 ? Math.max(4, Math.round((countActivo / maxTotal) * 28)) : 0
    const planH   = countPlan   > 0 ? Math.max(3, Math.round((countPlan   / maxTotal) * 28)) : 0
    const totalH  = Math.min(Math.max(activoH + planH, 2), 28)
    const style = { height: `${totalH}px` }
    if (planH > 0 && activoH > 0)
      style.background = `linear-gradient(to top, var(--green-${verdeIntenso ? '500' : '400'}) ${activoH}px, var(--green-${verdeIntenso ? '200' : '100'}) ${activoH}px)`
    else if (planH > 0)
      style.background = verdeIntenso ? 'rgba(255,255,255,0.25)' : 'var(--green-100)'
    return style
  }

  return (
    <div className="pi-semana">
      {dias.map((d, i) => {
        const countActivo = d.countActivo + (i === 0 ? atrasados : 0)
        const empty       = countActivo === 0 && d.countPlan === 0
        const selected    = d.esHoy ? diaSeleccionado === 'hoy' : d.key === diaSeleccionado
        return (
          <div
            key={d.key}
            className={`pi-semana-dia${d.esHoy ? ' hoy' : ''}${selected ? ' seleccionado' : ''}`}
            onClick={() => onDiaClick?.(d.esHoy || selected ? 'hoy' : d.key)}
          >
            {d.esHoy ? (
              <>
                <span className="pi-semana-dow" style={{ visibility: 'hidden' }}>·</span>
                <span className="pi-semana-num pi-semana-num-hoy">HOY</span>
              </>
            ) : (
              <>
                <span className="pi-semana-dow">{d.dow}</span>
                <span className="pi-semana-num">{d.diaN}</span>
              </>
            )}
            <div className="pi-semana-bar-wrap">
              <div className="pi-semana-bar" style={barStyleFor(countActivo, d.countPlan, d.esHoy)} />
            </div>
            <span className={`pi-semana-count${empty ? ' vacio' : countActivo === 0 ? ' plan' : ''}`}>
              {countActivo > 0 ? countActivo : (d.countPlan > 0 ? `+${d.countPlan}` : '·')}
            </span>
            {d.esHoy && atrasados > 0 && (
              <span className="pi-semana-hoy-dot" title={`${atrasados} atrasado${atrasados !== 1 ? 's' : ''} de días anteriores`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Llegada estimada ────────────────────────────────────────────────────
// Salida de origen (firma de la astilladora o, si no hay, del proveedor) +
// duración del trayecto que calcula el servidor con los mapas.
function parseFirma(f) {
  const m = String(f || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})/)
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : null
}
const hhmm = d => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const duracion = m => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`

function llegadaDe(a) {
  const salida = parseFirma(a.salidaFecha)
  const llegada = salida && a.trayecto ? new Date(salida.getTime() + a.trayecto.minutos * 60000) : null
  return { salida, llegada }
}

function EstadoLlegada({ a, ahora }) {
  if (a.planificado) return <div className="pi-eta"><span className="pi-eta-sub">Planificado</span></div>
  if (a.instalacionFirmada) {
    const d = parseFirma(a.instalacionFecha)
    return (
      <div className="pi-eta recibido">
        <span className="pi-eta-et">Recibido</span>
        <span className="pi-eta-hora"><CheckCircle size={15} /> {d ? hhmm(d) : ''}</span>
      </div>
    )
  }
  const { salida, llegada } = llegadaDe(a)
  if (llegada) {
    const faltan = Math.round((llegada - ahora) / 60000)
    const progreso = Math.max(0, Math.min(1, (ahora - salida) / (llegada - salida)))
    return (
      <div className="pi-eta encamino" title={`Salió a las ${hhmm(salida)} · ${a.trayecto.distanciaKm} km`}>
        <span className="pi-eta-et">Llegada</span>
        <span className="pi-eta-hora"><span className="pi-eta-aprox">≈</span>{hhmm(llegada)}</span>
        <span className="pi-eta-sub">{faltan > 0 ? `en ${duracion(faltan)}` : faltan > -15 ? 'llegando' : `estimada hace ${duracion(-faltan)}`}</span>
        <span className="pi-eta-barra" aria-hidden="true"><span style={{ width: `${progreso * 100}%` }} /></span>
      </div>
    )
  }
  if (salida) {
    return (
      <div className="pi-eta encamino">
        <span className="pi-eta-et">En camino</span>
        <span className="pi-eta-hora">{hhmm(salida)}</span>
        <span className="pi-eta-sub">hora de salida</span>
      </div>
    )
  }
  return (
    <div className="pi-eta">
      <span className="pi-eta-et">Sin salir</span>
      {a.hora && <span className="pi-eta-hora tenue">{String(a.hora).slice(0, 5)}</span>}
      <span className="pi-eta-sub">{a.trayecto ? `trayecto ${duracion(a.trayecto.minutos)}` : a.hora ? 'programado' : ''}</span>
    </div>
  )
}

function InfoCamion({ a }) {
  const firmado    = a.instalacionFirmada
  const origen     = a.astilladora || a.proveedor
  const esAtrasado = !a.planificado && !firmado && a.fecha && a.fecha < isoLocal(new Date())
  const biomasa    = [a.especie, a.tipoBiomasa].filter(Boolean).join(' · ')
  const conductor  = [a.chofer, a.transportista].filter(Boolean).join(' · ')

  return (
    <div className="pi-camion-info">
      <div className="pi-camion-id">
        Albarán {a.id}
        {esAtrasado && <span className="pi-camion-atrasado-tag">Atrasado · {fmtFecha(a.fecha)}</span>}
      </div>
      {a.matriculaTractora ? (
        <div className="pi-camion-matricula">
          {a.matriculaTractora}
          {a.matriculaRemolque && <span> · {a.matriculaRemolque}</span>}
        </div>
      ) : <div className="pi-camion-matricula vacia">Camión sin confirmar</div>}
      <div className="pi-camion-meta principal">{[origen, a.origen].filter(Boolean).join(' · ')}</div>
      {conductor && <div className="pi-camion-meta">{conductor}</div>}
      {biomasa && <div className="pi-camion-meta pi-solo-ancho">{biomasa}</div>}
    </div>
  )
}

function TarjetaCamion({ a, esUltimo, esDesde, ahora }) {
  const navigate    = useNavigate()
  const firmado     = a.instalacionFirmada
  const planificado = a.planificado
  const enCamino    = !planificado && !!a.salidaFecha && !firmado
  const ref         = useRef(null)

  useEffect(() => {
    if (esDesde && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [esDesde])

  return (
    <div
      ref={ref}
      className={`pi-camion pi-camion--rec ${planificado ? 'planificado' : firmado ? 'firmado' : 'pendiente'}${enCamino ? ' encamino' : ''}${esDesde ? ' pi-desde-active' : ''}`}
      onClick={planificado ? undefined : () => navigate(`/campo/${a.id}/instalacion?t=${encodeURIComponent(a.campoToken || '')}`)}
      style={{ cursor: planificado ? 'default' : 'pointer', borderBottom: esUltimo ? 'none' : undefined }}
    >
      <EstadoLlegada a={a} ahora={ahora} />
      <div className="pi-camion-left">
        <InfoCamion a={a} />
      </div>
      <div className="pi-camion-right">
        {planificado
          ? <span className="pi-camion-plan-tag">Planificado</span>
          : firmado
          ? <span className="pi-btn-ver">Ver <ChevronRight size={14} /></span>
          : <div className="pi-btn-firmar">Firmar <ChevronRight size={14} /></div>
        }
      </div>
    </div>
  )
}

// Orden de salida, agrupado por quien envía (astilladora o proveedor): de
// un mismo origen, el que sale antes llega antes. Dentro de cada origen,
// primero lo que ya ha salido (por hora de salida), luego lo que aún no ha
// salido (por hora programada) y al final lo recibido.
const origenDe = a => a.astilladora || a.proveedor || 'Sin origen'
function ordenSalida(a, b) {
  const rango = x => x.instalacionFirmada ? 2 : x.salidaFecha ? 0 : 1
  const ra = rango(a), rb = rango(b)
  if (ra !== rb) return ra - rb
  if (ra === 0) return (parseFirma(a.salidaFecha) || 0) - (parseFirma(b.salidaFecha) || 0)
  if (ra === 1) return String(a.hora || '99').localeCompare(String(b.hora || '99')) || String(a.id).localeCompare(String(b.id))
  return (parseFirma(a.instalacionFecha) || 0) - (parseFirma(b.instalacionFecha) || 0)
}
// Orígenes: primero los que tienen camiones en camino (el que salió antes
// arriba), después los que aún no han enviado y al final los ya completados.
function gruposPorOrigen(activos) {
  const m = new Map()
  for (const a of activos) {
    const k = origenDe(a)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(a)
  }
  const grupos = [...m.entries()].map(([origen, items]) => {
    items.sort(ordenSalida)
    const salidas = items.filter(a => a.salidaFecha && !a.instalacionFirmada).map(a => parseFirma(a.salidaFecha) || 0)
    const pendientes = items.filter(a => !a.instalacionFirmada).length
    return { origen, items, primeraSalida: salidas.length ? Math.min(...salidas) : null, pendientes, enCamino: salidas.length }
  })
  const rango = g => g.primeraSalida != null ? 0 : g.pendientes ? 1 : 2
  return grupos.sort((x, y) => rango(x) - rango(y) || (x.primeraSalida || 0) - (y.primeraSalida || 0) || x.origen.localeCompare(y.origen, 'es'))
}

function GrupoDia({ titulo, albaranes, desdeId, ahora }) {
  const activos  = albaranes.filter(a => !a.planificado)
  const grupos   = gruposPorOrigen(activos)
  const planifs  = albaranes.filter(a => a.planificado)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || 0)
  const firmados = activos.filter(a => a.instalacionFirmada).length
  const enCamino = activos.filter(a => a.salidaFecha && !a.instalacionFirmada).length
  const total    = activos.length
  const pct      = total > 0 ? Math.round((firmados / total) * 100) : 0

  return (
    <div className="pi-flota">
      <div className="pi-flota-header">
        <div className="pi-flota-icon"><Clock size={15} color="var(--green-600)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pi-flota-title" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{titulo}</div>
          <div className="pi-flota-sub">
            {total} {total !== 1 ? 'albaranes' : 'albarán'}{enCamino ? ` · ${enCamino} en camino` : ''} · por orden de salida
            {planifs.length > 0 ? ` · ${planifs.length} planificado${planifs.length !== 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div className="pi-flota-badge">{firmados}/{total} recibidos</div>
      </div>
      <div className="pi-progress-bar">
        <div className="pi-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pi-camiones-list">
        {grupos.map(g => (
          <div key={g.origen} className="pi-origen">
            <div className="pi-origen-cab">
              <span className="pi-origen-nombre">{g.origen}</span>
              <span className="pi-origen-sub">
                {g.enCamino ? `${g.enCamino} en camino` : g.pendientes ? 'sin salir' : 'completado'}
                {g.pendientes - g.enCamino > 0 && g.enCamino ? ` · ${g.pendientes - g.enCamino} sin salir` : ''}
              </span>
            </div>
            {g.items.map(a => (
              <TarjetaCamion key={a.id} a={a} ahora={ahora} esUltimo={false} esDesde={String(a.id) === desdeId} />
            ))}
          </div>
        ))}
        {planifs.length > 0 && <div className="pi-planif-sep">Planificado</div>}
        {planifs.map((a, i) => (
          <TarjetaCamion key={a.id} a={a} ahora={ahora} esUltimo={i === planifs.length - 1} esDesde={false} />
        ))}
      </div>
    </div>
  )
}

const GREEN_DEFAULT = '#14532d'

export default function PanelInstalacion() {
  const { nombre }  = useParams()
  const location    = useLocation()
  const navigate    = useNavigate()
  const nombreInstalacion = nombreDeRuta(nombre)

  const [desdeId] = useState(() => new URLSearchParams(location.search).get('desde'))
  const [codigo]  = useState(() => new URLSearchParams(location.search).get('c') || '')
  useEffect(() => {
    if (desdeId) navigate(location.pathname + (codigo ? `?c=${encodeURIComponent(codigo)}` : ''), { replace: true })
  }, []) // eslint-disable-line

  const [albaranes,      setAlbaranes]     = useState([])
  const [loading,        setLoading]       = useState(true)
  const [codigoInvalido, setCodigoInvalido] = useState(false)
  const [lastUpdate,     setLastUpdate]    = useState(null)
  const [refreshing,     setRefreshing]    = useState(false)
  const [showOk,         setShowOk]        = useState(false)
  const [hayCambios,     setHayCambios]    = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState('hoy')
  const [ahora, setAhora] = useState(() => Date.now())
  const showOkTimer     = useRef(null)
  const hayCambiosTimer = useRef(null)
  const signaturaRef    = useRef(null)

  const { logoUrl, headerBgColor } = useLogoEmpresa(nombreInstalacion)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res  = await fetch(`/api/albaranes/instalacion/${rutaNombre(nombreInstalacion)}?c=${encodeURIComponent(codigo)}`)
      if (res.status === 401 || res.status === 403) { setCodigoInvalido(true); setLoading(false); if (manual) setRefreshing(false); return }
      const data = await res.json()
      const arr  = Array.isArray(data) ? data : []
      const sig  = arr.map(a => `${a.id}:${a.instalacionFirmada}:${a.estado}`).join('|')
      if (!manual && signaturaRef.current !== null && sig !== signaturaRef.current) {
        clearTimeout(hayCambiosTimer.current)
        setHayCambios(true)
        hayCambiosTimer.current = setTimeout(() => setHayCambios(false), 6000)
      }
      signaturaRef.current = sig
      setAlbaranes(arr)
      setLastUpdate(new Date())
      setAhora(Date.now())
      if (manual) {
        setHayCambios(false)
        clearTimeout(showOkTimer.current)
        setShowOk(true)
        showOkTimer.current = setTimeout(() => setShowOk(false), 2500)
      }
    } catch {}
    setLoading(false)
    if (manual) setRefreshing(false)
  }, [nombreInstalacion, codigo])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const hoyStr = isoLocal(new Date())

  // "Hoy" = todo lo trabajable: pendientes atrasados de días anteriores + todo lo de hoy
  const esTrabajableHoy = a =>
    a.fecha === hoyStr || (!a.planificado && a.fecha < hoyStr && !a.instalacionFirmada)

  const albaranesFiltrados = diaSeleccionado === 'hoy'
    ? albaranes.filter(esTrabajableHoy)
    : albaranes.filter(a => a.fecha === diaSeleccionado)

  // En "Hoy" todo lo trabajable va en una sola lista por orden de llegada
  // (lo atrasado de días anteriores también puede estar llegando); otro día,
  // la lista de ese día.
  const tituloDia = labelFechaSec(diaSeleccionado === 'hoy' ? hoyStr : diaSeleccionado)

  const completados = completadosFuera(albaranes, albaranesFiltrados, a => a.instalacionFirmada || a.cerrado)

  const activosFiltrados = albaranesFiltrados.filter(a => !a.planificado)
  const pendientes       = activosFiltrados.filter(a => !a.instalacionFirmada).length
  const enCaminoCount    = activosFiltrados.filter(a => a.salidaFecha && !a.instalacionFirmada).length
  const planificadosCount = albaranesFiltrados.filter(a => a.planificado).length
  const total            = activosFiltrados.length

  return (
    <div className="pi-page pi-page--desktop">
      <div className="pi-header" style={{ background: headerBgColor || GREEN_DEFAULT }}>
        <div className="pi-header-brand">
          {logoUrl
            ? <div className="pi-header-logo-img"><img src={logoUrl} alt="Logo" /></div>
            : <div className="pi-header-logo"><Leaf size={14} color="#fff" /></div>
          }
          <div className="pi-header-info">
            <div className="pi-header-title">Recepción</div>
            <div className="pi-header-sub">{nombreInstalacion}</div>
            <div className="pi-header-date">{fmtHoyHeader()}</div>
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {showOk && <span className="pi-refresh-ok">✓ Actualizado</span>}
          {hayCambios && !showOk && (
            <span style={{
              fontSize:11, fontWeight:600, color:'#92400e',
              background:'#fef3c7', border:'1px solid #fbbf24',
              borderRadius:5, padding:'3px 8px', display:'flex', alignItems:'center', gap:4,
            }}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#f59e0b',display:'inline-block'}} />
              Cambios
            </span>
          )}
          <NotificacionesBell tipo="instalacion" nombre={nombreInstalacion} codigo={codigo} />
          <button
            className={`pi-refresh${refreshing ? ' pi-refresh-spin' : ''}`}
            onClick={() => fetchData(true)}
            title="Actualizar"
            disabled={refreshing}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {codigoInvalido ? (
        <div className="pi-empty">
          <div className="pi-empty-title">Enlace no válido</div>
          <div className="pi-empty-sub">Falta el código de acceso o es incorrecto. Pide a oficina el enlace correcto de este panel.</div>
        </div>
      ) : loading ? (
        <div className="pi-spinner-wrap"><div className="pi-spinner" /></div>
      ) : albaranes.length === 0 ? (
        <div className="pi-empty">
          <CheckCircle size={40} color="var(--green-400)" />
          <div className="pi-empty-title">Todo al día</div>
          <div className="pi-empty-sub">No hay albaranes pendientes.</div>
          {lastUpdate && <div className="pi-last-update">{labelFechaSec(isoLocal(lastUpdate))} · {lastUpdate.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}</div>}
        </div>
      ) : (
        <div className="pi-body">
          <aside className="pi-sidebar">
            <div className="pi-resumen">
              <div className="pi-resumen-item">
                <span className="pi-resumen-num">{pendientes}</span>
                <span className="pi-resumen-label">pendiente{pendientes !== 1 ? 's' : ''}</span>
              </div>
              <div className="pi-resumen-sep" />
              <div className="pi-resumen-item">
                <span className="pi-resumen-num">{total - pendientes}</span>
                <span className="pi-resumen-label">completado{total - pendientes !== 1 ? 's' : ''}</span>
              </div>
              <div className="pi-resumen-sep" />
              <div className="pi-resumen-item">
                <span className="pi-resumen-num">{total}</span>
                <span className="pi-resumen-label">total</span>
              </div>
              {(enCaminoCount > 0 || planificadosCount > 0) && (
                <div className="pi-resumen-extra">
                  {enCaminoCount > 0 && <span className="pi-resumen-chip encamino">{enCaminoCount} en camino</span>}
                  {planificadosCount > 0 && <span className="pi-resumen-chip plan">+{planificadosCount} planif.</span>}
                </div>
              )}
            </div>
            <CalendarioSemana
              albaranes={albaranes}
              diaSeleccionado={diaSeleccionado}
              onDiaClick={setDiaSeleccionado}
            />
          </aside>

          <div className="pi-main">
            {diaSeleccionado !== 'hoy' && (
              <div className="pi-filtro-dia-banner">
                <span>{labelFechaSec(diaSeleccionado)}</span>
                <button onClick={() => setDiaSeleccionado('hoy')}>Hoy</button>
              </div>
            )}
            <div className="pi-section">
              {albaranesFiltrados.length === 0 ? (
                <div className="pi-empty-dia">
                  <div className="pi-empty-dia-title">{diaSeleccionado === 'hoy' ? 'Sin albaranes hoy' : 'Sin albaranes para este día'}</div>
                  {diaSeleccionado !== 'hoy' && (
                    <button className="pi-empty-dia-btn" onClick={() => setDiaSeleccionado('hoy')}>Volver a hoy</button>
                  )}
                </div>
              ) : (
                <GrupoDia titulo={tituloDia} albaranes={albaranesFiltrados} desdeId={desdeId} ahora={ahora} />
              )}
            </div>
            <PanelCompletados
              albaranes={completados}
              renderFila={(a, esUltimo) => <TarjetaCamion key={a.id} a={a} ahora={ahora} esUltimo={esUltimo} esDesde={false} />}
            />
            {lastUpdate && (
              <div className="pi-last-update-bar">
                {labelFechaSec(isoLocal(lastUpdate))} · {lastUpdate.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })} · Se actualiza automáticamente
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

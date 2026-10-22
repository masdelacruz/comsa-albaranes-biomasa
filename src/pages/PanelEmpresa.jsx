import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, ChevronRight, ChevronDown, Leaf, RefreshCw, MapPin, FileText, Upload } from 'lucide-react'
import NotificacionesBell from '../components/NotificacionesBell'
import PanelCompletados from '../components/PanelCompletados'
import { completadosFuera } from '../utils/panelCompletados'
import { useLogoEmpresa } from '../hooks/useLogoEmpresa'
import { rutaNombre, nombreDeRuta } from '../utils/clientes'
import './PanelInstalacion.css'

// Panel público de astilladoras y proveedores. Una empresa dada de alta con
// los dos tipos tiene un solo panel (sirve cualquiera de sus enlaces) con
// todos sus albaranes juntos; cada uno lleva lo que se le pide según el papel
// de la empresa en él:
//   - astilladora → firmar la carga (abre la vista de campo del albarán)
//   - proveedor   → (Opción 2, proveedor directo) adjuntar su albarán y
//                   completar el origen si oficina no lo indicó

const fmtFecha = (f) => f ? String(f).slice(0,10).split('-').reverse().join('/') : null

function fmtFirmaTs(ts) {
  if (!ts) return ''
  const [datePart, timePart] = String(ts).split(', ')
  if (!datePart) return ts
  const [d, m] = datePart.split('/')
  const time = timePart ? timePart.slice(0, 5) : ''
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')} · ${time}`
}

const MESES_C   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_ABR  = ['L','M','X','J','V','S','D']
const DIAS_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

const ROL_TITULO = { astilladora: 'Astilladora', proveedor: 'Proveedor' }
const COLOR_DEFECTO = { astilladora: '#78350f', proveedor: '#14532d' }

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

// Normaliza un albarán de cualquiera de los dos endpoints: `rol` dice qué
// tarea tiene la empresa en él y `completado` si ya la hizo.
function normalizar(a, rol) {
  if (rol === 'astilladora') {
    return { ...a, rol, clave: `${rol}-${a.id}`, completado: a.astilladoraFirmada || a.cerrado, completadoFecha: a.astilladoraFecha }
  }
  return { ...a, rol, clave: `${rol}-${a.id}`, completado: a.completado || a.cerrado }
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
  const atrasados = albaranes.filter(a => !a.planificado && a.fecha < hoyStr && !a.completado).length
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

// Origen + albarán del proveedor: lo único que se le pide.
function CompletarAlbaran({ a, nombre, codigo, onCambio }) {
  const [origen,    setOrigen]    = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendo,  setSubiendo]  = useState(false)
  const [error,     setError]     = useState('')
  const fileRef = useRef(null)

  const qs   = `?c=${encodeURIComponent(codigo)}`
  const base = rutaNombre(nombre)

  const guardarOrigen = async () => {
    if (!origen.trim()) return
    setGuardando(true); setError('')
    try {
      const res = await fetch(`/api/albaranes/proveedor/${base}/${a.id}/origen${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen: origen.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo guardar el origen')
      await onCambio()
    } catch (e) { setError(e.message) } finally { setGuardando(false) }
  }

  const subir = async (file) => {
    if (!file) return
    setSubiendo(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/storage/upload-proveedor/${base}/${a.id}${qs}`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo subir el fichero')
      await onCambio()
    } catch (e) { setError(e.message) } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const etiqueta = { fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }
  const input    = { flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 14, border: '1px solid var(--gray-200)', borderRadius: 5, background: '#fff' }
  const boton    = (activo) => ({ padding: '9px 14px', borderRadius: 5, border: 'none', fontSize: 13, fontWeight: 600, background: activo ? 'var(--green-400)' : 'var(--gray-200)', color: activo ? '#fff' : 'var(--gray-400)', cursor: activo ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 })

  return (
    <div style={{ padding: '4px 14px 14px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 14 }} onClick={e => e.stopPropagation()}>
      <div>
        <div style={etiqueta}>Origen</div>
        {a.origen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--gray-800)' }}>
            <CheckCircle size={16} color="var(--green-400)" /> {a.origen}
          </div>
        ) : a.cerrado ? (
          <div style={{ fontSize: 14, color: 'var(--gray-400)' }}>—</div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={origen} onChange={e => setOrigen(e.target.value)} placeholder="Paraje / término municipal"
              onKeyDown={e => { if (e.key === 'Enter') guardarOrigen() }} style={input} />
            <button onClick={guardarOrigen} disabled={!origen.trim() || guardando} style={boton(origen.trim() && !guardando)}>
              {guardando ? '…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      <div>
        <div style={etiqueta}>Albarán</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {a.albaranProveedor ? (
            <a href={a.albaranProveedor.url} target="_blank" rel="noreferrer"
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--gray-800)', textDecoration: 'none' }}>
              <CheckCircle size={16} color="var(--green-400)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline', textDecorationColor: 'var(--gray-300)' }}>
                {a.albaranProveedor.nombreFichero || 'Ver albarán'}
              </span>
            </a>
          ) : (
            <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gray-400)' }}>
              <FileText size={16} /> PDF o foto
            </span>
          )}
          {!a.cerrado && (
            <>
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                style={a.albaranProveedor ? { ...boton(!subiendo), background: '#fff', color: 'var(--gray-600)', border: '1px solid var(--gray-200)' } : boton(!subiendo)}>
                <Upload size={14} /> {subiendo ? 'Subiendo…' : a.albaranProveedor ? 'Cambiar' : 'Adjuntar'}
              </button>
              <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                onChange={e => subir(e.target.files?.[0])} />
            </>
          )}
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: 'var(--red-700)' }}>{error}</div>}
    </div>
  )
}

function InfoCamion({ a, conDestino, conRol }) {
  const especie    = [a.especie, a.estella].filter(Boolean).join(' · ')
  const fechaHora  = [fmtFecha(a.fecha), a.hora ? String(a.hora).slice(0,5) : null].filter(Boolean).join(' · ')
  const esAtrasado = !a.planificado && !a.completado && a.fecha && a.fecha < isoLocal(new Date())
  const falta = a.rol === 'proveedor'
    ? [!a.origen && 'origen', !a.albaranProveedor && 'albarán'].filter(Boolean).join(' y ')
    : ''

  return (
    <div>
      <div className="pi-camion-id">
        Albarán {a.id}
        {conRol && <span className="pi-camion-rol-tag">{ROL_TITULO[a.rol]}</span>}
        {esAtrasado && <span className="pi-camion-atrasado-tag">Atrasado</span>}
      </div>
      {conDestino && a.instalacion && <div className="pi-camion-matricula" style={{ fontFamily: 'inherit' }}>{a.instalacion}</div>}
      {a.transportista && <div className="pi-camion-matricula" style={{ fontFamily: 'inherit' }}>{a.transportista}</div>}
      {a.rol === 'astilladora' && a.matriculaTractora && (
        <div className="pi-camion-meta">
          {a.matriculaTractora}
          {a.matriculaRemolque && <span> · {a.matriculaRemolque}</span>}
        </div>
      )}
      {especie   && <div className="pi-camion-meta">{especie}</div>}
      {fechaHora && <div className="pi-camion-meta">{fechaHora}</div>}
      {a.rol === 'astilladora'
        ? (a.astilladoraFirmada && a.astilladoraFecha && <div className="pi-camion-meta verde">✓ Completado · {fmtFirmaTs(a.astilladoraFecha)}</div>)
        : a.cerrado
        ? <div className="pi-camion-meta verde">✓ Albarán cerrado</div>
        : a.completado
        ? <div className="pi-camion-meta verde">✓ Completado{a.completadoFecha ? ` · ${fmtFirmaTs(a.completadoFecha)}` : ''}</div>
        : !a.planificado && falta && <div className="pi-camion-meta">Falta {falta}</div>}
    </div>
  )
}

function TarjetaCamion({ a, esUltimo, esDesde, conDestino, conRol, abierto, onToggle, nombre, codigo, onCambio }) {
  const navigate    = useNavigate()
  const planificado = a.planificado
  const esProveedor = a.rol === 'proveedor'
  const ref         = useRef(null)

  useEffect(() => {
    if (esDesde && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [esDesde])

  const estadoClass = planificado ? 'planificado' : (a.completado ? 'firmado' : 'pendiente')
  const onClick = planificado ? undefined
    : esProveedor ? onToggle
    : () => navigate(`/campo/${a.id}/astilladora?t=${encodeURIComponent(a.campoToken || '')}`)

  return (
    <>
      <div
        ref={ref}
        className={`pi-camion ${estadoClass}${esDesde ? ' pi-desde-active' : ''}`}
        onClick={onClick}
        style={{ cursor: planificado ? 'default' : 'pointer', borderBottom: esUltimo && !abierto ? 'none' : undefined }}
      >
        <div className="pi-camion-left">
          <InfoCamion a={a} conDestino={conDestino} conRol={conRol} />
        </div>
        <div className="pi-camion-right">
          {planificado
            ? <span className="pi-camion-plan-tag">Planificado</span>
            : a.completado && !abierto
            ? <CheckCircle size={20} color="var(--green-400)" />
            : esProveedor
            ? <div className="pi-btn-firmar">{abierto ? <>Cerrar <ChevronDown size={14} /></> : <>Completar <ChevronRight size={14} /></>}</div>
            : <div className="pi-btn-firmar">Firmar <ChevronRight size={14} /></div>
          }
        </div>
      </div>
      {esProveedor && abierto && <CompletarAlbaran a={a} nombre={nombre} codigo={codigo} onCambio={onCambio} />}
    </>
  )
}

function GrupoInstalacion({ instalacion, albaranes, renderTarjeta }) {
  const activos    = albaranes.filter(a => !a.planificado)
  const planSorted = albaranes.filter(a => a.planificado)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || 0)
  const completos  = activos.filter(a => a.completado).length
  const total      = activos.length
  const pct        = total > 0 ? Math.round((completos / total) * 100) : 0

  // Pendientes primero; los completados por orden de completado (astilladora)
  // o de fecha (proveedor). Por fecha, lo más reciente arriba.
  const sorted = [...activos].sort((a, b) => {
    if (!a.completado && b.completado) return -1
    if (a.completado && !b.completado) return 1
    if (a.completado && b.completado && a.astilladoraFecha && b.astilladoraFecha)
      return new Date(a.astilladoraFecha) - new Date(b.astilladoraFecha)
    return (b.fecha || '').localeCompare(a.fecha || '')
  })

  return (
    <div className="pi-flota">
      <div className="pi-flota-header">
        <div className="pi-flota-icon"><MapPin size={15} color="var(--green-600)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pi-flota-title" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{instalacion}</div>
          <div className="pi-flota-sub">{total} {total !== 1 ? 'albaranes' : 'albarán'}{planSorted.length > 0 ? ` · ${planSorted.length} planificado${planSorted.length !== 1 ? 's' : ''}` : ''}</div>
        </div>
        <div className="pi-flota-badge">{completos}/{total}</div>
      </div>
      <div className="pi-progress-bar">
        <div className="pi-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pi-camiones-list">
        {sorted.map((a, i) => renderTarjeta(a, i === sorted.length - 1 && planSorted.length === 0))}
        {planSorted.length > 0 && <div className="pi-planif-sep">Planificado</div>}
        {planSorted.map((a, i) => renderTarjeta(a, i === planSorted.length - 1))}
      </div>
    </div>
  )
}

export default function PanelEmpresa({ tipo }) {
  const { nombre }  = useParams()
  const location    = useLocation()
  const navigate    = useNavigate()
  const nombreEmpresa = nombreDeRuta(nombre)

  const [desdeId] = useState(() => new URLSearchParams(location.search).get('desde'))
  const [codigo]  = useState(() => new URLSearchParams(location.search).get('c') || '')
  useEffect(() => {
    if (desdeId) navigate(location.pathname + (codigo ? `?c=${encodeURIComponent(codigo)}` : ''), { replace: true })
  }, []) // eslint-disable-line

  const [roles,           setRoles]          = useState([tipo])
  const [albaranes,       setAlbaranes]      = useState([])
  const [loading,         setLoading]        = useState(true)
  const [codigoInvalido,  setCodigoInvalido] = useState(false)
  const [lastUpdate,      setLastUpdate]     = useState(null)
  const [refreshing,      setRefreshing]     = useState(false)
  const [showOk,          setShowOk]         = useState(false)
  const [hayCambios,      setHayCambios]     = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState('hoy')
  const [abiertoClave,    setAbiertoClave]   = useState(null)
  const showOkTimer     = useRef(null)
  const hayCambiosTimer = useRef(null)
  const signaturaRef    = useRef(null)
  const rolesRef        = useRef(null)

  const { logoUrl, headerBgColor } = useLogoEmpresa(nombreEmpresa)
  const qs = `?c=${encodeURIComponent(codigo)}`

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      // Qué papeles tiene la empresa: se consulta una vez y se reutiliza
      if (!rolesRef.current) {
        const res = await fetch(`/api/albaranes/panel-roles/${rutaNombre(nombreEmpresa)}${qs}`)
        if (res.status === 401 || res.status === 403 || res.status === 404) { setCodigoInvalido(true); return }
        const data = await res.json()
        rolesRef.current = Array.isArray(data) && data.length ? data : [tipo]
        setRoles(rolesRef.current)
      }
      const listas = await Promise.all(rolesRef.current.map(async rol => {
        const res = await fetch(`/api/albaranes/${rol}/${rutaNombre(nombreEmpresa)}${qs}`)
        if (res.status === 401 || res.status === 403) throw Object.assign(new Error('codigo'), { codigo: true })
        if (!res.ok) return []
        const data = await res.json()
        return (Array.isArray(data) ? data : []).map(a => normalizar(a, rol))
      }))
      const arr = listas.flat()
      const sig = arr.map(a => `${a.clave}:${a.completado}:${a.estado}`).join('|')
      if (!manual && signaturaRef.current !== null && sig !== signaturaRef.current) {
        clearTimeout(hayCambiosTimer.current)
        setHayCambios(true)
        hayCambiosTimer.current = setTimeout(() => setHayCambios(false), 6000)
      }
      signaturaRef.current = sig
      setAlbaranes(arr)
      setLastUpdate(new Date())
      if (manual) {
        setHayCambios(false)
        clearTimeout(showOkTimer.current)
        setShowOk(true)
        showOkTimer.current = setTimeout(() => setShowOk(false), 2500)
      }
    } catch (e) {
      if (e.codigo) setCodigoInvalido(true)
      /* sin conexión: se reintenta en el siguiente ciclo */
    } finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }, [nombreEmpresa, qs, tipo])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const mixto  = roles.length > 1
  const hoyStr = isoLocal(new Date())

  // "Hoy" = todo lo trabajable: pendientes atrasados de días anteriores + todo lo de hoy
  const esTrabajableHoy = a =>
    a.fecha === hoyStr || (!a.planificado && a.fecha < hoyStr && !a.completado)

  const albaranesFiltrados = diaSeleccionado === 'hoy'
    ? albaranes.filter(esTrabajableHoy)
    : albaranes.filter(a => a.fecha === diaSeleccionado)

  // Agrupar por instalación destino
  const grupos = {}
  albaranesFiltrados.forEach(a => {
    const key = a.instalacion || '—'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(a)
  })
  const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => {
    const aPend = a.some(x => !x.planificado && !x.completado)
    const bPend = b.some(x => !x.planificado && !x.completado)
    if (aPend && !bPend) return -1
    if (!aPend && bPend) return 1
    // Después, la instalación con el albarán más reciente arriba
    const ultima = l => l.reduce((m, x) => (x.fecha || '') > m ? x.fecha : m, '')
    return ultima(b).localeCompare(ultima(a))
  })

  // Completados que no salen en la vista actual: siempre consultables abajo
  const completados = completadosFuera(
    albaranes.map(a => ({ ...a, id: a.clave })),
    albaranesFiltrados.map(a => ({ ...a, id: a.clave })),
    a => a.completado,
  ).map(a => albaranes.find(x => x.clave === a.id))

  const activos    = albaranesFiltrados.filter(a => !a.planificado)
  const pendientes = activos.filter(a => !a.completado).length
  const total      = activos.length

  const tarjeta = (a, esUltimo, conDestino = false) => (
    <TarjetaCamion key={a.clave} a={a} esUltimo={esUltimo} conDestino={conDestino} conRol={mixto}
      esDesde={!conDestino && a.rol === 'astilladora' && String(a.id) === desdeId}
      abierto={abiertoClave === a.clave}
      onToggle={() => setAbiertoClave(abiertoClave === a.clave ? null : a.clave)}
      nombre={nombreEmpresa} codigo={codigo} onCambio={fetchData} />
  )

  return (
    <div className="pi-page pi-page--desktop">
      <div className="pi-header" style={{ background: headerBgColor || COLOR_DEFECTO[roles[0]] || COLOR_DEFECTO.astilladora }}>
        <div className="pi-header-brand">
          {logoUrl
            ? <div className="pi-header-logo-img"><img src={logoUrl} alt="Logo" /></div>
            : <div className="pi-header-logo"><Leaf size={14} color="#fff" /></div>
          }
          <div className="pi-header-info">
            <div className="pi-header-title">{roles.map(r => ROL_TITULO[r]).join(' · ')}</div>
            <div className="pi-header-sub">{nombreEmpresa}</div>
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
          <NotificacionesBell tipo={roles} nombre={nombreEmpresa} codigo={codigo} />
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
              ) : gruposOrdenados.map(([instalacion, albs]) => (
                <GrupoInstalacion
                  key={instalacion}
                  instalacion={instalacion}
                  albaranes={albs}
                  renderTarjeta={(a, esUltimo) => tarjeta(a, esUltimo)}
                />
              ))}
            </div>

            <PanelCompletados
              albaranes={completados}
              renderFila={(a, esUltimo) => tarjeta(a, esUltimo, true)}
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

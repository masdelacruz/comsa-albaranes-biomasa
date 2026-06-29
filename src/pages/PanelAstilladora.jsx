import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, ChevronRight, Leaf, RefreshCw, MapPin } from 'lucide-react'
import './PanelInstalacion.css'

const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
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
  const dow    = (hoy.getDay() + 6) % 7
  const lun    = new Date(hoy)
  lun.setDate(hoy.getDate() - dow)
  lun.setHours(0,0,0,0)

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(lun); d.setDate(lun.getDate() + i)
    const key = isoLocal(d)
    return {
      key, dow: DIAS_ABR[i], diaN: d.getDate(),
      countActivo: albaranes.filter(a => a.fecha === key && !a.planificado).length,
      countPlan:   albaranes.filter(a => a.fecha === key &&  a.planificado).length,
      esHoy:    key === hoyStr,
      esPasado: key < hoyStr,
    }
  })
  const maxTotal = Math.max(...dias.map(d => d.countActivo + d.countPlan), 1)

  return (
    <div className="pi-semana">
      {dias.map(d => {
        const activoH = d.countActivo > 0 ? Math.max(4, Math.round((d.countActivo / maxTotal) * 28)) : 0
        const planH   = d.countPlan   > 0 ? Math.max(3, Math.round((d.countPlan   / maxTotal) * 28)) : 0
        const totalH  = Math.max(activoH + planH, 2)
        const barStyle = { height: `${totalH}px` }
        if (planH > 0 && activoH > 0)
          barStyle.background = `linear-gradient(to top, var(--green-${d.esHoy ? '500' : '400'}) ${activoH}px, var(--green-${d.esHoy ? '200' : '100'}) ${activoH}px)`
        else if (planH > 0)
          barStyle.background = d.esHoy ? 'rgba(255,255,255,0.25)' : 'var(--green-100)'
        const empty     = d.countActivo === 0 && d.countPlan === 0
        const clickable = !empty && onDiaClick
        const selected  = d.key === diaSeleccionado
        return (
          <div
            key={d.key}
            className={`pi-semana-dia${d.esHoy ? ' hoy' : ''}${d.esPasado ? ' pasado' : ''}${selected ? ' seleccionado' : ''}`}
            onClick={clickable ? () => onDiaClick(selected ? null : d.key) : undefined}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
          >
            <span className="pi-semana-dow">{d.dow}</span>
            <span className="pi-semana-num">{d.diaN}</span>
            <div className="pi-semana-bar-wrap">
              <div className="pi-semana-bar" style={barStyle} />
            </div>
            <span className={`pi-semana-count${empty ? ' vacio' : d.countActivo === 0 ? ' plan' : ''}`}>
              {d.countActivo > 0 ? d.countActivo : (d.countPlan > 0 ? `+${d.countPlan}` : '·')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function InfoCamion({ a }) {
  const firmado   = a.astilladoraFirmada
  const especie   = [a.especie, a.estella].filter(Boolean).join(' · ')
  const fechaHora = [fmtFecha(a.fecha), a.hora ? String(a.hora).slice(0,5) : null].filter(Boolean).join(' · ')

  return (
    <div>
      <div className="pi-camion-id">Albarán {a.id}</div>
      {a.transportista && <div className="pi-camion-matricula" style={{ fontFamily: 'inherit' }}>{a.transportista}</div>}
      {a.matriculaTractora && (
        <div className="pi-camion-meta">
          {a.matriculaTractora}
          {a.matriculaRemolque && <span> · {a.matriculaRemolque}</span>}
        </div>
      )}
      {especie    && <div className="pi-camion-meta">{especie}</div>}
      {fechaHora  && <div className="pi-camion-meta">{fechaHora}</div>}
      {firmado && a.astilladoraFecha && (
        <div className="pi-camion-meta verde">✓ Firmado · {fmtFirmaTs(a.astilladoraFecha)}</div>
      )}
    </div>
  )
}

function TarjetaCamion({ a, esUltimo, esDesde }) {
  const navigate    = useNavigate()
  const firmado     = a.astilladoraFirmada
  const planificado = a.planificado
  const ref         = useRef(null)

  useEffect(() => {
    if (esDesde && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [esDesde])

  const estadoClass = planificado ? 'planificado' : (firmado ? 'firmado' : 'pendiente')

  return (
    <div
      ref={ref}
      className={`pi-camion ${estadoClass}${esDesde ? ' pi-desde-active' : ''}`}
      onClick={planificado ? undefined : () => navigate(`/campo/${a.id}/astilladora`)}
      style={{ cursor: planificado ? 'default' : 'pointer', borderBottom: esUltimo ? 'none' : undefined }}
    >
      <div className="pi-camion-left">
        <InfoCamion a={a} />
      </div>
      <div className="pi-camion-right">
        {planificado
          ? <span className="pi-camion-plan-tag">Planificado</span>
          : firmado
          ? <CheckCircle size={20} color="var(--green-400)" />
          : <div className="pi-btn-firmar">Firmar <ChevronRight size={14} /></div>
        }
      </div>
    </div>
  )
}

function GrupoInstalacion({ instalacion, albaranes, desdeId }) {
  const activos      = albaranes.filter(a => !a.planificado)
  const planSorted   = albaranes.filter(a => a.planificado)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || 0)
  const firmados     = activos.filter(a => a.astilladoraFirmada).length
  const total        = activos.length
  const pct          = total > 0 ? Math.round((firmados / total) * 100) : 0

  const sorted = [...activos].sort((a, b) => {
    if (!a.astilladoraFirmada && b.astilladoraFirmada)  return -1
    if (a.astilladoraFirmada  && !b.astilladoraFirmada) return 1
    if (a.astilladoraFirmada  && b.astilladoraFirmada)
      return new Date(a.astilladoraFecha) - new Date(b.astilladoraFecha)
    return 0
  })

  const allCards = [...sorted, ...planSorted]

  return (
    <div className="pi-flota">
      <div className="pi-flota-header">
        <div className="pi-flota-icon"><MapPin size={15} color="var(--green-600)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pi-flota-title" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{instalacion}</div>
          <div className="pi-flota-sub">{total} camión{total !== 1 ? 'es' : ''}{planSorted.length > 0 ? ` · ${planSorted.length} planificado${planSorted.length !== 1 ? 's' : ''}` : ''}</div>
        </div>
        <div className="pi-flota-badge">{firmados}/{total}</div>
      </div>
      <div className="pi-progress-bar">
        <div className="pi-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pi-camiones-list">
        {sorted.map((a, i) => (
          <TarjetaCamion key={a.id} a={a} esUltimo={i === sorted.length - 1 && planSorted.length === 0} esDesde={String(a.id) === desdeId} />
        ))}
        {planSorted.length > 0 && <div className="pi-planif-sep">Planificado</div>}
        {planSorted.map((a, i) => (
          <TarjetaCamion key={a.id} a={a} esUltimo={i === planSorted.length - 1} esDesde={false} />
        ))}
      </div>
    </div>
  )
}

const AMBER_DEFAULT = '#78350f'

export default function PanelAstilladora() {
  const { nombre }  = useParams()
  const location    = useLocation()
  const navigate    = useNavigate()
  const nombreAstilladora = decodeURIComponent(nombre).replace(/-/g, ' ')

  const [desdeId] = useState(() => new URLSearchParams(location.search).get('desde'))
  useEffect(() => {
    if (desdeId) navigate(location.pathname, { replace: true })
  }, []) // eslint-disable-line

  const [albaranes,      setAlbaranes]     = useState([])
  const [loading,        setLoading]       = useState(true)
  const [lastUpdate,     setLastUpdate]    = useState(null)
  const [refreshing,     setRefreshing]    = useState(false)
  const [showOk,         setShowOk]        = useState(false)
  const [hayCambios,     setHayCambios]    = useState(false)
  const [logoUrl,        setLogoUrl]       = useState(null)
  const [headerBgColor,  setHeaderBgColor] = useState(null)
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const showOkTimer    = useRef(null)
  const hayCambiosTimer = useRef(null)
  const signaturaRef   = useRef(null)

  useEffect(() => {
    const logoId = `empresa_${slugify(nombreAstilladora)}`
    fetch(`/api/storage/logos/public/${logoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setLogoUrl(d.url) })
      .catch(() => {})
  }, [nombreAstilladora])

  useEffect(() => {
    if (!logoUrl) { setHeaderBgColor(null); return }
    let objUrl = null
    fetch(logoUrl)
      .then(r => r.blob())
      .then(blob => {
        objUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const scale  = Math.min(1, 64 / Math.max(img.width || 1, img.height || 1))
            canvas.width  = Math.max(1, Math.round((img.width  || 1) * scale))
            canvas.height = Math.max(1, Math.round((img.height || 1) * scale))
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
            let r = 0, g = 0, b = 0, count = 0
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] > 128) { r += data[i]; g += data[i+1]; b += data[i+2]; count++ }
            }
            if (count > 0) {
              const nr = r / count / 255, ng = g / count / 255, nb = b / count / 255
              const max = Math.max(nr, ng, nb), min = Math.min(nr, ng, nb)
              let h = 0, s = 0
              const l = (max + min) / 2
              if (max !== min) {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                if (max === nr) h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6
                else if (max === ng) h = ((nb - nr) / d + 2) / 6
                else h = ((nr - ng) / d + 4) / 6
              }
              const tL = 0.18, tS = Math.max(0.35, Math.min(0.85, s))
              const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1; if (t > 1) t -= 1
                if (t < 1/6) return p + (q - p) * 6 * t
                if (t < 1/2) return q
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
                return p
              }
              const q2 = tL < 0.5 ? tL * (1 + tS) : tL + tS - tL * tS
              const p2  = 2 * tL - q2
              const fr  = Math.round(hue2rgb(p2, q2, h + 1/3) * 255)
              const fg  = Math.round(hue2rgb(p2, q2, h) * 255)
              const fb  = Math.round(hue2rgb(p2, q2, h - 1/3) * 255)
              setHeaderBgColor(`rgb(${fr},${fg},${fb})`)
            }
          } catch {}
          URL.revokeObjectURL(objUrl)
        }
        img.onerror = () => URL.revokeObjectURL(objUrl)
        img.src = objUrl
      })
      .catch(() => {})
  }, [logoUrl])

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res  = await fetch(`/api/albaranes/astilladora/${encodeURIComponent(nombreAstilladora)}`)
      const data = await res.json()
      const arr  = Array.isArray(data) ? data : []
      const sig  = arr.map(a => `${a.id}:${a.astilladoraFirmada}:${a.estado}`).join('|')
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
    } catch {}
    setLoading(false)
    if (manual) setRefreshing(false)
  }, [nombreAstilladora])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const albaranesFiltrados = diaSeleccionado
    ? albaranes.filter(a => a.fecha === diaSeleccionado)
    : albaranes

  // Agrupar por instalación destino
  const grupos = {}
  albaranesFiltrados.forEach(a => {
    const key = a.instalacion || '—'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(a)
  })
  const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => {
    const aPend = a.some(x => !x.planificado && !x.astilladoraFirmada)
    const bPend = b.some(x => !x.planificado && !x.astilladoraFirmada)
    if (aPend && !bPend) return -1
    if (!aPend && bPend) return 1
    return 0
  })

  const activos    = albaranesFiltrados.filter(a => !a.planificado)
  const pendientes = activos.filter(a => !a.astilladoraFirmada).length
  const total      = activos.length

  return (
    <div className="pi-page">
      <div className="pi-header" style={{ background: headerBgColor || AMBER_DEFAULT }}>
        {logoUrl
          ? <div className="pi-header-logo-img"><img src={logoUrl} alt="Logo" /></div>
          : <div className="pi-header-logo"><Leaf size={14} color="#fff" /></div>
        }
        <div>
          <div className="pi-header-title">Astilladora</div>
          <div className="pi-header-sub">{nombreAstilladora}</div>
          <div className="pi-header-date">{fmtHoyHeader()}</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {showOk && <span className="pi-refresh-ok">✓ Actualizado</span>}
          {hayCambios && !showOk && (
            <span style={{
              fontSize:11, fontWeight:600, color:'#92400e',
              background:'#fef3c7', border:'1px solid #fbbf24',
              borderRadius:20, padding:'3px 8px', display:'flex', alignItems:'center', gap:4,
            }}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'#f59e0b',display:'inline-block'}} />
              Cambios
            </span>
          )}
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

      {loading ? (
        <div className="pi-spinner-wrap"><div className="pi-spinner" /></div>
      ) : total === 0 ? (
        <div className="pi-empty">
          <CheckCircle size={40} color="var(--green-400)" />
          <div className="pi-empty-title">Todo al día</div>
          <div className="pi-empty-sub">No hay camiones pendientes de firma.</div>
          {lastUpdate && <div className="pi-last-update">{labelFechaSec(isoLocal(lastUpdate))} · {lastUpdate.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}</div>}
        </div>
      ) : (
        <>
          <div className="pi-resumen">
            <div className="pi-resumen-item">
              <span className="pi-resumen-num">{pendientes}</span>
              <span className="pi-resumen-label">pendiente{pendientes !== 1 ? 's' : ''}</span>
            </div>
            <div className="pi-resumen-sep" />
            <div className="pi-resumen-item">
              <span className="pi-resumen-num">{total - pendientes}</span>
              <span className="pi-resumen-label">firmado{total - pendientes !== 1 ? 's' : ''}</span>
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

          {diaSeleccionado && (
            <div className="pi-filtro-dia-banner">
              <span>📅 {labelFechaSec(diaSeleccionado)}</span>
              <button onClick={() => setDiaSeleccionado(null)}>× Todos los días</button>
            </div>
          )}
          {desdeId && (
            <div className="pi-desde-banner">
              <span className="pi-desde-dot" />
              Albarán #{desdeId}
            </div>
          )}

          <div className="pi-section">
            {gruposOrdenados.map(([instalacion, albs]) => (
              <GrupoInstalacion
                key={instalacion}
                instalacion={instalacion}
                albaranes={albs}
                desdeId={desdeId}
              />
            ))}
          </div>

          {lastUpdate && (
            <div className="pi-last-update-bar">
              {labelFechaSec(isoLocal(lastUpdate))} · {lastUpdate.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })} · Se actualiza automáticamente
            </div>
          )}
        </>
      )}
    </div>
  )
}

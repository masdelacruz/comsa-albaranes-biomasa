import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Truck, ChevronRight, Leaf, RefreshCw } from 'lucide-react'
import './PanelInstalacion.css'

const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
const fmtFecha = (f) => f ? String(f).slice(0,10).split('-').reverse().join('/') : null

// "4/6/2026, 8:55:57" → "04/06 · 08:55"
function fmtFirmaTs(ts) {
  if (!ts) return ''
  const [datePart, timePart] = String(ts).split(', ')
  if (!datePart) return ts
  const [d, m] = datePart.split('/')
  const time = timePart ? timePart.slice(0, 5) : ''
  return `${d.padStart(2,'0')}/${m.padStart(2,'0')} · ${time}`
}

function InfoCamion({ a }) {
  const firmado = a.instalacionFirmada
  const meta    = [a.transportista, fmtFecha(a.fecha)].filter(Boolean).join(' · ')

  return (
    <div>
      <div className="pi-camion-id">Albarán {a.id}</div>
      {a.matriculaTractora && (
        <div className="pi-camion-matricula">
          {a.matriculaTractora}
          {a.matriculaRemolque && <span className="pi-remolque"> · {a.matriculaRemolque}</span>}
        </div>
      )}
      {meta && <div className="pi-camion-meta">{meta}</div>}
      {firmado && a.instalacionFecha && (
        <div className="pi-camion-meta verde">✓ Firmado · {fmtFirmaTs(a.instalacionFecha)}</div>
      )}
    </div>
  )
}

function TarjetaCamion({ a, esUltimo, esDesde }) {
  const navigate = useNavigate()
  const firmado  = a.instalacionFirmada
  const ref      = useRef(null)

  useEffect(() => {
    if (esDesde && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [esDesde])

  return (
    <div
      ref={ref}
      className={`pi-camion ${firmado ? 'firmado' : 'pendiente'}${esDesde ? ' pi-desde-active' : ''}`}
      onClick={() => navigate(`/campo/${a.id}/instalacion`)}
      style={{ cursor: 'pointer', borderBottom: esUltimo ? 'none' : undefined }}
    >
      <div className="pi-camion-left">
        <div className={`pi-camion-dot ${firmado ? 'verde' : 'amber'}`} />
        <InfoCamion a={a} />
      </div>
      <div className="pi-camion-right">
        {firmado
          ? <CheckCircle size={20} color="var(--green-400)" />
          : <div className="pi-btn-firmar">Firmar <ChevronRight size={14} /></div>
        }
      </div>
    </div>
  )
}

function TarjetaFlota({ albaranes, desdeId }) {
  const primero  = albaranes[0]
  const firmados = albaranes.filter(a => a.instalacionFirmada).length
  const total    = albaranes.length
  const pct      = Math.round((firmados / total) * 100)
  const origen   = primero.astilladora || primero.proveedor || '—'
  const fecha    = fmtFecha(primero.fecha)

  return (
    <div className="pi-flota">
      <div className="pi-flota-header">
        <div className="pi-flota-icon"><Truck size={16} color="var(--green-600)" /></div>
        <div>
          <div className="pi-flota-title">Flota · {total} camiones</div>
          <div className="pi-flota-sub">{origen}{fecha ? ` · ${fecha}` : ''}</div>
        </div>
        <div className="pi-flota-badge">{firmados}/{total}</div>
      </div>
      <div className="pi-progress-bar">
        <div className="pi-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pi-camiones-list">
        {albaranes.map((a, i) => (
          <div key={a.id} className="pi-camion-row">
            <span className="pi-camion-orden">#{i + 1}</span>
            <TarjetaCamion a={a} esUltimo={i === albaranes.length - 1} esDesde={String(a.id) === desdeId} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TarjetaSuelta({ a, esDesde }) {
  const navigate = useNavigate()
  const firmado  = a.instalacionFirmada
  const ref      = useRef(null)

  useEffect(() => {
    if (esDesde && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [esDesde])

  return (
    <div className="pi-suelta-wrap">
      <div
        ref={ref}
        className={`pi-camion ${firmado ? 'firmado' : 'pendiente'}${esDesde ? ' pi-desde-active' : ''}`}
        onClick={() => navigate(`/campo/${a.id}/instalacion`)}
        style={{ cursor: 'pointer' }}
      >
        <div className="pi-camion-left">
          <div className={`pi-camion-dot ${firmado ? 'verde' : 'amber'}`} />
          <InfoCamion a={a} />
        </div>
        <div className="pi-camion-right">
          {firmado
            ? <CheckCircle size={20} color="var(--green-400)" />
            : <div className="pi-btn-firmar">Firmar <ChevronRight size={14} /></div>
          }
        </div>
      </div>
    </div>
  )
}

export default function PanelInstalacion() {
  const { nombre } = useParams()
  const location   = useLocation()
  const desdeId    = new URLSearchParams(location.search).get('desde')
  const nombreInstalacion = decodeURIComponent(nombre).replace(/-/g, ' ')

  useEffect(() => {
    if (desdeId) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const [albaranes,     setAlbaranes]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [lastUpdate,    setLastUpdate]    = useState(null)
  const [refreshing,    setRefreshing]    = useState(false)
  const [showOk,        setShowOk]        = useState(false)
  const [logoUrl,       setLogoUrl]       = useState(null)
  const [headerBgColor, setHeaderBgColor] = useState(null)
  const showOkTimer = useRef(null)

  useEffect(() => {
    const logoId = `empresa_${slugify(nombreInstalacion)}`
    fetch(`/api/storage/logos/public/${logoId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setLogoUrl(d.url) })
      .catch(() => {})
  }, [nombreInstalacion])

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
              // Convertir color medio a HSL y fijar lightness=0.18, saturation ≥ 0.35
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
      const res  = await fetch(`/api/albaranes/instalacion/${encodeURIComponent(nombreInstalacion)}`)
      const data = await res.json()
      setAlbaranes(Array.isArray(data) ? data : [])
      setLastUpdate(new Date())
      if (manual) {
        clearTimeout(showOkTimer.current)
        setShowOk(true)
        showOkTimer.current = setTimeout(() => setShowOk(false), 2500)
      }
    } catch {}
    setLoading(false)
    if (manual) setRefreshing(false)
  }, [nombreInstalacion])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30000)
    return () => clearInterval(id)
  }, [fetchData])

  const flotas  = {}
  const sueltos = []
  albaranes.forEach(a => {
    if (a.grupoId) {
      if (!flotas[a.grupoId]) flotas[a.grupoId] = []
      flotas[a.grupoId].push(a)
    } else {
      sueltos.push(a)
    }
  })
  const flotasOrdenadas = Object.values(flotas)
  const pendientes = albaranes.filter(a => !a.instalacionFirmada).length
  const total      = albaranes.length

  return (
    <div className="pi-page">
      {/* Cabecera */}
      <div className="pi-header" style={headerBgColor ? { background: headerBgColor } : undefined}>
        {logoUrl
          ? <div className="pi-header-logo-img"><img src={logoUrl} alt="Logo" /></div>
          : <div className="pi-header-logo"><Leaf size={14} color="#fff" /></div>
        }
        <div>
          <div className="pi-header-title">Recepción</div>
          <div className="pi-header-sub">{nombreInstalacion}</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {showOk && (
            <span className="pi-refresh-ok">✓ Actualizado</span>
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
        <div className="pi-spinner-wrap">
          <div className="pi-spinner" />
        </div>
      ) : total === 0 ? (
        <div className="pi-empty">
          <CheckCircle size={40} color="var(--green-400)" />
          <div className="pi-empty-title">Todo al día</div>
          <div className="pi-empty-sub">No hay camiones pendientes de recepción.</div>
          {lastUpdate && <div className="pi-last-update">Actualizado: {lastUpdate.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })}</div>}
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

          {desdeId && (
            <div className="pi-desde-banner">
              <span className="pi-desde-dot" />
              Albarán #{desdeId}
            </div>
          )}

          {flotasOrdenadas.length > 0 && (
            <div className="pi-section">
              {flotasOrdenadas.map((camiones) => (
                <TarjetaFlota key={camiones[0].grupoId} albaranes={camiones} desdeId={desdeId} />
              ))}
            </div>
          )}

          {sueltos.length > 0 && (
            <div className="pi-section">
              {sueltos.length > 0 && flotasOrdenadas.length > 0 && (
                <div className="pi-section-label">Camiones individuales</div>
              )}
              <div className="pi-sueltos-list">
                {sueltos.map(a => <TarjetaSuelta key={a.id} a={a} esDesde={String(a.id) === desdeId} />)}
              </div>
            </div>
          )}

          {lastUpdate && (
            <div className="pi-last-update-bar">
              Actualizado a las {lastUpdate.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })} · Se actualiza automáticamente
            </div>
          )}
        </>
      )}
    </div>
  )
}

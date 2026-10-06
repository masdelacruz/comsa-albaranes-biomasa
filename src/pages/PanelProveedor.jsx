import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { CheckCircle, Leaf, RefreshCw, MapPin, FileText, Upload, ShieldCheck } from 'lucide-react'
import './PanelInstalacion.css'

// Panel público del proveedor (Opción 2 — proveedor directo). Acceso con el
// código de la empresa (?c=), igual que los paneles de astilladora e
// instalación. Por cada albarán el proveedor puede adjuntar su propio
// albarán y, si oficina no lo indicó, rellenar el origen.

const fmtFecha = (f) => f ? String(f).slice(0,10).split('-').reverse().join('/') : null
const MESES_C   = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const DIAS_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']

function fmtHoyHeader() {
  const d = new Date()
  const dia = DIAS_FULL[d.getDay()]
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1,3)} · ${d.getDate()} ${MESES_C[d.getMonth()]}`
}

const pendiente = a => !a.cerrado && (!a.albaranProveedor || !a.origen)

function TarjetaAlbaran({ a, nombre, codigo, onCambio }) {
  const [subiendo,  setSubiendo]  = useState(false)
  const [origen,    setOrigen]    = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')
  const fileRef = useRef(null)

  const qs = `?c=${encodeURIComponent(codigo)}`
  const base = encodeURIComponent(nombre)

  const subir = async (file) => {
    if (!file) return
    setSubiendo(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/storage/upload-proveedor/${base}/${a.id}${qs}`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo subir el fichero')
      await onCambio()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const completo = !pendiente(a)
  const especie  = [a.especie, a.tipoBiomasa, a.estella].filter(Boolean).join(' · ')
  const fechaHora = [fmtFecha(a.fecha), a.hora ? String(a.hora).slice(0,5) : null].filter(Boolean).join(' · ')
  const fila = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--gray-100)' }

  return (
    <div className="pi-flota">
      <div className="pi-flota-header">
        <div className="pi-flota-icon"><MapPin size={15} color="var(--green-600)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pi-flota-title">Albarán {a.id}</div>
          <div className="pi-flota-sub">{[a.instalacion, fechaHora].filter(Boolean).join(' · ')}</div>
          {especie && <div className="pi-flota-sub">{especie}</div>}
        </div>
        {a.cerrado
          ? <span className="pi-camion-plan-tag">Cerrado</span>
          : completo
          ? <CheckCircle size={20} color="var(--green-400)" />
          : <span className="pi-camion-atrasado-tag">Pendiente</span>}
      </div>

      {a.referenciaSure && (
        <div style={{ ...fila, fontSize: 12, color: 'var(--green-600)' }}>
          <ShieldCheck size={14} /> SURE · {a.referenciaSure}
        </div>
      )}

      {/* Albarán del proveedor */}
      <div style={fila}>
        <FileText size={15} color={a.albaranProveedor ? 'var(--green-400)' : 'var(--gray-300)'} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)' }}>Tu albarán</div>
          {a.albaranProveedor
            ? <a href={a.albaranProveedor.url} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: 'var(--blue-700)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.albaranProveedor.nombreFichero || 'Ver fichero'}
              </a>
            : <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Sin adjuntar · PDF o foto</div>}
        </div>
        {!a.cerrado && (
          <>
            <button className="pi-btn-firmar" disabled={subiendo} onClick={() => fileRef.current?.click()}
              style={{ cursor: subiendo ? 'default' : 'pointer', opacity: subiendo ? 0.6 : 1 }}>
              <Upload size={13} /> {subiendo ? 'Subiendo…' : a.albaranProveedor ? 'Cambiar' : 'Adjuntar'}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={e => subir(e.target.files?.[0])} />
          </>
        )}
      </div>

      {/* Origen */}
      <div style={{ ...fila, alignItems: a.origen || a.cerrado ? 'center' : 'flex-start' }}>
        <MapPin size={15} color={a.origen ? 'var(--green-400)' : 'var(--gray-300)'} style={{ flexShrink: 0, marginTop: a.origen || a.cerrado ? 0 : 8 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)' }}>Origen</div>
          {a.origen ? (
            <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{a.origen}</div>
          ) : a.cerrado ? (
            <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>—</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input type="text" value={origen} onChange={e => setOrigen(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') guardarOrigen() }}
                placeholder="Paraje / término municipal"
                style={{ flex: 1, minWidth: 0, padding: '7px 10px', fontSize: 13, border: '1px solid var(--gray-200)', borderRadius: 8 }} />
              <button className="pi-btn-firmar" onClick={guardarOrigen} disabled={!origen.trim() || guardando}
                style={{ cursor: !origen.trim() || guardando ? 'default' : 'pointer', opacity: !origen.trim() || guardando ? 0.5 : 1 }}>
                {guardando ? '…' : 'Guardar'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 14px', fontSize: 12, color: 'var(--red-700)', background: 'var(--red-50)', borderTop: '1px solid var(--red-100)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default function PanelProveedor() {
  const { nombre } = useParams()
  const location   = useLocation()
  const nombreProveedor = decodeURIComponent(nombre).replace(/-/g, ' ')
  const [codigo] = useState(() => new URLSearchParams(location.search).get('c') || '')

  const [albaranes,      setAlbaranes]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [codigoInvalido, setCodigoInvalido] = useState(false)
  const [refreshing,     setRefreshing]     = useState(false)
  const [lastUpdate,     setLastUpdate]     = useState(null)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch(`/api/albaranes/proveedor/${encodeURIComponent(nombreProveedor)}?c=${encodeURIComponent(codigo)}`)
      if (res.status === 401 || res.status === 403 || res.status === 404) { setCodigoInvalido(true); return }
      const data = await res.json()
      setAlbaranes(Array.isArray(data) ? data : [])
      setLastUpdate(new Date())
    } catch {} finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }, [nombreProveedor, codigo])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60000)
    return () => clearInterval(id)
  }, [fetchData])

  const pendientes = albaranes.filter(pendiente)
  const resto      = albaranes.filter(a => !pendiente(a))

  return (
    <div className="pi-page">
      <div className="pi-header" style={{ background: '#14532d' }}>
        <div className="pi-header-logo"><Leaf size={14} color="#fff" /></div>
        <div>
          <div className="pi-header-title">Proveedor</div>
          <div className="pi-header-sub">{nombreProveedor}</div>
          <div className="pi-header-date">{fmtHoyHeader()}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className={`pi-refresh${refreshing ? ' pi-refresh-spin' : ''}`} onClick={() => fetchData(true)} title="Actualizar" disabled={refreshing}>
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
          <div className="pi-empty-sub">No tienes albaranes en curso.</div>
        </div>
      ) : (
        <>
          <div className="pi-resumen">
            <div className="pi-resumen-item">
              <span className="pi-resumen-num">{pendientes.length}</span>
              <span className="pi-resumen-label">pendiente{pendientes.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="pi-resumen-sep" />
            <div className="pi-resumen-item">
              <span className="pi-resumen-num">{albaranes.length}</span>
              <span className="pi-resumen-label">total</span>
            </div>
          </div>

          {pendientes.length > 0 && (
            <div className="pi-section">
              <div className="pi-section-label">Pendientes de completar</div>
              {pendientes.map(a => <TarjetaAlbaran key={a.id} a={a} nombre={nombreProveedor} codigo={codigo} onCambio={fetchData} />)}
            </div>
          )}
          {resto.length > 0 && (
            <div className="pi-section">
              <div className="pi-section-label">Completados</div>
              {resto.map(a => <TarjetaAlbaran key={a.id} a={a} nombre={nombreProveedor} codigo={codigo} onCambio={fetchData} />)}
            </div>
          )}

          {lastUpdate && (
            <div className="pi-last-update-bar">
              Actualizado {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · Se actualiza automáticamente
            </div>
          )}
        </>
      )}
    </div>
  )
}

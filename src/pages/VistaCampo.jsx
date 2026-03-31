import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Upload, Leaf, ArrowLeft, Pen, Truck, Factory, Building2 } from 'lucide-react'
import SignaturePad from 'signature_pad'
import '../components/shared.css'
import './VistaCampo.css'

const ROLES = [
  { key: 'astilladora', label: 'Astilladora',  sub: 'Confirma carga y firma',        icon: <Factory size={18} color="#1D9E75" />, color: '#1D9E75', bg: '#f0faf5' },
  { key: 'camionero',   label: 'Camionero',    sub: 'Confirma transporte y firma',   icon: <Truck size={18} color="#3b82f6" />,   color: '#3b82f6', bg: '#eff6ff' },
  { key: 'instalacion', label: 'Instalación',  sub: 'Confirma recepción y firma',    icon: <Building2 size={18} color="#f5a623" />, color: '#f5a623', bg: '#fffbf0' },
]

const PASOS = ['Datos', 'Firma']

export default function VistaCampo({ albaranes, updateFirma, subirTicketPesada }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const a = albaranes.find(x => x.id === id)

  const [rol, setRol]               = useState(null)
  const [paso, setPaso]             = useState(0)
  const [nombre, setNombre]         = useState('')
  const [matricula, setMatricula]   = useState('')
  const [obs, setObs]               = useState('')
  const [pesoEntrada, setPesoEntrada] = useState('')
  const [pesoSalida, setPesoSalida]   = useState('')
  const [humedad, setHumedad]         = useState('')
  const [firmado, setFirmado]         = useState(false)
  const [hasFirma, setHasFirma]       = useState(false)
  const [ticketNombre, setTicketNombre] = useState('')

  const canvasRef   = useRef(null)
  const sigPadRef   = useRef(null)

  useEffect(() => {
    if (paso === 1 && canvasRef.current && !sigPadRef.current) {
      sigPadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(250,250,249)',
        penColor: '#1a1917',
        minWidth: 1.5,
        maxWidth: 3,
      })
      sigPadRef.current.addEventListener('endStroke', () => setHasFirma(true))
      const resize = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = Math.max(window.devicePixelRatio || 1, 1)
        canvas.width  = canvas.offsetWidth  * ratio
        canvas.height = canvas.offsetHeight * ratio
        canvas.getContext('2d').scale(ratio, ratio)
        sigPadRef.current?.clear()
        setHasFirma(false)
      }
      resize()
      window.addEventListener('resize', resize)
      return () => window.removeEventListener('resize', resize)
    }
  }, [paso])

  if (!a) return <div style={{padding:40,textAlign:'center',color:'#999'}}>Albarán no encontrado.</div>

  const pesoNeto = pesoEntrada && pesoSalida
    ? ((parseFloat(pesoEntrada) - parseFloat(pesoSalida)) / 1000).toFixed(2) + ' t' : null

  const handleFirmar = async () => {
    const firmaImagen = sigPadRef.current && !sigPadRef.current.isEmpty()
      ? sigPadRef.current.toDataURL() : null

    const pesadaData = rol === 'instalacion' ? {
      entrada: parseFloat(pesoEntrada) || null,
      salida:  parseFloat(pesoSalida)  || null,
      humedad: parseFloat(humedad)     || null,
    } : null

    await updateFirma(a.id, rol, nombre || a.firmas[rol]?.actor, pesadaData, firmaImagen)
    setFirmado(true)
  }

  const limpiarFirma = () => { sigPadRef.current?.clear(); setHasFirma(false) }

  if (!rol) return (
    <div className="campo-page">
      <div className="campo-topbar">
        <div className="campo-topbar-logo"><Leaf size={14} color="#fff" /></div>
        <div>
          <div className="campo-title">Albarán {a.id}</div>
          <div className="campo-sub">{a.astilladora} → {a.instalacion} · {a.fecha.split('-').reverse().join('/')}</div>
        </div>
      </div>

      <div className="campo-card">
        <div className="campo-card-title">Datos del albarán</div>
        {[
          ['Especie', `${a.especie} · ${a.tipoBiomasa}`],
          ['Origen', a.origen || '—'],
          ['Destino', a.instalacion],
          ['Transportista', a.transportista],
          ['Observaciones', a.observaciones || '—'],
        ].map(([k, v]) => (
          <div key={k} className="campo-row">
            <span className="campo-row-key">{k}</span>
            <span className="campo-row-val">{v}</span>
          </div>
        ))}
      </div>

      <div className="campo-card">
        <div className="campo-card-title">¿Quién eres?</div>
        <div className="rol-selector">
          {ROLES.map(r => {
            const yaFirmado = a.firmas[r.key]?.firmado
            return (
              <button
                key={r.key}
                className={`rol-btn ${yaFirmado ? 'done' : ''}`}
                style={{ borderColor: yaFirmado ? 'var(--gray-200)' : r.color }}
                onClick={() => !yaFirmado && setRol(r.key)}
              >
                <div className="rol-btn-left">
                  <div className="rol-btn-icon" style={{ background: yaFirmado ? 'var(--gray-100)' : r.bg }}>
                    {yaFirmado ? <CheckCircle size={18} color="var(--green-400)" /> : r.icon}
                  </div>
                  <div>
                    <div className="rol-btn-label" style={{ color: yaFirmado ? 'var(--gray-400)' : r.color }}>{r.label}</div>
                    <div className="rol-btn-sub">{yaFirmado ? `Firmado · ${a.firmas[r.key]?.fecha}` : r.sub}</div>
                  </div>
                </div>
                {!yaFirmado && <span style={{ fontSize: 18, color: r.color }}>›</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 13, cursor: 'pointer', padding: '8px 0' }}>
          ← Volver al panel interno
        </button>
      </div>
    </div>
  )

  if (firmado) return (
    <div className="campo-page">
      <div className="campo-success">
        <div className="campo-success-icon"><CheckCircle size={36} color="var(--green-400)" /></div>
        <div className="campo-success-title">¡Firmado correctamente!</div>
        <div className="campo-success-sub">El equipo de Comsa Service ha sido notificado. Gracias por tu confirmación.</div>
        <div style={{ fontSize: 12, color: 'var(--gray-300)', marginTop: 8 }}>{a.id}</div>
      </div>
    </div>
  )

  const rolInfo = ROLES.find(r => r.key === rol)

  return (
    <div className="campo-page">
      <div className="campo-topbar">
        <button onClick={() => { setRol(null); setPaso(0) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-600)', padding: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="campo-title">{rolInfo?.label} · {a.id}</div>
          <div className="campo-sub">{paso === 0 ? 'Paso 1: Confirma los datos' : 'Paso 2: Firma'}</div>
        </div>
      </div>

      <div className="paso-indicator">
        {PASOS.map((_, i) => <div key={i} className={`paso-dot ${i === paso ? 'active' : ''}`} />)}
      </div>

      {paso === 0 && (
        <>
          <div className="campo-card">
            <div className="campo-card-title">Datos del albarán</div>
            {[
              ['Especie', `${a.especie} · ${a.tipoBiomasa}`],
              ['Origen', a.origen || '—'],
              ['Destino', a.instalacion],
              ['Permiso', a.permiso || '—'],
              ['Observaciones', a.observaciones || '—'],
            ].map(([k, v]) => (
              <div key={k} className="campo-row">
                <span className="campo-row-key">{k}</span>
                <span className="campo-row-val">{v}</span>
              </div>
            ))}
          </div>

          <div className="campo-card">
            <div className="campo-card-title">Tu confirmación</div>
            <div className="campo-field">
              <label>Nombre y empresa *</label>
              <input type="text" placeholder={`Ej: ${a.firmas[rol]?.actor}`} value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            {rol === 'camionero' && (
              <div className="campo-field">
                <label>Matrícula del camión</label>
                <input type="text" placeholder="Ej: 1234 ABC" value={matricula} onChange={e => setMatricula(e.target.value)} />
              </div>
            )}
            {rol === 'instalacion' && (
              <>
                <div className="info-banner">Introduce los datos de pesada de la báscula de la instalación.</div>
                <div className="peso-grid">
                  <div className="campo-field">
                    <label>Peso entrada (kg)</label>
                    <input type="number" placeholder="Ej: 28400" value={pesoEntrada} onChange={e => setPesoEntrada(e.target.value)} />
                  </div>
                  <div className="campo-field">
                    <label>Peso salida / tara (kg)</label>
                    <input type="number" placeholder="Ej: 14200" value={pesoSalida} onChange={e => setPesoSalida(e.target.value)} />
                  </div>
                </div>
                {pesoNeto && (
                  <div className="peso-resultado">
                    <div className="peso-resultado-label">Peso neto calculado</div>
                    <div className="peso-resultado-val">{pesoNeto}</div>
                  </div>
                )}
                <div className="campo-field">
                  <label>Humedad (%) — opcional si pendiente</label>
                  <input type="number" step="0.1" placeholder="Ej: 28.4" value={humedad} onChange={e => setHumedad(e.target.value)} />
                </div>
                <label className="upload-zona" style={{cursor:'pointer'}}>
                  <Upload size={16} />
                  <span>{ticketNombre || 'Adjuntar ticket de pesada (foto o PDF)'}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{display:'none'}}
                    onChange={async (e) => {
                      const f = e.target.files[0]
                      if (!f) return
                      setTicketNombre(f.name)
                      await subirTicketPesada(a.id, f)
                    }}
                  />
                </label>
              </>
            )}
            <div className="campo-field">
              <label>Incidencias u observaciones (opcional)</label>
              <textarea placeholder="Carga incompleta, retraso, acceso complicado..." value={obs} onChange={e => setObs(e.target.value)} />
            </div>
          </div>

          <button
            className="campo-btn-primary"
            disabled={!nombre.trim()}
            onClick={() => setPaso(1)}
          >
            Continuar a firmar →
          </button>
        </>
      )}

      {paso === 1 && (
        <>
          <div className="campo-card">
            <div className="campo-card-title">Firma aquí</div>
            <div className={`firma-canvas-wrap ${hasFirma ? 'signed' : ''}`} style={{ height: 160 }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
              {!hasFirma && <div className="firma-canvas-label"><Pen size={16} /><br />Firma con el dedo</div>}
            </div>
            {hasFirma && <button className="firma-clear" onClick={limpiarFirma}>Borrar y repetir ×</button>}
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 12 }}>
              Firmando como: <strong>{nombre || a.firmas[rol]?.actor}</strong> · {rolInfo?.label}
            </div>
          </div>

          <button
            className="campo-btn-primary"
            disabled={!hasFirma}
            onClick={handleFirmar}
          >
            <CheckCircle size={18} /> Confirmar y enviar firma
          </button>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => setPaso(0)} style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 13, cursor: 'pointer' }}>
              ← Volver a los datos
            </button>
          </div>
        </>
      )}
    </div>
  )
}
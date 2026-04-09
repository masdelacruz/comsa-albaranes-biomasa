import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Upload, Leaf, ArrowLeft, Pen, Truck, Factory, Building2 } from 'lucide-react'
import SignaturePad from 'signature_pad'
import '../components/shared.css'
import './VistaCampo.css'

const ROLES_CONFIG = {
  astilladora: { label: 'Astilladora',   sub: 'Confirma carga y firma',      icon: <Factory size={18} color="#1D9E75" />,   color: '#1D9E75', bg: '#f0faf5' },
  camionero:   { label: 'Transportista', sub: 'Confirma transporte y firma',  icon: <Truck size={18} color="#3b82f6" />,     color: '#3b82f6', bg: '#eff6ff' },
  instalacion: { label: 'Instalación',   sub: 'Confirma recepción y firma',   icon: <Building2 size={18} color="#f5a623" />, color: '#f5a623', bg: '#fffbf0' },
}

const ROLES_ORDEN = ['astilladora', 'camionero', 'instalacion']

function PasoFirma({ rol, a, updateFirma, subirTicketPesada, onCompletado, totalPasos, pasoActual }) {
  const [nombre, setNombre]         = useState('')
  const [matricula, setMatricula]   = useState('')
  const [obs, setObs]               = useState('')
  const [pesoEntrada, setPesoEntrada] = useState('')
  const [pesoSalida, setPesoSalida]   = useState('')
  const [humedad, setHumedad]         = useState('')
  const [ticketNombre, setTicketNombre] = useState('')
  const [hasFirma, setHasFirma]     = useState(false)
  const [firmado, setFirmado]       = useState(false)
  const canvasRef = useRef(null)
  const sigPadRef = useRef(null)

  const config = ROLES_CONFIG[rol]
  const yaFirmado = a.firmas?.[rol]?.firmado

  useEffect(() => {
    if (canvasRef.current && !sigPadRef.current) {
      sigPadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(250,250,249)', penColor: '#1a1917', minWidth: 1.5, maxWidth: 3,
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
  }, [])

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
    setTimeout(() => onCompletado(), 1200)
  }

  const limpiarFirma = () => { sigPadRef.current?.clear(); setHasFirma(false) }

  if (yaFirmado) {
    return (
      <div className="campo-card" style={{textAlign:'center',padding:'20px 16px'}}>
        <CheckCircle size={28} color="var(--green-400)" style={{marginBottom:8}} />
        <div style={{fontSize:14,fontWeight:600,color:'var(--green-600)'}}>Ya firmado</div>
        <div style={{fontSize:12,color:'var(--gray-400)',marginTop:4}}>{a.firmas[rol]?.fecha}</div>
      </div>
    )
  }

  if (firmado) {
    return (
      <div className="campo-card" style={{textAlign:'center',padding:'20px 16px'}}>
        <CheckCircle size={28} color="var(--green-400)" style={{marginBottom:8}} />
        <div style={{fontSize:14,fontWeight:600,color:'var(--green-600)'}}>¡Firmado!</div>
        <div style={{fontSize:12,color:'var(--gray-400)',marginTop:4}}>Continuando...</div>
      </div>
    )
  }

  return (
    <div className="campo-card">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:12,borderBottom:'var(--border)'}}>
        <div style={{width:36,height:36,borderRadius:8,background:config.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {config.icon}
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:config.color}}>{config.label}</div>
          <div style={{fontSize:11,color:'var(--gray-400)'}}>Paso {pasoActual} de {totalPasos}</div>
        </div>
      </div>

      <div className="campo-field">
        <label>Nombre y empresa *</label>
        <input type="text" placeholder={a.firmas[rol]?.actor} value={nombre} onChange={e => setNombre(e.target.value)} />
      </div>

      {rol === 'camionero' && (
        <div className="campo-field">
          <label>Matrícula del camión</label>
          <input type="text" placeholder="Ej: 1234 ABC" value={matricula} onChange={e => setMatricula(e.target.value)} />
        </div>
      )}

      {rol === 'instalacion' && (
        <>
          <div style={{background:'var(--blue-50)',border:'1px solid var(--blue-100)',borderRadius:'var(--radius-md)',padding:'8px 12px',fontSize:12,color:'var(--blue-700)',marginBottom:10}}>
            Introduce los datos de pesada de la báscula.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
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
            <div style={{background:'var(--green-50)',border:'1px solid var(--green-100)',borderRadius:'var(--radius-md)',padding:'8px 12px',textAlign:'center',marginBottom:10}}>
              <div style={{fontSize:11,color:'var(--green-600)'}}>Peso neto</div>
              <div style={{fontSize:18,fontWeight:600,color:'var(--green-600)'}}>{pesoNeto}</div>
            </div>
          )}
          <div className="campo-field">
            <label>Humedad (%) — opcional</label>
            <input type="number" step="0.1" placeholder="Ej: 28.4" value={humedad} onChange={e => setHumedad(e.target.value)} />
          </div>
          <label className="upload-zona" style={{cursor:'pointer'}}>
            <Upload size={16} />
            <span>{ticketNombre || 'Adjuntar ticket de pesada'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
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
        <textarea placeholder="Carga incompleta, retraso..." value={obs} onChange={e => setObs(e.target.value)} />
      </div>

      <div className={`firma-canvas-wrap ${hasFirma ? 'signed' : ''}`} style={{height:140,marginBottom:8}}>
        <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} />
        {!hasFirma && (
          <div className="firma-canvas-label">
            <Pen size={16} /><br />Firma con el dedo
          </div>
        )}
      </div>
      {hasFirma && <button className="firma-clear" onClick={limpiarFirma}>Borrar y repetir ×</button>}

      <button className="campo-btn-primary" disabled={!hasFirma} onClick={handleFirmar}>
        <CheckCircle size={16} /> Confirmar y firmar
      </button>
    </div>
  )
}

export default function VistaCampo({ albaranes, updateFirma, subirTicketPesada }) {
  const { id, roles: rolesParam } = useParams()
  const navigate = useNavigate()
  const a = albaranes.find(x => x.id === id)

  const [rolSeleccionado, setRolSeleccionado] = useState(null)
  const [pasoActual, setPasoActual]           = useState(0)
  const [todoCompletado, setTodoCompletado]   = useState(false)

  if (!a) return <div style={{padding:40,textAlign:'center',color:'#999'}}>Albarán no encontrado.</div>

  // Determinar roles a mostrar
  const rolesDirectos = rolesParam
    ? rolesParam.split(',').filter(r => ROLES_CONFIG[r])
    : null

  const ROLES_SELECTOR = ROLES_ORDEN.filter(r => ROLES_CONFIG[r] && a.firmas?.[r] !== undefined)

  const handleCompletadoPaso = () => {
    if (rolesDirectos && pasoActual < rolesDirectos.length - 1) {
      setPasoActual(prev => prev + 1)
    } else {
      setTodoCompletado(true)
    }
  }

  if (todoCompletado) return (
    <div className="campo-page">
      <div className="campo-success">
        <div className="campo-success-icon"><CheckCircle size={36} color="var(--green-400)" /></div>
        <div className="campo-success-title">¡Todo completado!</div>
        <div className="campo-success-sub">El equipo de Comsa Service ha sido notificado. Gracias por tu confirmación.</div>
      </div>
    </div>
  )

  // Flujo directo con roles en la URL
  if (rolesDirectos && rolesDirectos.length > 0) {
    const rolActual = rolesDirectos[pasoActual]
    return (
      <div className="campo-page">
        <div className="campo-topbar">
          <div className="campo-topbar-logo"><Leaf size={14} color="#fff" /></div>
          <div>
            <div className="campo-title">Albarán {a.id}</div>
            <div className="campo-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha?.split('-').reverse().join('/')}</div>
          </div>
        </div>

        {rolesDirectos.length > 1 && (
          <div style={{display:'flex',gap:6,marginBottom:14,padding:'0 2px'}}>
            {rolesDirectos.map((r, i) => (
              <div key={r} style={{flex:1,height:4,borderRadius:99,background: i <= pasoActual ? 'var(--green-400)' : 'var(--gray-200)',transition:'background 0.3s'}} />
            ))}
          </div>
        )}

        <div className="campo-card">
          <div className="campo-card-title">Datos del albarán</div>
          {[
            ['Especie',       `${a.especie} · ${a.tipoBiomasa}`],
            ['Origen',        a.origen || '—'],
            ['Destino',       a.instalacion],
            ['Transportista', a.transportista || '—'],
            ['Observaciones', a.observaciones || '—'],
          ].map(([k, v]) => (
            <div key={k} className="campo-row">
              <span className="campo-row-key">{k}</span>
              <span className="campo-row-val">{v}</span>
            </div>
          ))}
        </div>

        <PasoFirma
          rol={rolActual}
          a={a}
          updateFirma={updateFirma}
          subirTicketPesada={subirTicketPesada}
          onCompletado={handleCompletadoPaso}
          totalPasos={rolesDirectos.length}
          pasoActual={pasoActual + 1}
        />
      </div>
    )
  }

  // Flujo genérico — selector de rol
  if (!rolSeleccionado) return (
    <div className="campo-page">
      <div className="campo-topbar">
        <div className="campo-topbar-logo"><Leaf size={14} color="#fff" /></div>
        <div>
          <div className="campo-title">Albarán {a.id}</div>
          <div className="campo-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha?.split('-').reverse().join('/')}</div>
        </div>
      </div>

      <div className="campo-card">
        <div className="campo-card-title">Datos del albarán</div>
        {[
          ['Especie',       `${a.especie} · ${a.tipoBiomasa}`],
          ['Origen',        a.origen || '—'],
          ['Destino',       a.instalacion],
          ['Transportista', a.transportista || '—'],
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
          {ROLES_SELECTOR.map(r => {
            const config = ROLES_CONFIG[r]
            const yaFirmado = a.firmas[r]?.firmado
            return (
              <button key={r} className={`rol-btn ${yaFirmado ? 'done' : ''}`}
                style={{borderColor: yaFirmado ? 'var(--gray-200)' : config.color}}
                onClick={() => !yaFirmado && setRolSeleccionado(r)}>
                <div className="rol-btn-left">
                  <div className="rol-btn-icon" style={{background: yaFirmado ? 'var(--gray-100)' : config.bg}}>
                    {yaFirmado ? <CheckCircle size={18} color="var(--green-400)" /> : config.icon}
                  </div>
                  <div>
                    <div className="rol-btn-label" style={{color: yaFirmado ? 'var(--gray-400)' : config.color}}>{config.label}</div>
                    <div className="rol-btn-sub">{yaFirmado ? `Firmado · ${a.firmas[r]?.fecha}` : config.sub}</div>
                  </div>
                </div>
                {!yaFirmado && <span style={{fontSize:18,color:config.color}}>›</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{textAlign:'center'}}>
        <button onClick={() => navigate('/dashboard')} style={{background:'none',border:'none',color:'var(--gray-400)',fontSize:13,cursor:'pointer',padding:'8px 0'}}>
          ← Volver al panel interno
        </button>
      </div>
    </div>
  )

  // Flujo genérico — formulario de rol seleccionado
  return (
    <div className="campo-page">
      <div className="campo-topbar">
        <button onClick={() => setRolSeleccionado(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray-600)'}}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div className="campo-title">Albarán {a.id}</div>
          <div className="campo-sub">{ROLES_CONFIG[rolSeleccionado]?.label}</div>
        </div>
      </div>

      <div className="campo-card">
        <div className="campo-card-title">Datos del albarán</div>
        {[
          ['Especie',       `${a.especie} · ${a.tipoBiomasa}`],
          ['Origen',        a.origen || '—'],
          ['Destino',       a.instalacion],
          ['Transportista', a.transportista || '—'],
          ['Observaciones', a.observaciones || '—'],
        ].map(([k, v]) => (
          <div key={k} className="campo-row">
            <span className="campo-row-key">{k}</span>
            <span className="campo-row-val">{v}</span>
          </div>
        ))}
      </div>

      <PasoFirma
        rol={rolSeleccionado}
        a={a}
        updateFirma={updateFirma}
        subirTicketPesada={subirTicketPesada}
        onCompletado={() => setTodoCompletado(true)}
        totalPasos={1}
        pasoActual={1}
      />
    </div>
  )
}
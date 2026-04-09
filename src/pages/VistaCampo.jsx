import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Upload, Leaf, ArrowLeft, Pen, Truck, Factory, Building2 } from 'lucide-react'
import SignaturePad from 'signature_pad'
import '../components/shared.css'
import './VistaCampo.css'

const ROLES_CONFIG = {
  astilladora:   { label: 'Astilladora',   sub: 'Confirma carga y firma',     icon: <Factory size={18} color="#1D9E75" />,   color: '#1D9E75', bg: '#f0faf5' },
  transportista: { label: 'Transportista', sub: 'Confirma transporte y firma', icon: <Truck size={18} color="#3b82f6" />,     color: '#3b82f6', bg: '#eff6ff' },
  instalacion:   { label: 'Instalación',   sub: 'Confirma recepción y firma',  icon: <Building2 size={18} color="#f5a623" />, color: '#f5a623', bg: '#fffbf0' },
}

const ROLES_ORDEN = ['astilladora', 'transportista', 'instalacion']

function PasoFirma({ rol, a, updateFirma, subirTicketPesada, onCompletado, totalPasos, pasoActual }) {
  const [matriculaTractora, setMatriculaTractora] = useState(a.matriculaTractora || '')
  const [matriculaRemolque, setMatriculaRemolque] = useState(a.matriculaRemolque || '')
  const [chofer, setChofer]                       = useState(a.chofer || '')
  const [origen, setOrigen]                       = useState(a.origen || '')
  const [obs, setObs]                             = useState('')
  const [pesoBruto, setPesoBruto]                 = useState(a.pesada?.entrada ? String(a.pesada.entrada) : '')
  const [tara, setTara]                           = useState(a.pesada?.salida  ? String(a.pesada.salida)  : '')
  const [humedad, setHumedad]                     = useState(a.pesada?.humedad ? String(a.pesada.humedad) : '')
  const [ticketNombre, setTicketNombre]           = useState('')
  const [hasFirma, setHasFirma]                   = useState(false)
  const [firmado, setFirmado]                     = useState(false)
  const canvasRef = useRef(null)
  const sigPadRef = useRef(null)

  const config   = ROLES_CONFIG[rol]
  const yaFirmado = a.firmas?.[rol]?.firmado

  const pesoNeto = pesoBruto && tara
    ? (parseFloat(pesoBruto) - parseFloat(tara)).toLocaleString('es-ES') + ' kg' : null

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

  const handleFirmar = async () => {
    const firmaImagen = sigPadRef.current && !sigPadRef.current.isEmpty()
      ? sigPadRef.current.toDataURL() : null

    const pesadaData = (rol === 'astilladora' || rol === 'transportista') && (pesoBruto || tara) ? {
      entrada: parseFloat(pesoBruto) || null,
      salida:  parseFloat(tara)      || null,
      humedad: parseFloat(humedad)   || null,
    } : null

    const campoData = (rol === 'astilladora' || rol === 'transportista') ? {
      matriculaTractora, matriculaRemolque, chofer,
      origen: origen || null,
    } : null

    await updateFirma(a.id, rol, a.firmas[rol]?.actor, pesadaData, firmaImagen, campoData)
    setFirmado(true)
    setTimeout(() => onCompletado(), 1000)
  }

  const limpiarFirma = () => { sigPadRef.current?.clear(); setHasFirma(false) }

  if (yaFirmado) return (
    <div className="campo-card" style={{textAlign:'center',padding:'20px 16px'}}>
      <CheckCircle size={28} color="var(--green-400)" style={{marginBottom:8}} />
      <div style={{fontSize:14,fontWeight:600,color:'var(--green-600)'}}>Ya firmado</div>
      <div style={{fontSize:12,color:'var(--gray-400)',marginTop:4}}>{a.firmas[rol]?.fecha}</div>
    </div>
  )

  if (firmado) return (
    <div className="campo-card" style={{textAlign:'center',padding:'20px 16px'}}>
      <CheckCircle size={28} color="var(--green-400)" style={{marginBottom:8}} />
      <div style={{fontSize:14,fontWeight:600,color:'var(--green-600)'}}>¡Firmado!</div>
      <div style={{fontSize:12,color:'var(--gray-400)',marginTop:4}}>
        {pasoActual < totalPasos ? 'Continuando...' : 'Completado'}
      </div>
    </div>
  )

  return (
    <div className="campo-card">
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:12,borderBottom:'var(--border)'}}>
        <div style={{width:36,height:36,borderRadius:8,background:config.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {config.icon}
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:config.color}}>{config.label}</div>
          {totalPasos > 1 && <div style={{fontSize:11,color:'var(--gray-400)'}}>Paso {pasoActual} de {totalPasos}</div>}
        </div>
      </div>

      {(rol === 'astilladora' || rol === 'transportista') && (
        <>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>
            Datos del transporte
          </div>
          <div className="campo-field">
            <label>Matrícula tractora</label>
            <input type="text" placeholder="Ej: 1234 ABC" value={matriculaTractora} onChange={e => setMatriculaTractora(e.target.value)} />
          </div>
          <div className="campo-field">
            <label>Matrícula remolque</label>
            <input type="text" placeholder="Ej: R-1234-ABC" value={matriculaRemolque} onChange={e => setMatriculaRemolque(e.target.value)} />
          </div>
          <div className="campo-field">
            <label>Chófer</label>
            <input type="text" placeholder="Nombre del conductor" value={chofer} onChange={e => setChofer(e.target.value)} />
          </div>

          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'14px 0 10px'}}>
            Datos de pesada
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="campo-field">
              <label>Peso bruto (kg)</label>
              <input type="number" placeholder="Ej: 28400" value={pesoBruto} onChange={e => setPesoBruto(e.target.value)} />
            </div>
            <div className="campo-field">
              <label>Tara (kg)</label>
              <input type="number" placeholder="Ej: 14200" value={tara} onChange={e => setTara(e.target.value)} />
            </div>
          </div>
          {pesoNeto && (
            <div style={{background:'var(--green-50)',border:'1px solid var(--green-100)',borderRadius:'var(--radius-md)',padding:'8px 12px',textAlign:'center',marginBottom:10}}>
              <div style={{fontSize:11,color:'var(--green-600)'}}>Peso neto calculado</div>
              <div style={{fontSize:18,fontWeight:600,color:'var(--green-600)'}}>{pesoNeto}</div>
            </div>
          )}
          <div className="campo-field">
            <label>Humedad (%) — opcional</label>
            <input type="number" step="0.1" placeholder="Ej: 28.4" value={humedad} onChange={e => setHumedad(e.target.value)} />
          </div>
          <label className="upload-zona" style={{cursor:'pointer',marginBottom:10}}>
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

          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'14px 0 10px'}}>
            Origen
          </div>
          <div className="campo-field">
            <label>{a.origen ? 'Origen (ya introducido, puedes corregirlo)' : 'Origen biomasa *'}</label>
            <input
              type="text"
              placeholder="Ej: Mas de les Guilles, Arbúcies (Selva)"
              value={origen}
              onChange={e => setOrigen(e.target.value)}
              style={a.origen ? {} : {borderColor:'var(--amber-300)',background:'var(--amber-50)'}}
            />
          </div>
        </>
      )}

      {rol === 'instalacion' && (
        <div style={{background:'var(--blue-50)',border:'1px solid var(--blue-100)',borderRadius:'var(--radius-md)',padding:'10px 12px',fontSize:13,color:'var(--blue-700)',marginBottom:12}}>
          Revisa los datos del albarán y firma para confirmar la recepción.
        </div>
      )}

      <div className="campo-field">
        <label>Incidencias u observaciones (opcional)</label>
        <textarea placeholder="Carga incompleta, retraso, discrepancias..." value={obs} onChange={e => setObs(e.target.value)} />
      </div>

      <div className={`firma-canvas-wrap ${hasFirma ? 'signed' : ''}`} style={{height:140,marginBottom:8}}>
        <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}} />
        {!hasFirma && (
          <div className="firma-canvas-label"><Pen size={16} /><br />Firma con el dedo</div>
        )}
      </div>
      {hasFirma && <button className="firma-clear" onClick={limpiarFirma}>Borrar y repetir ×</button>}

      <button className="campo-btn-primary" disabled={!hasFirma} onClick={handleFirmar}>
        <CheckCircle size={16} />
        {rol === 'instalacion' ? 'Confirmar recepción y firmar' : 'Confirmar y firmar'}
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

  const rolesDirectos = rolesParam
    ? rolesParam.split(',').filter(r => ROLES_CONFIG[r])
    : null

  const ROLES_SELECTOR = ROLES_ORDEN.filter(r => a.firmas?.[r] !== undefined)

  const handleCompletadoPaso = () => {
    if (rolesDirectos && pasoActual < rolesDirectos.length - 1) {
      setPasoActual(prev => prev + 1)
    } else {
      setTodoCompletado(true)
    }
  }

  const DatosAlbaran = () => (
    <div className="campo-card">
      <div className="campo-card-title">Datos del albarán</div>
      {[
        ['Proveedor',      a.proveedor     || '—'],
        ['Astilladora',    a.astilladora   || '—'],
        ['Transportista',  a.transportista || '—'],
        ['Tipo de madera', a.tipoBiomasa   || '—'],
        ['Especie',        a.especie       || '—'],
        ['Origen',         a.origen        || '—'],
        ['Destino',        a.instalacion   || '—'],
        ['Permiso',        a.permiso       || '—'],
        ['Observaciones',  a.observaciones || '—'],
      ].filter(([, v]) => v !== '—').map(([k, v]) => (
        <div key={k} className="campo-row">
          <span className="campo-row-key">{k}</span>
          <span className="campo-row-val">{v}</span>
        </div>
      ))}
    </div>
  )

  const Topbar = ({ onBack }) => (
    <div className="campo-topbar">
      {onBack
        ? <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray-600)'}}><ArrowLeft size={18} /></button>
        : <div className="campo-topbar-logo"><Leaf size={14} color="#fff" /></div>
      }
      <div>
        <div className="campo-title">Albarán {a.id}</div>
        <div className="campo-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha?.split('-').reverse().join('/')}</div>
      </div>
    </div>
  )

  if (todoCompletado) return (
    <div className="campo-page">
      <div className="campo-success">
        <div className="campo-success-icon"><CheckCircle size={36} color="var(--green-400)" /></div>
        <div className="campo-success-title">¡Todo completado!</div>
        <div className="campo-success-sub">El equipo de Comsa Service ha sido notificado. Gracias.</div>
      </div>
    </div>
  )

  if (rolesDirectos && rolesDirectos.length > 0) {
    const rolActual = rolesDirectos[pasoActual]
    return (
      <div className="campo-page">
        <Topbar />
        {rolesDirectos.length > 1 && (
          <div style={{display:'flex',gap:6,marginBottom:14}}>
            {rolesDirectos.map((r, i) => (
              <div key={r} style={{flex:1,height:4,borderRadius:99,background: i <= pasoActual ? 'var(--green-400)' : 'var(--gray-200)',transition:'background 0.3s'}} />
            ))}
          </div>
        )}
        <DatosAlbaran />
        <PasoFirma
          rol={rolActual} a={a}
          updateFirma={updateFirma} subirTicketPesada={subirTicketPesada}
          onCompletado={handleCompletadoPaso}
          totalPasos={rolesDirectos.length} pasoActual={pasoActual + 1}
        />
      </div>
    )
  }

  if (!rolSeleccionado) return (
    <div className="campo-page">
      <Topbar />
      <DatosAlbaran />
      <div className="campo-card">
        <div className="campo-card-title">¿Quién eres?</div>
        <div className="rol-selector">
          {ROLES_SELECTOR.map(r => {
            const config    = ROLES_CONFIG[r]
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

  return (
    <div className="campo-page">
      <Topbar onBack={() => setRolSeleccionado(null)} />
      <DatosAlbaran />
      <PasoFirma
        rol={rolSeleccionado} a={a}
        updateFirma={updateFirma} subirTicketPesada={subirTicketPesada}
        onCompletado={() => setTodoCompletado(true)}
        totalPasos={1} pasoActual={1}
      />
    </div>
  )
}
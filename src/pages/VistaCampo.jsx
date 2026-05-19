import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Upload, Leaf, ArrowLeft, Truck, Factory, Building2, User } from 'lucide-react'
import '../components/shared.css'
import './VistaCampo.css'

// ── SignaturePad — fallback cuando la empresa no tiene sello registrado ──────
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const dibujando = useRef(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src  = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * (canvas.width  / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    }
  }
  const iniciar = (e) => {
    e.preventDefault()
    dibujando.current = true
    const cv = canvasRef.current, ctx = cv.getContext('2d')
    const p = getPos(e, cv)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const dibujar = (e) => {
    e.preventDefault()
    if (!dibujando.current) return
    const cv = canvasRef.current, ctx = cv.getContext('2d')
    const p = getPos(e, cv)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a3a8f'
    ctx.lineTo(p.x, p.y); ctx.stroke()
    if (!tieneTrazo) setTieneTrazo(true)
    onChange(cv.toDataURL('image/png'))
  }
  const parar = (e) => { e.preventDefault(); dibujando.current = false }
  const limpiar = () => {
    const cv = canvasRef.current
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
    setTieneTrazo(false); onChange(null)
  }

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={160}
        style={{border:'2px dashed #3b82f6',borderRadius:8,background:'#fff',
          touchAction:'none',cursor:'crosshair',display:'block',width:'100%'}}
        onMouseDown={iniciar} onMouseMove={dibujar} onMouseUp={parar} onMouseLeave={parar}
        onTouchStart={iniciar} onTouchMove={dibujar} onTouchEnd={parar}
      />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
        {tieneTrazo
          ? <button type="button" onClick={limpiar}
              style={{fontSize:12,color:'var(--gray-400)',background:'none',border:'none',cursor:'pointer',padding:0}}>
              × Borrar y repetir
            </button>
          : <span style={{fontSize:12,color:'#3b82f6'}}>✍ Firma aquí con el dedo o el ratón</span>
        }
      </div>
    </div>
  )
}

const ROLES_CONFIG = {
  proveedor:     { label: 'Proveedor',    sub: 'Confirma carga y firma',     icon: <User     size={18} color="#8b5cf6" />, color: '#8b5cf6', bg: '#f5f3ff' },
  astilladora:   { label: 'Astilladora',  sub: 'Confirma carga y firma',     icon: <Factory  size={18} color="#1D9E75" />, color: '#1D9E75', bg: '#f0faf5' },
  transportista: { label: 'Transportista',sub: 'Confirma transporte',        icon: <Truck    size={18} color="#3b82f6" />, color: '#3b82f6', bg: '#eff6ff' },
  instalacion:   { label: 'Instalación',  sub: 'Confirma recepción y firma', icon: <Building2 size={18} color="#f5a623" />, color: '#f5a623', bg: '#fffbf0' },
}

const ROLES_ORDEN = ['proveedor', 'astilladora', 'transportista', 'instalacion']

// ¿Este rol requiere firma de empresa?
const ROL_REQUIERE_FIRMA = { proveedor: true, astilladora: true, transportista: false, instalacion: true }

function PasoFirma({ rol, a, updateFirma, subirTicketPesada, onCompletado, totalPasos, pasoActual }) {
  const config    = ROLES_CONFIG[rol]
  const yaFirmado = a.firmas?.[rol]?.firmado

  // Nombre de la empresa para este rol
  const empresaNombre = rol === 'proveedor'     ? a.proveedor
                      : rol === 'astilladora'   ? a.astilladora
                      : rol === 'transportista' ? a.transportista
                      : a.instalacion
  const empresaFirmaUrl = a.empresaFirmaMap?.[empresaNombre] || null
  const requiereFirma   = ROL_REQUIERE_FIRMA[rol]

  // Firma dibujada (fallback cuando no hay sello registrado)
  const [firmaCanvas, setFirmaCanvas] = useState(null)

  // Campos comunes
  const [nombrePersona,     setNombrePersona]    = useState('')
  const [observaciones,     setObservaciones]    = useState('')
  const [matriculaTractora, setMatriculaTractora]= useState(a.matriculaTractora || '')
  const [matriculaRemolque, setMatriculaRemolque]= useState(a.matriculaRemolque || '')
  const [chofer,            setChofer]           = useState(a.chofer || '')
  const [pesoBruto,         setPesoBruto]        = useState(a.pesada?.entrada ? String(a.pesada.entrada) : '')
  const [tara,              setTara]             = useState(a.pesada?.salida  ? String(a.pesada.salida)  : '')
  const [humedad,           setHumedad]          = useState(a.pesada?.humedad ? String(a.pesada.humedad) : '')
  const [ticketNombre,      setTicketNombre]     = useState('')
  const [firmando,          setFirmando]         = useState(false)
  const [firmado,           setFirmado]          = useState(false)

  const pesoNeto = pesoBruto && tara
    ? (parseFloat(pesoBruto) - parseFloat(tara)).toLocaleString('es-ES') + ' kg' : null

  // Firma válida: tiene sello registrado O ha dibujado en el canvas
  const firmaOk = !requiereFirma || !!empresaFirmaUrl || !!firmaCanvas

  // Validación por rol
  const puedeConfirmar = (() => {
    if (!firmaOk) return false
    if (rol === 'proveedor')     return nombrePersona.trim().length > 0
    if (rol === 'astilladora')   return nombrePersona.trim().length > 0 && matriculaTractora.trim().length > 0
    if (rol === 'transportista') return chofer.trim().length > 0
    if (rol === 'instalacion')   return (pesoBruto.trim().length > 0 && tara.trim().length > 0)
    return true
  })()

  const handleFirmar = async () => {
    setFirmando(true)
    const firmaImagen = requiereFirma ? (empresaFirmaUrl || firmaCanvas || null) : null
    const pesadaData  = (rol === 'transportista' || rol === 'instalacion') && (pesoBruto || tara) ? {
      entrada: parseFloat(pesoBruto) || null,
      salida:  parseFloat(tara)      || null,
      humedad: parseFloat(humedad)   || null,
    } : null
    const campoData = (rol === 'astilladora' || rol === 'transportista') ? {
      matriculaTractora, matriculaRemolque,
      chofer: rol === 'transportista' ? chofer : null,
    } : null

    await updateFirma(a.id, rol, empresaNombre, nombrePersona || null, pesadaData, firmaImagen, campoData, observaciones.trim() || null)
    setFirmado(true)
    setFirmando(false)
    setTimeout(() => onCompletado(), 1200)
  }

  if (yaFirmado || firmado) return (
    <div className="campo-card" style={{textAlign:'center',padding:'24px 16px'}}>
      <CheckCircle size={32} color="var(--green-400)" style={{marginBottom:10}} />
      <div style={{fontSize:15,fontWeight:600,color:'var(--green-600)'}}>
        {firmado ? '¡Confirmado!' : 'Ya confirmado'}
      </div>
      <div style={{fontSize:12,color:'var(--gray-400)',marginTop:4}}>
        {firmado
          ? (pasoActual < totalPasos ? 'Pasando al siguiente paso...' : 'Completado')
          : a.firmas[rol]?.fecha
        }
      </div>
      {firmado && pasoActual < totalPasos && (
        <div style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontSize:13,color:'var(--green-600)'}}>
          <div style={{width:14,height:14,border:'2px solid var(--green-400)',borderTop:'2px solid transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />
          Cargando siguiente paso...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  )

  return (
    <div className="campo-card">
      {/* Cabecera del paso */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:12,borderBottom:'var(--border)'}}>
        <div style={{width:36,height:36,borderRadius:8,background:config.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {config.icon}
        </div>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:config.color}}>{config.label}</div>
          {totalPasos > 1 && <div style={{fontSize:11,color:'var(--gray-400)'}}>Paso {pasoActual} de {totalPasos}</div>}
        </div>
      </div>

      {/* ── PROVEEDOR ─────────────────────────────────── */}
      {rol === 'proveedor' && (
        <div className="campo-field">
          <label>Nombre y apellidos *</label>
          <input type="text" placeholder="Persona que confirma la carga" value={nombrePersona} onChange={e => setNombrePersona(e.target.value)} />
        </div>
      )}

      {/* ── ASTILLADORA ───────────────────────────────── */}
      {rol === 'astilladora' && (
        <>
          <div className="campo-field">
            <label>Nombre y apellidos *</label>
            <input type="text" placeholder="Persona presente en la carga" value={nombrePersona} onChange={e => setNombrePersona(e.target.value)} />
          </div>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'14px 0 10px'}}>
            Matrículas del vehículo
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="campo-field">
              <label>Tractora *</label>
              <input type="text" placeholder="Ej: 1234 ABC" value={matriculaTractora} onChange={e => setMatriculaTractora(e.target.value)} />
            </div>
            <div className="campo-field">
              <label>Remolque</label>
              <input type="text" placeholder="Ej: R-1234-ABC" value={matriculaRemolque} onChange={e => setMatriculaRemolque(e.target.value)} />
            </div>
          </div>
        </>
      )}

      {/* ── TRANSPORTISTA ─────────────────────────────── */}
      {rol === 'transportista' && (
        <>
          <div className="campo-field">
            <label>Nombre del chófer *</label>
            <input type="text" placeholder="Nombre completo del conductor" value={chofer} onChange={e => setChofer(e.target.value)} />
          </div>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'14px 0 10px'}}>
            Datos de pesada (opcional)
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
          <label className="upload-zona" style={{cursor:'pointer',marginBottom:10}}>
            <Upload size={16} />
            <span>{ticketNombre || 'Adjuntar ticket de pesada (opcional)'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
              onChange={async (e) => {
                const f = e.target.files[0]
                if (!f) return
                setTicketNombre(f.name)
                await subirTicketPesada(a.id, f, empresaNombre)
              }}
            />
          </label>
        </>
      )}

      {/* ── INSTALACIÓN (RECEPCIÓN) ────────────────────── */}
      {rol === 'instalacion' && (
        <>
          <div style={{background:'var(--blue-50)',border:'1px solid var(--blue-100)',borderRadius:'var(--radius-md)',padding:'10px 12px',fontSize:13,color:'var(--blue-700)',marginBottom:14}}>
            Introduce los datos de pesada en recepción y confirma.
          </div>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>
            Datos de pesada *
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="campo-field">
              <label>Peso bruto (kg) *</label>
              <input type="number" placeholder="Ej: 28400" value={pesoBruto} onChange={e => setPesoBruto(e.target.value)} />
            </div>
            <div className="campo-field">
              <label>Tara (kg) *</label>
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
            <label>Humedad (%) <span style={{fontWeight:400,color:'var(--gray-400)'}}>(opcional — se puede completar después)</span></label>
            <input type="number" step="0.1" placeholder="Ej: 28.4" value={humedad} onChange={e => setHumedad(e.target.value)} />
          </div>
          <label className="upload-zona" style={{cursor:'pointer',marginBottom:14}}>
            <Upload size={16} />
            <span>{ticketNombre || 'Adjuntar ticket de pesada (opcional)'}</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
              onChange={async (e) => {
                const f = e.target.files[0]
                if (!f) return
                setTicketNombre(f.name)
                await subirTicketPesada(a.id, f, empresaNombre)
              }}
            />
          </label>
        </>
      )}

      {/* ── OBSERVACIONES (opcional) ──────────────────────────────── */}
      <div className="campo-field" style={{marginBottom:14}}>
        <label>Observaciones <span style={{fontWeight:400,color:'var(--gray-400)'}}>(opcional)</span></label>
        <textarea
          placeholder="Incidencias, notas o comentarios sobre este paso..."
          value={observaciones}
          onChange={e => setObservaciones(e.target.value)}
          style={{width:'100%',padding:'8px 10px',borderRadius:'var(--radius-sm)',border:'1px solid var(--gray-200)',fontSize:13,resize:'vertical',minHeight:60,fontFamily:'inherit'}}
        />
      </div>

      {/* ── FIRMA / SELLO EMPRESA ─────────────────────────────────── */}
      {requiereFirma && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>
            Sello / Firma de {empresaNombre}
          </div>
          {empresaFirmaUrl ? (
            /* Sello digital registrado */
            <div style={{border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',padding:'12px 16px',textAlign:'center',background:'#fafafa'}}>
              <img
                src={empresaFirmaUrl} alt="Sello"
                style={{maxHeight:100,maxWidth:'100%',objectFit:'contain',
                  filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.15))'}}
              />
              <div style={{fontSize:11,color:'var(--green-600)',marginTop:8,fontWeight:500}}>
                ✓ Sello digital registrado · Se estampará al confirmar
              </div>
            </div>
          ) : (
            /* Fallback — SignaturePad */
            <div>
              <div style={{fontSize:13,color:'var(--gray-600)',marginBottom:10,padding:'8px 12px',background:'var(--blue-50)',border:'1px solid var(--blue-100)',borderRadius:8}}>
                Esta empresa no tiene sello digital. Por favor, firma a continuación para confirmar.
              </div>
              <SignaturePad onChange={setFirmaCanvas} />
            </div>
          )}
        </div>
      )}

      <button
        className="campo-btn-primary"
        disabled={!puedeConfirmar || firmando}
        onClick={handleFirmar}
      >
        {firmando
          ? <><div style={{width:14,height:14,border:'2px solid #fff',borderTop:'2px solid transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> Guardando...</>
          : <><CheckCircle size={16} /> {rol === 'instalacion' ? 'Confirmar recepción' : 'Confirmar y firmar'}</>
        }
      </button>
    </div>
  )
}

export default function VistaCampo({ albaranes, updateFirma, subirTicketPesada }) {
  const { id, roles: rolesParam } = useParams()
  const navigate = useNavigate()

  const [rolSeleccionado,   setRolSeleccionado]   = useState(null)
  const [pasoActual,        setPasoActual]         = useState(0)
  const [pasosCompletados,  setPasosCompletados]   = useState([])
  const [todoCompletado,    setTodoCompletado]     = useState(false)

  const a = albaranes.find(x => x.id === id)

  // Restaurar rol guardado en sessionStorage (evita re-selección si se recarga la página)
  useEffect(() => {
    if (!a || rolesParam) return
    const guardado = sessionStorage.getItem(`campo_rol_${id}`)
    if (guardado && ROLES_CONFIG[guardado] && a.firmas?.[guardado] && !a.firmas[guardado].firmado) {
      setRolSeleccionado(guardado)
    }
  }, [id, a, rolesParam])

  if (!a) return <div style={{padding:40,textAlign:'center',color:'#999'}}>Albarán no encontrado.</div>

  const seleccionarRol = (r) => {
    setRolSeleccionado(r)
    sessionStorage.setItem(`campo_rol_${id}`, r)
  }

  const rolesDirectos = rolesParam
    ? rolesParam.split(',').filter(r => ROLES_CONFIG[r])
    : null

  const ROLES_SELECTOR = ROLES_ORDEN.filter(r => a.firmas?.[r] !== undefined)

  const handleCompletadoPaso = (rolCompletado) => {
    sessionStorage.removeItem(`campo_rol_${id}`)
    setPasosCompletados(prev => [...prev, rolCompletado])
    if (rolesDirectos && pasoActual < rolesDirectos.length - 1) {
      setTimeout(() => setPasoActual(prev => prev + 1), 1400)
    } else {
      setTimeout(() => setTodoCompletado(true), 1400)
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
        <div className="campo-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha?.slice(0,10).split('-').reverse().join('/')}</div>
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

  // Flujo directo con roles en la URL
  if (rolesDirectos && rolesDirectos.length > 0) {
    return (
      <div className="campo-page">
        <Topbar />
        {rolesDirectos.length > 1 && (
          <div style={{display:'flex',gap:6,marginBottom:14}}>
            {rolesDirectos.map((r, i) => {
              const completado = pasosCompletados.includes(r)
              const activo     = i === pasoActual
              return (
                <div key={r} style={{flex:1,position:'relative'}}>
                  <div style={{height:4,borderRadius:99,background:completado?'var(--green-400)':activo?'var(--green-200)':'var(--gray-200)',transition:'background 0.3s',marginBottom:4}} />
                  <div style={{fontSize:10,color:completado?'var(--green-600)':activo?'var(--green-400)':'var(--gray-400)',textAlign:'center',fontWeight:activo?600:400}}>
                    {completado?'✓ ':''}{ROLES_CONFIG[r]?.label}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <DatosAlbaran />
        {rolesDirectos.map((r, i) => (
          i === pasoActual ? (
            <PasoFirma key={r} rol={r} a={a}
              updateFirma={updateFirma} subirTicketPesada={subirTicketPesada}
              onCompletado={() => handleCompletadoPaso(r)}
              totalPasos={rolesDirectos.length} pasoActual={i + 1}
            />
          ) : pasosCompletados.includes(r) ? (
            <div key={r} className="campo-card" style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px'}}>
              <CheckCircle size={20} color="var(--green-400)" />
              <div>
                <div style={{fontSize:13,fontWeight:600,color:'var(--green-600)'}}>{ROLES_CONFIG[r]?.label} — Confirmado</div>
                <div style={{fontSize:11,color:'var(--gray-400)'}}>Completado correctamente</div>
              </div>
            </div>
          ) : null
        ))}
      </div>
    )
  }

  // Flujo genérico — selector de rol
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
                onClick={() => !yaFirmado && seleccionarRol(r)}>
                <div className="rol-btn-left">
                  <div className="rol-btn-icon" style={{background: yaFirmado ? 'var(--gray-100)' : config.bg}}>
                    {yaFirmado ? <CheckCircle size={18} color="var(--green-400)" /> : config.icon}
                  </div>
                  <div>
                    <div className="rol-btn-label" style={{color: yaFirmado ? 'var(--gray-400)' : config.color}}>{config.label}</div>
                    <div className="rol-btn-sub">{yaFirmado ? `Confirmado · ${a.firmas[r]?.fecha}` : config.sub}</div>
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

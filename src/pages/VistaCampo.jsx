import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Upload, Leaf, ArrowLeft, Truck, Factory, Building2, User } from 'lucide-react'
import '../components/shared.css'
import './VistaCampo.css'


function normalizarTelefono(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const hasPrefix = trimmed.startsWith('+') || trimmed.startsWith('00')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  if (hasPrefix) {
    const ccLen = digits[0] === '1' ? 1 : 2
    const cc = digits.slice(0, ccLen)
    const rest = digits.slice(ccLen)
    const groups = []
    for (let i = 0; i < rest.length; i += 3) groups.push(rest.slice(i, i + 3))
    return `+${cc} ${groups.join(' ')}`
  }
  const groups = []
  for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3))
  return groups.join(' ')
}

const ROLES_CONFIG = {
  proveedor:     { label: 'Proveedor',    sub: 'Confirma carga y firma',     icon: <User     size={18} color="#8b5cf6" />, color: '#8b5cf6', bg: '#f5f3ff' },
  astilladora:   { label: 'Astilladora',  sub: 'Confirma carga y firma',     icon: <Factory  size={18} color="#1D9E75" />, color: '#1D9E75', bg: '#f0faf5' },
  transportista: { label: 'Transportista',sub: 'Confirma transporte',        icon: <Truck    size={18} color="#3b82f6" />, color: '#3b82f6', bg: '#eff6ff' },
  instalacion:   { label: 'Instalación',  sub: 'Confirma recepción y firma', icon: <Building2 size={18} color="#f5a623" />, color: '#f5a623', bg: '#fffbf0' },
}

const ROLES_ORDEN = ['proveedor', 'astilladora', 'transportista', 'instalacion']

// ¿Este rol requiere firma de empresa?
const ROL_REQUIERE_FIRMA = { proveedor: true, astilladora: false, transportista: false, instalacion: true }

function Placa({ texto }) {
  if (!texto) return null
  return (
    <span style={{fontFamily:'var(--font-mono)',background:'var(--gray-100)',border:'1px solid var(--gray-200)',
      padding:'4px 10px',borderRadius:6,fontSize:14,fontWeight:600,color:'var(--gray-800)',display:'inline-block'}}>
      {texto}
    </span>
  )
}

function VistaFirmadaInstalacion({ a }) {
  const [solicitando, setSolicitando] = useState(false)
  const [solicitado,  setSolicitado]  = useState(a.solicitaRevision || false)

  const pesoNeto = (a.pesada?.entrada && a.pesada?.salida)
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') : null

  const handleSolicitar = async () => {
    setSolicitando(true)
    try {
      await fetch(`/api/albaranes/${a.id}/solicitar-revision`, { method: 'POST' })
      setSolicitado(true)
    } catch {}
    setSolicitando(false)
  }

  return (
    <>
      {/* Confirmación */}
      <div className="campo-card" style={{textAlign:'center',padding:'18px 16px'}}>
        <CheckCircle size={28} color="var(--green-400)" style={{marginBottom:8}} />
        <div style={{fontSize:14,fontWeight:600,color:'var(--green-600)'}}>Recepción confirmada</div>
        {a.firmas?.instalacion?.fecha && (
          <div style={{fontSize:12,color:'var(--gray-400)',marginTop:3}}>{a.firmas.instalacion.fecha}</div>
        )}
      </div>

      {/* Pesada — lectura */}
      {(a.pesada?.entrada || a.pesada?.salida) && (
        <div className="campo-card">
          <div className="campo-card-title">Datos de pesada</div>
          {a.pesada.entrada && (
            <div className="campo-row">
              <span className="campo-row-key">Peso bruto</span>
              <span className="campo-row-val">{a.pesada.entrada.toLocaleString('es-ES')} kg</span>
            </div>
          )}
          {a.pesada.salida && (
            <div className="campo-row">
              <span className="campo-row-key">Tara</span>
              <span className="campo-row-val">{a.pesada.salida.toLocaleString('es-ES')} kg</span>
            </div>
          )}
          {pesoNeto && (
            <div className="campo-row">
              <span className="campo-row-key">Peso neto</span>
              <span className="campo-row-val" style={{color:'var(--green-600)',fontWeight:700}}>{pesoNeto} kg</span>
            </div>
          )}
          {a.pesada.humedad != null && (
            <div className="campo-row">
              <span className="campo-row-key">Humedad</span>
              <span className="campo-row-val">{a.pesada.humedad}%</span>
            </div>
          )}
        </div>
      )}

      {/* Solicitar revisión */}
      {solicitado ? (
        <div style={{padding:'12px 14px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'var(--radius-lg)',
          fontSize:13,color:'#92400e',display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
          ⚠ Solicitud de revisión enviada. El equipo de oficina la gestionará en breve.
        </div>
      ) : (
        <button onClick={handleSolicitar} disabled={solicitando}
          style={{width:'100%',padding:'13px',background:'none',border:'1.5px solid var(--gray-300)',
            borderRadius:'var(--radius-lg)',fontSize:14,color:'var(--gray-600)',cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.15s',marginBottom:12}}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--amber-400)'; e.currentTarget.style.color='#92400e' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-300)'; e.currentTarget.style.color='var(--gray-600)' }}
        >
          {solicitando ? '...' : '⚠ Notificar incidencia a oficina'}
        </button>
      )}
    </>
  )
}

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

  // Campos comunes
  const [nombrePersona,       setNombrePersona]      = useState('')
  const [telefonoPersona,     setTelefonoPersona]    = useState('')
  const [observaciones,       setObservaciones]      = useState('')
  const [matriculaTractora,    setMatriculaTractora]   = useState(a.matriculaTractora || '')
  const [matriculaRemolque,    setMatriculaRemolque]   = useState(a.matriculaRemolque || '')
  const [matriculaAstilladora, setMatriculaAstilladora] = useState(a.matriculaAstilladora || '')
  const [chofer,               setChofer]              = useState(a.chofer || '')
  const [pesoBruto,         setPesoBruto]        = useState(a.pesada?.entrada ? String(a.pesada.entrada) : '')
  const [tara,              setTara]             = useState(a.pesada?.salida  ? String(a.pesada.salida)  : '')
  const [humedad,           setHumedad]          = useState(a.pesada?.humedad ? String(a.pesada.humedad) : '')
  const [ticketNombre,      setTicketNombre]     = useState('')
  const [firmando,          setFirmando]         = useState(false)
  const [firmado,           setFirmado]          = useState(false)
  const [errorFirma,        setErrorFirma]       = useState('')

  const pesoNeto = pesoBruto && tara
    ? (parseFloat(pesoBruto) - parseFloat(tara)).toLocaleString('es-ES') + ' kg' : null

  // Firma válida: tiene sello registrado, o no se requiere (se confirma con IP)
  const firmaOk = !requiereFirma || !!empresaFirmaUrl

  // Validación por rol
  const puedeConfirmar = (() => {
    if (!firmaOk) return false
    if (rol === 'proveedor')     return nombrePersona.trim().length > 0
    if (rol === 'astilladora')   return nombrePersona.trim().length > 0 && matriculaTractora.trim().length > 0
    if (rol === 'transportista') return chofer.trim().length > 0
    if (rol === 'instalacion')   return pesoBruto.trim().length > 0 && tara.trim().length > 0
    return true
  })()

  const handleFirmar = async () => {
    setFirmando(true)
    setErrorFirma('')
    const firmaImagen = requiereFirma ? (empresaFirmaUrl || null) : null
    const pesadaData  = (rol === 'transportista' || rol === 'instalacion') && (pesoBruto || tara) ? {
      entrada: parseFloat(pesoBruto) || null,
      salida:  parseFloat(tara)      || null,
      humedad: parseFloat(humedad)   || null,
    } : null
    const campoData = (rol === 'astilladora' || rol === 'transportista') ? {
      matriculaTractora, matriculaRemolque,
      matriculaAstilladora: rol === 'astilladora' ? matriculaAstilladora : null,
      chofer: chofer || null,
    } : null

    try {
      await updateFirma(a.id, rol, empresaNombre, nombrePersona || null, pesadaData, firmaImagen, campoData, observaciones.trim() || null, normalizarTelefono(telefonoPersona) || null)
      setFirmado(true)
      if (rol !== 'instalacion') setTimeout(() => onCompletado(), 1200)
    } catch {
      setErrorFirma('Error al enviar la firma. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setFirmando(false)
    }
  }

  // Instalación firmada → vista lectura + solicitar revisión
  if (rol === 'instalacion' && (yaFirmado || firmado)) {
    return <VistaFirmadaInstalacion a={a} />
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
            Datos astilladora
          </div>
          <div className="campo-field">
            <label>Matrícula</label>
            <input type="text" placeholder="Ej: CS-1234-B" value={matriculaAstilladora} onChange={e => setMatriculaAstilladora(e.target.value)} />
          </div>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'14px 0 10px'}}>
            Datos camión
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="campo-field">
              <label>Matrícula tractora *</label>
              <input type="text" placeholder="Ej: 1234 ABC" value={matriculaTractora} onChange={e => setMatriculaTractora(e.target.value)} />
            </div>
            <div className="campo-field">
              <label>Matrícula remolque</label>
              <input type="text" placeholder="Ej: R-1234-ABC" value={matriculaRemolque} onChange={e => setMatriculaRemolque(e.target.value)} />
            </div>
          </div>
          <div className="campo-field" style={{marginTop:4}}>
            <label>Conductor <span style={{fontWeight:400,color:'var(--gray-400)'}}>(opcional)</span></label>
            <input type="text" placeholder="Nombre completo del conductor" value={chofer} onChange={e => setChofer(e.target.value)} />
          </div>
        </>
      )}

      {/* ── TRANSPORTISTA ─────────────────────────────── */}
      {rol === 'transportista' && (
        <>
          <div className="campo-field">
            <label>Nombre *</label>
            <input type="text" placeholder="Nombre completo del conductor" value={chofer} onChange={e => setChofer(e.target.value)} />
          </div>
          <div className="campo-field">
            <label>Teléfono</label>
            <input type="tel" placeholder="Ej: 623 456 789" value={telefonoPersona}
              onChange={e => setTelefonoPersona(e.target.value)}
              onBlur={e => setTelefonoPersona(normalizarTelefono(e.target.value))}
            />
          </div>
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
            <label>Humedad (%) <span style={{fontWeight:400,color:'var(--gray-400)'}}>(opcional)</span></label>
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

      {/* ── SELLO EMPRESA (solo si está registrado) ───────────────── */}
      {requiereFirma && empresaFirmaUrl && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>
            Sello de {empresaNombre}
          </div>
          <div style={{border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',padding:'12px 16px',textAlign:'center',background:'#fafafa'}}>
            <img src={empresaFirmaUrl} alt="Sello"
              style={{maxHeight:100,maxWidth:'100%',objectFit:'contain',filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.15))'}}
            />
            <div style={{fontSize:11,color:'var(--green-600)',marginTop:8,fontWeight:500}}>
              ✓ Sello digital · Se estampará al confirmar
            </div>
          </div>
        </div>
      )}

      {errorFirma && (
        <div style={{padding:'10px 12px',background:'#fff1f1',border:'1px solid #fca5a5',borderRadius:8,color:'#b91c1c',fontSize:13,marginBottom:12}}>
          {errorFirma}
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

  // URL del panel de origen para volver tras firmar
  const rolesDirectos = rolesParam ? rolesParam.split(',').filter(r => ROLES_CONFIG[r]) : null
  const esInstalacionSola = rolesDirectos?.length === 1 && rolesDirectos[0] === 'instalacion'
  const esAstilladoraSola = rolesDirectos?.length === 1 && rolesDirectos[0] === 'astilladora'
  const panelUrl = (() => {
    if ((esInstalacionSola || rolSeleccionado === 'instalacion') && a?.instalacion)
      return `/campo/instalacion/${a.instalacion.replace(/\s+/g, '-')}?desde=${id}`
    if ((esAstilladoraSola || rolSeleccionado === 'astilladora') && a?.astilladora)
      return `/campo/astilladora/${a.astilladora.replace(/\s+/g, '-')}?desde=${id}`
    return null
  })()

  // Restaurar rol guardado en sessionStorage (evita re-selección si se recarga la página)
  useEffect(() => {
    if (!a || rolesParam) return
    const guardado = sessionStorage.getItem(`campo_rol_${id}`)
    if (guardado && ROLES_CONFIG[guardado] && a.firmas?.[guardado] && !a.firmas[guardado].firmado) {
      setRolSeleccionado(guardado)
    }
  }, [id, a, rolesParam])

  if (!a) return <div style={{padding:40,textAlign:'center',color:'#999'}}>Albarán no encontrado.</div>

  if (a.estado === 'cerrado') return (
    <div className="campo-page">
      <div className="campo-success">
        <div className="campo-success-icon"><CheckCircle size={36} color="var(--green-400)" /></div>
        <div className="campo-success-title">Albarán cerrado</div>
        <div className="campo-success-sub">Este albarán ya tiene todas las firmas completadas. No es necesaria ninguna acción.</div>
      </div>
    </div>
  )

  const seleccionarRol = (r) => {
    setRolSeleccionado(r)
    sessionStorage.setItem(`campo_rol_${id}`, r)
  }

  const ROLES_SELECTOR = ROLES_ORDEN.filter(r => a.firmas?.[r] !== undefined)

  const handleCompletadoPaso = (rolCompletado) => {
    sessionStorage.removeItem(`campo_rol_${id}`)
    setPasosCompletados(prev => [...prev, rolCompletado])
    if (rolesDirectos && pasoActual < rolesDirectos.length - 1) {
      setTimeout(() => setPasoActual(prev => prev + 1), 1400)
    } else if (rolCompletado !== 'instalacion') {
      setTimeout(() => setTodoCompletado(true), 1400)
    }
    // instalacion: se queda en la vista de lectura (yaFirmado)
  }

  const DatosAlbaran = () => (
    <div style={{marginBottom:12}}>
      {/* Bloque transporte — protagonista */}
      <div className="campo-card" style={{marginBottom:8}}>
        <div className="campo-card-title">Transporte</div>
        {a.transportista && (
          <div style={{fontSize:16,fontWeight:700,color:'var(--gray-900)',marginBottom:10}}>{a.transportista}</div>
        )}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom: a.chofer ? 8 : 0}}>
          <Placa texto={a.matriculaTractora} />
          <Placa texto={a.matriculaRemolque} />
        </div>
        {a.chofer && (
          <div style={{fontSize:13,color:'var(--gray-500)',marginTop:6}}>Conductor: {a.chofer}</div>
        )}
        {!a.transportista && !a.matriculaTractora && (
          <div style={{fontSize:13,color:'var(--gray-400)'}}>Datos de transporte pendientes de confirmar</div>
        )}
      </div>

      {/* Ruta */}
      <div className="campo-card" style={{marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,fontWeight:600,color:'var(--gray-400)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2}}>Origen</div>
            <div style={{fontSize:13,fontWeight:500,color:'var(--gray-800)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {a.astilladora || a.proveedor || a.origen || '—'}
            </div>
          </div>
          <div style={{color:'var(--gray-300)',fontSize:18,flexShrink:0}}>→</div>
          <div style={{flex:1,minWidth:0,textAlign:'right'}}>
            <div style={{fontSize:10,fontWeight:600,color:'var(--green-600)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2}}>Destino</div>
            <div style={{fontSize:13,fontWeight:500,color:'var(--gray-800)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {a.instalacion || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Biomasa — compacto */}
      {(a.especie || a.tipoBiomasa || a.estella) && (
        <div className="campo-card">
          <div style={{fontSize:11,fontWeight:600,color:'var(--gray-400)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Biomasa</div>
          <div style={{fontSize:13,color:'var(--gray-700)'}}>
            {[a.especie, a.tipoBiomasa, a.estella].filter(Boolean).join(' · ')}
          </div>
        </div>
      )}
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

  if (todoCompletado) {
    if (panelUrl) {
      navigate(panelUrl, { replace: true })
      return null
    }
    return (
      <div className="campo-page">
        <div className="campo-success">
          <div className="campo-success-icon"><CheckCircle size={36} color="var(--green-400)" /></div>
          <div className="campo-success-title">¡Todo completado!</div>
          <div className="campo-success-sub">El equipo de Comsa Service ha sido notificado. Gracias.</div>
        </div>
      </div>
    )
  }

  // Flujo directo con roles en la URL
  if (rolesDirectos && rolesDirectos.length > 0) {
    return (
      <div className="campo-page">
        <Topbar onBack={panelUrl ? () => navigate(panelUrl) : undefined} />
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
        onCompletado={() => rolSeleccionado !== 'instalacion' && setTodoCompletado(true)}
        totalPasos={1} pasoActual={1}
      />
    </div>
  )
}

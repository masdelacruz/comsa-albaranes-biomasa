import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExternalLink, CheckCircle, Clock, FileDown, Upload, Eye, FileText, AlertTriangle, Copy, Pencil, X, Check, Trash2, MapPin, Share2, Truck, RotateCcw } from 'lucide-react'
import { Badge } from '../components/Badge'
import { generarPDF, generarPDFA5 } from '../utils/generarPDF'
import { api } from '../lib/api'
import { ESPECIES, TIPOS_BIOMASA } from '../data/mockData'
import '../components/shared.css'
import './DetalleAlbaran.css'

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

const ORDEN_FIRMAS = ['proveedor', 'astilladora', 'transportista', 'instalacion', 'oficina']

const FIRMA_LABELS = {
  proveedor:     'Proveedor',
  astilladora:   'Astilladora',
  transportista: 'Transportista',
  instalacion:   'Instalación',
  oficina:       'Oficina',
}

const TIPOS_OP = ['Opción 1 — Compra en monte / plataforma', 'Opción 2 — Proveedor directo']

function BannerRevision({ albaranId, onReabrir }) {
  const [reabriendo, setReabriendo] = useState(false)

  const handleReabrir = async () => {
    setReabriendo(true)
    try {
      await api.delete(`/albaranes/${albaranId}/solicitar-revision`)
      await onReabrir()
    } catch {}
    setReabriendo(false)
  }

  return (
    <div style={{margin:'0 0 16px',padding:'12px 16px',background:'#fffbeb',border:'1px solid #fde68a',
      borderRadius:'var(--radius-lg)',display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:18,flexShrink:0}}>⚠</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:'#92400e'}}>Solicitud de revisión desde campo</div>
        <div style={{fontSize:12,color:'#a16207',marginTop:2}}>El equipo de campo ha notificado una incidencia. Reabre el albarán para que puedan corregirlo.</div>
      </div>
      <button onClick={handleReabrir} disabled={reabriendo}
        style={{padding:'6px 12px',background:'#92400e',color:'#fff',border:'none',borderRadius:'var(--radius-md)',
          fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0,opacity:reabriendo?0.6:1,whiteSpace:'nowrap'}}>
        {reabriendo ? '...' : 'Reabrir para campo'}
      </button>
    </div>
  )
}

export default function DetalleAlbaran({ albaranes, simularFirma, updateFirma, subirDocumento, subirTicketPesada, actualizarAlbaran, borrarAlbaran, reabrirAlbaran, usuario, refetch }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRefs    = useRef({})
  const ticketRef   = useRef(null)
  const [subiendo, setSubiendo]             = useState({})
  const [subiendoTicket, setSubiendoTicket] = useState(false)
  const [confirmModal, setConfirmModal]     = useState(null)
  const [copiado, setCopiado]               = useState('')
  const [dragOverDoc, setDragOverDoc]       = useState(null)   // nombre del doc sobre el que se arrastra
  const [dragOverTicket, setDragOverTicket] = useState(false)
  const [pdfMenuOpen, setPdfMenuOpen]       = useState(false)

  const [editandoDatos,  setEditandoDatos]  = useState(false)
  const [editandoPesada, setEditandoPesada] = useState(false)
  const [formDatos,  setFormDatos]  = useState({})
  const [formPesada, setFormPesada] = useState({})
  const [guardando,  setGuardando]  = useState(false)
  const [toast,      setToast]      = useState('')
  const [confirmBorrar, setConfirmBorrar]   = useState(false)
  const [firmaOficinaModal, setFirmaOficinaModal] = useState(false)
  const [firmandoOficina, setFirmandoOficina]     = useState(false)
  const [confirmReabrir,  setConfirmReabrir]      = useState(false)
  const [reabriendo,      setReabriendo]          = useState(false)

  const mostrarToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const [proveedores,    setProveedores]    = useState([])
  const [astilladoras,   setAstilladoras]   = useState([])
  const [transportistas, setTransportistas] = useState([])
  const [instalaciones,  setInstalaciones]  = useState([])
  const [todasEmpresas,  setTodasEmpresas]  = useState([])
  const [tiposBiomasa,   setTiposBiomasa]   = useState(TIPOS_BIOMASA)
  const [especiesTipo,   setEspeciesTipo]   = useState(['Pinus SP','Otros'])
  const [estellas,       setEstellas]       = useState(ESPECIES)

  useEffect(() => {
    api.get('/empresas?activo=true').then(data => {
      const d = data || []
      setTodasEmpresas(d)
      setProveedores(   d.filter(p => p.tipo === 'proveedor'   ).map(p => p.nombre))
      setAstilladoras(  d.filter(p => p.tipo === 'astilladora' ).map(p => p.nombre))
      setTransportistas(d.filter(p => p.tipo === 'transportista').map(p => p.nombre))
      setInstalaciones( d.filter(p => p.tipo === 'instalacion' ).map(p => p.nombre))
    }).catch(() => {})
    api.get('/elementos').then(data => {
      if (data?.tipoBiomasa?.length) setTiposBiomasa(data.tipoBiomasa.map(e => e.valor))
      if (data?.especie?.length)     setEspeciesTipo(data.especie.map(e => e.valor))
      if (data?.estella?.length)     setEstellas(data.estella.map(e => e.valor))
    }).catch(() => {})
  }, [])

  const a = albaranes.find(x => x.id === id)
  if (!a) return <div style={{padding:40,color:'var(--gray-400)'}}>Albarán no encontrado.</div>

  const esSuperadmin = usuario?.nivel === 'superadmin'
  const puedeEditar  = esSuperadmin || a.estado !== 'cerrado'

  // Info de flota
  const flotaAlbaranes = a.grupoId
    ? albaranes.filter(x => x.grupoId === a.grupoId).sort((x, y) => (x.camionOrden || 1) - (y.camionOrden || 1))
    : []
  const esFlota = flotaAlbaranes.length > 1

  const pesoNeto = a.pesada?.entrada && a.pesada?.salida
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '—'

  const firmasOrdenadas = ORDEN_FIRMAS.filter(k => a.firmas?.[k])

  const getSiguientePaso = () => {
    // Solo roles externos (no oficina) pendientes
    const pendientes = firmasOrdenadas.filter(k => k !== 'oficina' && !a.firmas[k]?.firmado)
    if (pendientes.length === 0) return null
    // Agrupa roles consecutivos del mismo actor en un único enlace
    const primero = pendientes[0]
    const actorPrimero = a.firmas[primero]?.actor
    const rolesGrupo = [primero]
    for (let i = 1; i < pendientes.length; i++) {
      const rol = pendientes[i]
      const esConsecutivo = firmasOrdenadas.indexOf(rol) === firmasOrdenadas.indexOf(pendientes[i - 1]) + 1
      if (esConsecutivo && a.firmas[rol]?.actor === actorPrimero) rolesGrupo.push(rol)
      else break
    }
    return rolesGrupo.join(',')
  }

  // ¿Puede la oficina firmar ahora? (todos los externos firmados, oficina pendiente)
  const puedeOficinaFirmar = a.firmas?.oficina && !a.firmas.oficina.firmado &&
    firmasOrdenadas.filter(k => k !== 'oficina').every(k => a.firmas?.[k]?.firmado)

  const siguientePaso    = getSiguientePaso()
  // Instalación accede siempre al panel de flota, no a un albarán individual
  const urlSiguientePaso = siguientePaso
    ? siguientePaso === 'instalacion'
      ? `${window.location.origin}/campo/instalacion/${encodeURIComponent(a.instalacion)}`
      : `${window.location.origin}/campo/${a.id}/${siguientePaso}`
    : null

  const getRolLabel = (roles) => {
    if (!roles) return ''
    return roles.split(',').map(r => FIRMA_LABELS[r] || r).join(' + ')
  }

  const copiar = (texto, clave) => {
    navigator.clipboard.writeText(texto)
    setCopiado(clave)
    setTimeout(() => setCopiado(''), 2000)
  }

  const getFirmasASimular = (rol) => {
    const idx = firmasOrdenadas.indexOf(rol)
    return firmasOrdenadas.slice(0, idx).filter(k => !a.firmas[k]?.firmado)
  }

  const handleSimularFirma = async (rol) => {
    const todasAFirmar = [...getFirmasASimular(rol), rol]
    for (const r of todasAFirmar) {
      const actorEmpresa = a.firmas?.[r]?.actor || r
      await updateFirma(a.id, r, actorEmpresa, `${usuario?.nombre || 'Oficina'} (simulado)`)
    }
    setConfirmModal(null)
  }

  const handleFirmarOficina = async () => {
    setFirmandoOficina(true)
    try {
      await updateFirma(a.id, 'oficina', usuario?.nombre || 'Oficina', usuario?.nombre || null)
      setFirmaOficinaModal(false)
      mostrarToast('Albarán firmado y cerrado ✓')
    } catch {
      mostrarToast('Error al firmar. Inténtalo de nuevo.')
    } finally {
      setFirmandoOficina(false)
    }
  }

  const handleReabrir = async () => {
    setReabriendo(true)
    try {
      await reabrirAlbaran(a.id)
      setConfirmReabrir(false)
      mostrarToast('Albarán reabierto ✓')
    } catch {
      mostrarToast('Error al reabrir. Inténtalo de nuevo.')
    } finally {
      setReabriendo(false)
    }
  }

  const subirDoc = async (docNombre, fichero) => {
    if (!fichero) return
    setSubiendo(prev => ({ ...prev, [docNombre]: true }))
    try { await subirDocumento(a.id, docNombre, fichero) }
    finally { setSubiendo(prev => ({ ...prev, [docNombre]: false })) }
  }

  const handleSubirDoc = async (docNombre, e) => {
    await subirDoc(docNombre, e.target.files[0])
    e.target.value = ''
  }

  const handleDropDoc = (docNombre, e) => {
    e.preventDefault()
    setDragOverDoc(null)
    subirDoc(docNombre, e.dataTransfer.files?.[0])
  }

  const subirTicket = async (fichero) => {
    if (!fichero) return
    setSubiendoTicket(true)
    try { await subirTicketPesada(a.id, fichero) }
    finally { setSubiendoTicket(false) }
  }

  const handleSubirTicket = async (e) => {
    await subirTicket(e.target.files[0])
    e.target.value = ''
  }

  const handleDropTicket = (e) => {
    e.preventDefault()
    setDragOverTicket(false)
    subirTicket(e.dataTransfer.files?.[0])
  }

  const formatBytes = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const iniciarEditDatos = () => {
    setFormDatos({
      tipo:              a.tipo              || '',
      certificacion:     Array.isArray(a.certificacion) ? a.certificacion.join(',') : (a.certificacion || ''),
      proveedor:         a.proveedor         || '',
      astilladora:       a.astilladora       || '',
      transportista:     a.transportista     || '',
      instalacion:       a.instalacion       || '',
      especie:           a.especie           || '',
      tipoBiomasa:       a.tipoBiomasa       || '',
      estella:           a.estella           || '',
      origen:            a.origen            || '',
      mapsOrigen:        a.mapsOrigen        || '',
      mapsDestino:       a.mapsDestino       || '',
      permiso:           a.permiso           || '',
      chofer:               a.chofer               || '',
      matriculaAstilladora: a.matriculaAstilladora || '',
      matriculaTractora:    a.matriculaTractora    || '',
      matriculaRemolque:    a.matriculaRemolque    || '',
      observaciones:     a.observaciones     || '',
    })
    setEditandoDatos(true)
  }

  const guardarDatos = async () => {
    setGuardando(true)
    try {
      await actualizarAlbaran(a.id, {
        tipo:               formDatos.tipo              || null,
        certificacion:      formDatos.certificacion     || null,
        proveedor:          formDatos.proveedor         || null,
        astilladora:        formDatos.astilladora       || null,
        transportista:      formDatos.transportista     || null,
        instalacion:        formDatos.instalacion       || null,
        especie:            formDatos.especie           || null,
        tipo_biomasa:       formDatos.tipoBiomasa       || null,
        estella:            formDatos.estella           || null,
        origen:             formDatos.origen            || null,
        maps_origen:        formDatos.mapsOrigen        || null,
        maps_destino:       formDatos.mapsDestino       || null,
        permiso:            formDatos.permiso           || null,
        chofer:                formDatos.chofer               || null,
        matricula_astilladora: formDatos.matriculaAstilladora || null,
        matricula_tractora:    formDatos.matriculaTractora    || null,
        matricula_remolque:    formDatos.matriculaRemolque    || null,
        observaciones:      formDatos.observaciones     || null,
      }, null, 'Datos del albarán editados')
      setEditandoDatos(false)
      mostrarToast('Datos del albarán actualizados')
    } finally {
      setGuardando(false)
    }
  }

  const iniciarEditPesada = () => {
    setFormPesada({
      entrada: a.pesada?.entrada ?? '',
      salida:  a.pesada?.salida  ?? '',
      humedad: a.pesada?.humedad ?? '',
    })
    setEditandoPesada(true)
  }

  const guardarPesada = async () => {
    setGuardando(true)
    try {
      await actualizarAlbaran(a.id, {}, {
        entrada: formPesada.entrada !== '' ? Number(formPesada.entrada) : null,
        salida:  formPesada.salida  !== '' ? Number(formPesada.salida)  : null,
        humedad: formPesada.humedad !== '' ? Number(formPesada.humedad) : null,
      }, 'Datos de pesada editados')
      setEditandoPesada(false)
      mostrarToast('Datos de pesada actualizados')
    } finally {
      setGuardando(false)
    }
  }

  const setD = (k, v) => setFormDatos(p => ({ ...p, [k]: v }))
  const setP = (k, v) => setFormPesada(p => ({ ...p, [k]: v }))

  // Empresa del siguiente paso (para pre-rellenar destinatario en WhatsApp y Email)
  const primerRol     = siguientePaso?.split(',')[0]
  const actorNombre   = primerRol ? a.firmas[primerRol]?.actor : null
  const actorEmpresa  = todasEmpresas.find(e => e.nombre === actorNombre)
  const actorEmail    = actorEmpresa?.email    || null
  // Limpia el teléfono a solo dígitos; si empieza por 6/7 asume España (+34)
  const rawTel        = actorEmpresa?.telefono || ''
  const actorTelefono = rawTel
    ? rawTel.replace(/[\s\-().]/g, '').replace(/^\+/, '').replace(/^0034/, '34').replace(/^(?=[67])/, '34')
    : ''

  const compartirUrl = (url, medio) => {
    const empresa = actorNombre || a.astilladora || a.proveedor || ''
    if (medio === 'whatsapp') {
      const msg = encodeURIComponent(
        `Hola ${empresa},\n\n` +
        `Te enviamos el enlace de firma para el albarán #${a.id}:\n` +
        `• Especie: ${a.especie || '—'}\n` +
        `• Origen: ${a.origen || '—'}\n` +
        `• Destino: ${a.instalacion}\n\n` +
        `Accede aquí para firmar:\n${url}`
      )
      window.open(`https://wa.me/${actorTelefono}?text=${msg}`, '_blank')
    }
    if (medio === 'email') {
      const subject = encodeURIComponent(`Firma pendiente — Albarán #${a.id} · Comsa Service`)
      const body    = encodeURIComponent(
        `Hola ${empresa},\n\n` +
        `Te solicitamos la firma del siguiente albarán de biomasa:\n\n` +
        `   Nº albarán : #${a.id}\n` +
        `   Especie    : ${a.especie || '—'}\n` +
        `   Origen     : ${a.origen || '—'}\n` +
        `   Destino    : ${a.instalacion}\n\n` +
        `Accede al formulario de firma en el siguiente enlace:\n` +
        `${url}\n\n` +
        `Gracias por tu colaboración.\n\n` +
        `Comsa Service — Gestión de Albaranes de Biomasa\n` +
        `biomasa.cserintranet.com`
      )
      window.open(`mailto:${actorEmail || ''}?subject=${subject}&body=${body}`, '_blank')
    }
    if (medio === 'copiar') copiar(url, 'siguiente')
  }

  return (
    <>
    <div className="detalle-page">
      {toast && (
        <div className="toast-guardado">
          <CheckCircle size={14} /> {toast}
        </div>
      )}
      {confirmModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,maxWidth:400,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
              <AlertTriangle size={20} color="var(--amber-400)" />
              <div style={{fontSize:15,fontWeight:600}}>Confirmar firma simulada</div>
            </div>
            {getFirmasASimular(confirmModal).length > 0 && (
              <div style={{background:'var(--amber-50)',border:'1px solid var(--amber-100)',borderRadius:'var(--radius-md)',padding:'10px 12px',marginBottom:14,fontSize:13,color:'var(--amber-700)'}}>
                Se firmarán automáticamente las etapas anteriores:
                <strong> {getFirmasASimular(confirmModal).map(k => FIRMA_LABELS[k]).join(', ')}</strong>
              </div>
            )}
            <p style={{fontSize:13,color:'var(--gray-600)',marginBottom:20}}>
              ¿Confirmas la firma de <strong>{FIRMA_LABELS[confirmModal]}</strong> como <strong>{usuario?.nombre || 'Oficina'}</strong>?
            </p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => handleSimularFirma(confirmModal)}>
                <CheckCircle size={14} /> Confirmar y firmar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div className="page-title" style={{fontFamily:'var(--font-mono)',fontSize:18}}>{a.id}</div>
            <Badge estado={a.estado} />
            {esFlota && (
              <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:99,background:'var(--blue-50)',border:'1px solid var(--blue-100)',fontSize:12,fontWeight:600,color:'var(--blue-700)'}}>
                <Truck size={12} /> Camión {a.camionOrden || 1} de {flotaAlbaranes.length}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:8}}>
            {esSuperadmin && a.estado === 'cerrado' && (
              <button className="btn" style={{color:'var(--blue-600)',borderColor:'var(--blue-100)'}} onClick={() => setConfirmReabrir(true)}>
                <RotateCcw size={14} /> Reabrir
              </button>
            )}
            {a.certificacion?.includes('SURE') ? (
              <div style={{position:'relative'}}>
                <button className="btn" onClick={() => setPdfMenuOpen(o => !o)}>
                  <FileDown size={15} /> Descargar PDF ▾
                </button>
                {pdfMenuOpen && (
                  <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:'#fff',border:'var(--border)',borderRadius:'var(--radius-md)',boxShadow:'0 4px 16px rgba(0,0,0,0.1)',zIndex:50,minWidth:220}}>
                    <button style={{display:'block',width:'100%',padding:'9px 14px',textAlign:'left',background:'none',border:'none',cursor:'pointer',fontSize:13}}
                      onClick={() => { generarPDF(a); setPdfMenuOpen(false) }}>
                      <FileDown size={13} style={{marginRight:6}} /> Solo albarán
                    </button>
                    <button style={{display:'block',width:'100%',padding:'9px 14px',textAlign:'left',background:'none',border:'none',fontSize:13,
                      cursor: a.pesada?.ticketAdjunto ? 'pointer' : 'not-allowed',
                      color: a.pesada?.ticketAdjunto ? 'inherit' : 'var(--gray-400)'}}
                      disabled={!a.pesada?.ticketAdjunto}
                      onClick={() => { if(a.pesada?.ticketAdjunto){ generarPDF(a, { includeTicket: true }); setPdfMenuOpen(false) } }}>
                      <FileDown size={13} style={{marginRight:6}} /> Albarán + ticket pesada
                      {!a.pesada?.ticketAdjunto && <span style={{fontSize:11,marginLeft:6}}>(sin ticket)</span>}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn" onClick={() => generarPDF(a)}>
                <FileDown size={15} /> Descargar PDF
              </button>
            )}
            {esSuperadmin && (
              <button className="btn" style={{color:'var(--red-400)',borderColor:'var(--red-100)'}} onClick={() => setConfirmBorrar(true)}>
                <Trash2 size={15} /> Borrar
              </button>
            )}
          </div>
        </div>
        <div className="page-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha?.slice(0,10).split('-').reverse().join('/')}{a.hora ? ` · ${a.hora} h` : ''}</div>
      </div>

      {/* Banner solicitud de revisión */}
      {a.solicitaRevision && (
        <BannerRevision albaranId={a.id} onReabrir={async () => { await refetch?.(); mostrarToast('Albarán reabierto para campo ✓') }} />
      )}

      <div className="detalle-content">
        <div className="detalle-cols">
          <div className="detalle-left">

            {/* ── DATOS DEL ALBARÁN ── */}
            <div className="card" style={{marginBottom:14}}>
              <div className="section-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                Datos del albarán
                {puedeEditar && !editandoDatos && (
                  <button className="btn-edit-section" onClick={iniciarEditDatos} title="Editar datos">
                    <Pencil size={12} />
                  </button>
                )}
                {editandoDatos && (
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn btn-primary" style={{fontSize:11,padding:'3px 8px'}} onClick={guardarDatos} disabled={guardando}>
                      <Check size={11} /> Guardar
                    </button>
                    <button className="btn" style={{fontSize:11,padding:'3px 8px'}} onClick={() => setEditandoDatos(false)} disabled={guardando}>
                      <X size={11} /> Cancelar
                    </button>
                  </div>
                )}
              </div>

              {editandoDatos ? (
                <div className="edit-grid">
                  <div className="edit-field">
                    <label className="edit-label">Tipo operación</label>
                    <select className="edit-input" value={formDatos.tipo} onChange={e => setD('tipo', e.target.value)}>
                      {TIPOS_OP.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Certificación</label>
                    <div style={{display:'flex',gap:12,paddingTop:5}}>
                      {['SURE','PEFC'].map(cert => (
                        <label key={cert} style={{display:'flex',alignItems:'center',gap:5,fontSize:13,cursor:'pointer',color:'var(--gray-700)'}}>
                          <input
                            type="checkbox"
                            checked={formDatos.certificacion?.includes(cert) || false}
                            onChange={e => {
                              const actual = formDatos.certificacion ? formDatos.certificacion.split(',').filter(Boolean) : []
                              const nueva  = e.target.checked ? [...actual, cert] : actual.filter(c => c !== cert)
                              setD('certificacion', nueva.join(','))
                            }}
                            style={{width:14,height:14,accentColor:'var(--green-400)',cursor:'pointer'}}
                          />
                          {cert}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Proveedor</label>
                    <select className="edit-input" value={formDatos.proveedor} onChange={e => setD('proveedor', e.target.value)}>
                      <option value="">—</option>
                      {proveedores.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Astilladora</label>
                    <select className="edit-input" value={formDatos.astilladora} onChange={e => setD('astilladora', e.target.value)}>
                      <option value="">—</option>
                      {astilladoras.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  )}
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Transportista</label>
                    <select className="edit-input" value={formDatos.transportista} onChange={e => setD('transportista', e.target.value)}>
                      <option value="">—</option>
                      {transportistas.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  )}
                  <div className="edit-field">
                    <label className="edit-label">Instalación</label>
                    <select className="edit-input" value={formDatos.instalacion} onChange={e => setD('instalacion', e.target.value)}>
                      <option value="">—</option>
                      {instalaciones.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Especie</label>
                    <select className="edit-input" value={formDatos.especie || ''} onChange={e => setD('especie', e.target.value)}>
                      <option value="">—</option>
                      {especiesTipo.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Tipo biomasa</label>
                    <select className="edit-input" value={formDatos.tipoBiomasa || ''} onChange={e => setD('tipoBiomasa', e.target.value)}>
                      <option value="">—</option>
                      {tiposBiomasa.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Estella</label>
                    <select className="edit-input" value={formDatos.estella || ''} onChange={e => setD('estella', e.target.value)}>
                      <option value="">—</option>
                      {estellas.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Origen</label>
                    <input className="edit-input" value={formDatos.origen} onChange={e => setD('origen', e.target.value)} placeholder="Paraje / término municipal" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Maps origen</label>
                    <input className="edit-input" type="url" value={formDatos.mapsOrigen} onChange={e => setD('mapsOrigen', e.target.value)} placeholder="https://maps.google.com/..." />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Maps destino</label>
                    <input className="edit-input" type="url" value={formDatos.mapsDestino} onChange={e => setD('mapsDestino', e.target.value)} placeholder="https://maps.google.com/..." />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Permiso / Ref.</label>
                    <input className="edit-input" value={formDatos.permiso} onChange={e => setD('permiso', e.target.value)} placeholder="Nº permiso o SURE" />
                  </div>
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Matrícula astilladora</label>
                    <input className="edit-input" value={formDatos.matriculaAstilladora || ''} onChange={e => setD('matriculaAstilladora', e.target.value)} placeholder="Ej: CS-1234-B" />
                  </div>
                  )}
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Chófer</label>
                    <input className="edit-input" value={formDatos.chofer} onChange={e => setD('chofer', e.target.value)} placeholder="Nombre" />
                  </div>
                  )}
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Matrícula tractora</label>
                    <input className="edit-input" value={formDatos.matriculaTractora} onChange={e => setD('matriculaTractora', e.target.value)} placeholder="Ej: 1234ABC" />
                  </div>
                  )}
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Matrícula remolque</label>
                    <input className="edit-input" value={formDatos.matriculaRemolque} onChange={e => setD('matriculaRemolque', e.target.value)} placeholder="Ej: R-1234-ABC" />
                  </div>
                  )}
                  <div className="edit-field" style={{gridColumn:'1/-1'}}>
                    <label className="edit-label">Observaciones</label>
                    <textarea className="edit-input" value={formDatos.observaciones} onChange={e => setD('observaciones', e.target.value)} placeholder="Observaciones..." style={{minHeight:56,resize:'vertical'}} />
                  </div>
                </div>
              ) : (
                <>
                  {[
                    ['Tipo operación',      a.tipo],
                    ['Fecha / Hora',        `${a.fecha?.slice(0,10).split('-').reverse().join('/')}${a.hora ? ` — ${a.hora} h` : ''}`],
                    ['Certificación',       a.certificacion || '—'],
                    ['Proveedor',           a.proveedor || '—'],
                    ...(a.tipo?.includes('1') ? [
                      ['Astilladora',        a.astilladora || '—'],
                      ['Transportista',      a.transportista || '—'],
                    ] : []),
                    ['Instalación', a.instalacion],
                    ['Especie',              a.especie     || '—'],
                    ['Tipo biomasa',         a.tipoBiomasa || '—'],
                    ['Estella',              a.estella     || '—'],
                    ['Origen',              a.origen || '—'],
                    ['Permiso / Ref.',      a.permiso || '—'],
                    ...(a.tipo?.includes('1') ? [
                      ['Matrícula astilladora', a.matriculaAstilladora || '—'],
                      ['Chófer',             a.chofer || '—'],
                      ['Matrícula tractora', a.matriculaTractora || '—'],
                      ['Matrícula remolque', a.matriculaRemolque || '—'],
                    ] : []),
                    ['Observaciones',       a.observaciones || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="detalle-row">
                      <span className="detalle-key">{k}</span>
                      <span className="detalle-val">{v}</span>
                    </div>
                  ))}
                  {a.mapsOrigen && (
                    <div className="detalle-row">
                      <span className="detalle-key">Maps origen</span>
                      <span className="detalle-val">
                        <a href={a.mapsOrigen} target="_blank" rel="noreferrer"
                          style={{display:'inline-flex',alignItems:'center',gap:4,color:'var(--blue-700)',fontWeight:500,fontSize:12}}>
                          <MapPin size={11} /> Ver en Maps
                        </a>
                      </span>
                    </div>
                  )}
                  {a.mapsDestino && (
                    <div className="detalle-row">
                      <span className="detalle-key">Maps destino</span>
                      <span className="detalle-val">
                        <a href={a.mapsDestino} target="_blank" rel="noreferrer"
                          style={{display:'inline-flex',alignItems:'center',gap:4,color:'var(--blue-700)',fontWeight:500,fontSize:12}}>
                          <MapPin size={11} /> Ver en Maps
                        </a>
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── DATOS DE RECEPCIÓN Y PESADA ── */}
            <div className="card" style={{marginBottom:14}}>
              <div className="section-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                Datos de recepción y pesada
                {puedeEditar && !editandoPesada && (
                  <button className="btn-edit-section" onClick={iniciarEditPesada} title="Editar pesada">
                    <Pencil size={12} />
                  </button>
                )}
                {editandoPesada && (
                  <div style={{display:'flex',gap:4}}>
                    <button className="btn btn-primary" style={{fontSize:11,padding:'3px 8px'}} onClick={guardarPesada} disabled={guardando}>
                      <Check size={11} /> Guardar
                    </button>
                    <button className="btn" style={{fontSize:11,padding:'3px 8px'}} onClick={() => setEditandoPesada(false)} disabled={guardando}>
                      <X size={11} /> Cancelar
                    </button>
                  </div>
                )}
              </div>

              {editandoPesada ? (
                <div className="edit-grid">
                  {[
                    ['Peso bruto (kg)', 'entrada'],
                    ['Tara (kg)',       'salida'],
                    ['Humedad (%)',     'humedad'],
                  ].map(([label, key]) => (
                    <div key={key} className="edit-field">
                      <label className="edit-label">{label}</label>
                      <input
                        className="edit-input"
                        type="number"
                        value={formPesada[key]}
                        onChange={e => setP(key, e.target.value)}
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {[
                    ['Peso bruto',  a.pesada?.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '—'],
                    ['Tara',        a.pesada?.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : '—'],
                    ['Peso neto',   pesoNeto],
                    ['Humedad (%)', a.pesada?.humedad != null ? `${a.pesada.humedad}%` : 'Pendiente análisis'],
                  ].map(([k, v]) => (
                    <div key={k} className="detalle-row">
                      <span className="detalle-key">{k}</span>
                      <span className={`detalle-val ${v === 'Pendiente análisis' ? 'warn' : ''}`}>{v}</span>
                    </div>
                  ))}
                </>
              )}

              <div
                className="detalle-row"
                style={{
                  alignItems:'center',
                  ...(dragOverTicket ? {background:'rgba(29,158,117,0.06)',outline:'2px dashed var(--green-400)',outlineOffset:'-2px',borderRadius:'var(--radius-md)'} : {})
                }}
                onDragOver={e => { e.preventDefault(); setDragOverTicket(true) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTicket(false) }}
                onDrop={handleDropTicket}
              >
                <span className="detalle-key">Ticket de pesada</span>
                <span className="detalle-val" style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                  {dragOverTicket && <span style={{fontSize:11,color:'var(--green-600)'}}>Soltar para adjuntar</span>}
                  {a.pesada?.ticketUrl && !dragOverTicket && (
                    <a href={a.pesada.ticketUrl} target="_blank" rel="noreferrer"
                      style={{color:'var(--blue-700)',display:'flex',alignItems:'center',gap:4}}>
                      <Eye size={12} /> Ver
                    </a>
                  )}
                  <button
                    className={`btn ${a.pesada.ticketUrl ? '' : 'btn-primary'}`}
                    style={{fontSize:11,padding:'4px 8px'}}
                    onClick={() => ticketRef.current?.click()}
                    disabled={subiendoTicket}
                  >
                    {subiendoTicket
                      ? <span style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{width:10,height:10,border:'2px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />
                          Subiendo
                        </span>
                      : <><Upload size={11} /> {a.pesada.ticketUrl ? 'Reemplazar' : 'Adjuntar'}</>
                    }
                  </button>
                  <input
                    type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                    ref={ticketRef}
                    onChange={handleSubirTicket}
                  />
                </span>
              </div>
            </div>

            {/* ── DOCUMENTACIÓN ── */}
            <div className="card">
              <div className="section-label">Documentación</div>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {Object.entries({
                  ...a.docs,
                  ...('Albarán físico adjunto' in (a.docs || {}) ? {} : { 'Albarán físico adjunto': { adjunto: false, url: null, nombreFichero: null, tamanyo: null } })
                }).map(([nombre, doc]) => {
                  const isDragOver = dragOverDoc === nombre
                  return (
                    <div
                      key={nombre}
                      className="doc-row"
                      style={isDragOver ? {background:'rgba(29,158,117,0.06)',outline:'2px dashed var(--green-400)',outlineOffset:'-2px',borderRadius:'var(--radius-md)'} : undefined}
                      onDragOver={e => { e.preventDefault(); setDragOverDoc(nombre) }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDoc(null) }}
                      onDrop={e => handleDropDoc(nombre, e)}
                    >
                      <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                        <FileText size={14} color={isDragOver ? 'var(--green-400)' : doc.adjunto ? 'var(--green-400)' : 'var(--gray-300)'} style={{flexShrink:0}} />
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:500,color:'var(--gray-800)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nombre}</div>
                          {isDragOver
                            ? <div style={{fontSize:11,color:'var(--green-600)',marginTop:1}}>Soltar para adjuntar</div>
                            : doc.adjunto && doc.nombreFichero && (
                                <div style={{fontSize:11,color:'var(--gray-400)',marginTop:1}}>{doc.nombreFichero} · {formatBytes(doc.tamanyo)}</div>
                              )
                          }
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                        {doc.adjunto && doc.url && (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="btn" style={{fontSize:11,padding:'4px 8px'}}>
                            <Eye size={11} /> Ver
                          </a>
                        )}
                        <button
                          className={`btn ${doc.adjunto ? '' : 'btn-primary'}`}
                          style={{fontSize:11,padding:'4px 8px',minWidth:86}}
                          onClick={() => fileRefs.current[nombre]?.click()}
                          disabled={subiendo[nombre]}
                        >
                          {subiendo[nombre]
                            ? <span style={{display:'flex',alignItems:'center',gap:4}}>
                                <div style={{width:10,height:10,border:'2px solid currentColor',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />
                                Subiendo
                              </span>
                            : <><Upload size={11} /> {doc.adjunto ? 'Reemplazar' : 'Adjuntar'}</>
                          }
                        </button>
                        <input
                          type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                          ref={el => fileRefs.current[nombre] = el}
                          onChange={e => handleSubirDoc(nombre, e)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="detalle-right">
            <div className="card" style={{marginBottom:14, ...(a.estado==='cerrado' ? {border:'2px solid var(--green-400)',background:'var(--green-50)'} : {})}}>
              <div className="section-label" style={a.estado==='cerrado' ? {color:'var(--green-600)'} : {}}>
                {a.estado === 'cerrado' ? '✓ Albarán cerrado — todas las firmas completadas' : 'Estado de firmas'}
              </div>
              {firmasOrdenadas.map((key) => {
                const firma = a.firmas[key]
                if (!firma) return null
                return (
                  <div key={key} className={`firma-block ${firma.firmado ? 'done' : ''}`}
                    style={key === 'oficina' ? {boxShadow:'0 2px 10px rgba(0,0,0,0.07)', borderColor: firma.firmado ? undefined : 'var(--gray-300)'} : {}}
                  >
                    <div className="firma-block-header">
                      <div>
                        <div className="firma-actor">{FIRMA_LABELS[key]}</div>
                        <div className="firma-sub">{firma.actor}</div>
                      </div>
                      {firma.firmado
                        ? <span className="badge badge-green"><CheckCircle size={10} /> Firmado</span>
                        : <span className="badge badge-amber"><Clock size={10} /> Pendiente</span>
                      }
                    </div>
                    {firma.firmado && firma.nombrePersona && (
                      <div style={{fontSize:11,color:'var(--gray-500)',marginTop:2}}>
                        Persona: {firma.nombrePersona}
                        {firma.telefonoPersona && <span style={{marginLeft:8}}>· Tel: {normalizarTelefono(firma.telefonoPersona)}</span>}
                      </div>
                    )}
                    {firma.firmado && <div className="firma-fecha">{firma.fecha}</div>}
                    {firma.firmado && firma.firmaImagen && (
                      <img src={firma.firmaImagen} alt="Firma"
                        style={{marginTop:8,width:'100%',maxHeight:70,objectFit:'contain',
                          background:'#fafaf9',borderRadius:'var(--radius-sm)',border:'var(--border)'}}
                      />
                    )}
                    {!firma.firmado && a.estado !== 'cerrado' && key === 'oficina' && puedeOficinaFirmar && (
                      <button className="btn btn-primary" style={{fontSize:12,marginTop:8,width:'100%'}}
                        onClick={() => setFirmaOficinaModal(true)}>
                        <CheckCircle size={13} /> Firmar y cerrar albarán
                      </button>
                    )}
                    {!firma.firmado && a.estado !== 'cerrado' && key === 'oficina' && !puedeOficinaFirmar && (
                      <div style={{fontSize:11,color:'var(--gray-400)',marginTop:6,fontStyle:'italic'}}>
                        Pendiente de firmas anteriores
                      </div>
                    )}
                    {!firma.firmado && a.estado !== 'cerrado' && key !== 'oficina' && esSuperadmin && (
                      <button className="btn" style={{fontSize:12,marginTop:8,width:'100%'}}
                        onClick={() => setConfirmModal(key)}>
                        Simular firma →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="card" style={{marginBottom:14}}>
              <div className="section-label" style={{display:'flex',alignItems:'center',gap:5}}>
                <Share2 size={12} /> Enlace de campo
              </div>
              {urlSiguientePaso ? (
                <div style={{background:'var(--green-50)',border:'1px solid var(--green-100)',borderRadius:'var(--radius-md)',padding:'10px 12px'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--green-600)',marginBottom:4}}>
                    Siguiente paso — {getRolLabel(siguientePaso)}
                  </div>
                  <code style={{fontSize:11,color:'var(--green-600)',wordBreak:'break-all',display:'block',marginBottom:10}}>
                    {urlSiguientePaso}
                  </code>
                  {/* Botones de copia/apertura */}
                  <div style={{display:'flex',gap:5,marginBottom:8}}>
                    <button className="btn btn-primary" style={{flex:1,fontSize:11,padding:'5px 8px'}}
                      onClick={() => copiar(urlSiguientePaso, 'siguiente')}>
                      {copiado === 'siguiente' ? <><CheckCircle size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                    </button>
                    <button className="btn" style={{fontSize:11,padding:'5px 8px'}}
                      onClick={() => window.open(urlSiguientePaso, '_blank')}>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                  {/* Compartir */}
                  <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--gray-400)',marginBottom:6}}>
                    Compartir por
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    {actorTelefono ? (
                      <button onClick={() => compartirUrl(urlSiguientePaso, 'whatsapp')}
                        style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 8px',borderRadius:'var(--radius-sm)',border:'1px solid #d1fae5',background:'#ecfdf5',color:'#065f46',fontSize:11,fontWeight:500,cursor:'pointer'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.477 2 2 6.477 2 11.99c0 1.762.476 3.411 1.305 4.83L2 22l5.335-1.391A9.953 9.953 0 0011.99 22C17.523 22 22 17.523 22 12.01 22 6.477 17.523 2 11.99 2zm0 18.002a7.966 7.966 0 01-4.073-1.113l-.29-.173-3.017.787.81-2.945-.19-.302A7.96 7.96 0 014.002 12c0-4.406 3.583-7.998 7.988-7.998 4.406 0 7.998 3.592 7.998 7.998 0 4.406-3.592 7.998-7.998 8.002z"/></svg>
                        WhatsApp
                      </button>
                    ) : (
                      <div title="Esta empresa no tiene teléfono registrado"
                        style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 8px',borderRadius:'var(--radius-sm)',border:'1px solid var(--gray-100)',background:'var(--gray-50)',color:'var(--gray-300)',fontSize:11,fontWeight:500,cursor:'not-allowed'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.477 2 2 6.477 2 11.99c0 1.762.476 3.411 1.305 4.83L2 22l5.335-1.391A9.953 9.953 0 0011.99 22C17.523 22 22 17.523 22 12.01 22 6.477 17.523 2 11.99 2zm0 18.002a7.966 7.966 0 01-4.073-1.113l-.29-.173-3.017.787.81-2.945-.19-.302A7.96 7.96 0 014.002 12c0-4.406 3.583-7.998 7.988-7.998 4.406 0 7.998 3.592 7.998 7.998 0 4.406-3.592 7.998-7.998 8.002z"/></svg>
                        WhatsApp
                      </div>
                    )}
                    {actorEmail ? (
                      <button onClick={() => compartirUrl(urlSiguientePaso, 'email')}
                        style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 8px',borderRadius:'var(--radius-sm)',border:'var(--border)',background:'var(--gray-50)',color:'var(--gray-700)',fontSize:11,fontWeight:500,cursor:'pointer'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
                        Email
                      </button>
                    ) : (
                      <div title="Esta empresa no tiene email registrado"
                        style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 8px',borderRadius:'var(--radius-sm)',border:'1px solid var(--gray-100)',background:'var(--gray-50)',color:'var(--gray-300)',fontSize:11,fontWeight:500,cursor:'not-allowed'}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
                        Email
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{fontSize:12,color:'var(--gray-400)',fontStyle:'italic'}}>
                  {a.estado === 'cerrado' ? 'Todas las firmas completadas' : 'Todas las firmas externas completadas — pendiente de firma oficina'}
                </div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Actividad</div>
              <div className="timeline">
                {(a.actividad || []).map((ev, i) => {
                  const externos = [a.proveedor, a.astilladora, a.transportista, a.instalacion].filter(Boolean)
                  const tipo = ev.actor === 'Sistema' ? 'sistema'
                    : externos.includes(ev.actor) ? 'externo'
                    : 'interno'
                  return (
                    <div key={i} className={`tl-item tl-${tipo}`}>
                      <div className={`tl-dot tl-${tipo}`} />
                      <div>
                        <div className="tl-texto">{ev.texto.replace(/· Tel: (\S+)/g, (_, t) => `· Tel: ${normalizarTelefono(t)}`)}</div>
                        <div className="tl-meta">{ev.ts} · {ev.actor}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {firmaOficinaModal && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
        <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <CheckCircle size={22} color='var(--green-400)' />
            <span style={{fontSize:16,fontWeight:600}}>Firmar y cerrar albarán</span>
          </div>
          <p style={{fontSize:13,color:'var(--gray-600)',marginBottom:8}}>
            Vas a firmar como <strong>{usuario?.nombre || 'Oficina'}</strong> en nombre de la oficina.
          </p>
          <p style={{fontSize:13,color:'var(--gray-600)',marginBottom:20}}>
            Todas las firmas externas están completadas. Al confirmar, el albarán <strong>{a.id}</strong> quedará <strong>cerrado definitivamente</strong>.
          </p>
          <div style={{background:'var(--green-50)',border:'1px solid var(--green-100)',borderRadius:'var(--radius-md)',padding:'10px 12px',marginBottom:20,fontSize:12,color:'var(--green-700)'}}>
            Se registrará: actor, fecha, hora e IP de origen (firma electrónica simple eIDAS).
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn" onClick={() => setFirmaOficinaModal(false)} disabled={firmandoOficina}>Cancelar</button>
            <button
              className="btn btn-primary"
              onClick={handleFirmarOficina}
              disabled={firmandoOficina}
            >
              {firmandoOficina
                ? <><div style={{width:12,height:12,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> Firmando...</>
                : <><CheckCircle size={14} /> Confirmar y cerrar</>
              }
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmBorrar && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
        <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <Trash2 size={20} color='var(--red-400)' />
            <span style={{fontSize:16,fontWeight:600}}>Borrar albarán</span>
          </div>
          <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:20}}>
            ¿Seguro que quieres borrar el albarán <strong>{a.id}</strong>? Esta acción no se puede deshacer.
          </p>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn" onClick={() => setConfirmBorrar(false)}>Cancelar</button>
            <button
              className="btn"
              style={{background:'var(--red-400)',color:'#fff',borderColor:'var(--red-400)'}}
              onClick={async () => { await borrarAlbaran(a.id); setConfirmBorrar(false); navigate('/dashboard') }}
            >
              <Trash2 size={14} /> Borrar definitivamente
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmReabrir && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
        <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <RotateCcw size={20} color='var(--blue-400)' />
            <span style={{fontSize:16,fontWeight:600}}>Reabrir albarán</span>
          </div>
          <p style={{fontSize:13,color:'var(--gray-600)',marginBottom:8}}>
            El albarán <strong>{a.id}</strong> volverá al estado <strong>Pendiente oficina</strong>.
          </p>
          <p style={{fontSize:13,color:'var(--gray-600)',marginBottom:20}}>
            La firma de oficina quedará borrada. Las firmas externas se conservan.
          </p>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn" onClick={() => setConfirmReabrir(false)} disabled={reabriendo}>Cancelar</button>
            <button
              className="btn"
              style={{background:'var(--blue-400)',color:'#fff',borderColor:'var(--blue-400)'}}
              onClick={handleReabrir}
              disabled={reabriendo}
            >
              {reabriendo
                ? <><div style={{width:12,height:12,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> Reabriendo...</>
                : <><RotateCcw size={14} /> Reabrir</>
              }
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

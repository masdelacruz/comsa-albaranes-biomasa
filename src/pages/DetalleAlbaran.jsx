import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExternalLink, CheckCircle, Clock, FileDown, Upload, Eye, FileText, AlertTriangle, Copy, Pencil, X, Check, Trash2 } from 'lucide-react'
import { Badge } from '../components/Badge'
import { generarPDF } from '../utils/generarPDF'
import { api } from '../lib/api'
import { ESPECIES, TIPOS_BIOMASA } from '../data/mockData'
import '../components/shared.css'
import './DetalleAlbaran.css'

const ORDEN_FIRMAS = ['proveedor', 'astilladora', 'transportista', 'instalacion', 'oficina']

const FIRMA_LABELS = {
  proveedor:     'Proveedor — Origen',
  astilladora:   'Astilladora',
  transportista: 'Transportista',
  instalacion:   'Receptor — Instalación destino',
  oficina:       'Oficina',
}

const TIPOS_OP = ['Opció 1 — Compra en monte / plataforma', 'Opció 2 — Proveedor directo']

export default function DetalleAlbaran({ albaranes, simularFirma, subirDocumento, subirTicketPesada, actualizarAlbaran, borrarAlbaran, usuario }) {
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

  const [editandoDatos,  setEditandoDatos]  = useState(false)
  const [editandoPesada, setEditandoPesada] = useState(false)
  const [formDatos,  setFormDatos]  = useState({})
  const [formPesada, setFormPesada] = useState({})
  const [guardando,  setGuardando]  = useState(false)
  const [toast,      setToast]      = useState('')
  const [confirmBorrar, setConfirmBorrar] = useState(false)

  const mostrarToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const [proveedores,    setProveedores]    = useState([])
  const [astilladoras,   setAstilladoras]   = useState([])
  const [transportistas, setTransportistas] = useState([])
  const [instalaciones,  setInstalaciones]  = useState([])

  useEffect(() => {
    api.get('/empresas?activo=true').then(data => {
      const d = data || []
      setProveedores(   d.filter(p => p.tipo === 'proveedor'   ).map(p => p.nombre))
      setAstilladoras(  d.filter(p => p.tipo === 'astilladora' ).map(p => p.nombre))
      setTransportistas(d.filter(p => p.tipo === 'transportista').map(p => p.nombre))
      setInstalaciones( d.filter(p => p.tipo === 'instalacion' ).map(p => p.nombre))
    }).catch(() => {})
  }, [])

  const a = albaranes.find(x => x.id === id)
  if (!a) return <div style={{padding:40,color:'var(--gray-400)'}}>Albarán no encontrado.</div>

  const esSuperadmin = usuario?.nivel === 'superadmin'
  const puedeEditar  = true

  const pesoNeto = a.pesada.entrada && a.pesada.salida
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '—'

  const firmasOrdenadas = ORDEN_FIRMAS.filter(k => a.firmas[k])

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
    firmasOrdenadas.filter(k => k !== 'oficina').every(k => a.firmas[k]?.firmado)

  const siguientePaso    = getSiguientePaso()
  const urlSiguientePaso = siguientePaso ? `${window.location.origin}/campo/${a.id}/${siguientePaso}` : null

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
    for (const r of todasAFirmar) await simularFirma(a.id, r)
    setConfirmModal(null)
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
      certificacion:     a.certificacion     || '',
      proveedor:         a.proveedor         || '',
      astilladora:       a.astilladora       || '',
      transportista:     a.transportista     || '',
      instalacion:       a.instalacion       || '',
      especie:           a.especie           || '',
      tipoBiomasa:       a.tipoBiomasa       || '',
      origen:            a.origen            || '',
      permiso:           a.permiso           || '',
      chofer:            a.chofer            || '',
      matriculaTractora: a.matriculaTractora || '',
      matriculaRemolque: a.matriculaRemolque || '',
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
        origen:             formDatos.origen            || null,
        permiso:            formDatos.permiso           || null,
        chofer:             formDatos.chofer            || null,
        matricula_tractora: formDatos.matriculaTractora || null,
        matricula_remolque: formDatos.matriculaRemolque || null,
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
      entrada: a.pesada.entrada ?? '',
      salida:  a.pesada.salida  ?? '',
      humedad: a.pesada.humedad ?? '',
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
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div className="page-title" style={{fontFamily:'var(--font-mono)',fontSize:18}}>{a.id}</div>
            <Badge estado={a.estado} />
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn" onClick={() => generarPDF(a)}>
              <FileDown size={15} /> Descargar PDF
            </button>
            {esSuperadmin && (
              <button className="btn" style={{color:'var(--red-400)',borderColor:'var(--red-100)'}} onClick={() => setConfirmBorrar(true)}>
                <Trash2 size={15} /> Borrar
              </button>
            )}
          </div>
        </div>
        <div className="page-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha?.slice(0,10).split('-').reverse().join('/')}</div>
      </div>

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
                  <div className="edit-field">
                    <label className="edit-label">Astilladora</label>
                    <select className="edit-input" value={formDatos.astilladora} onChange={e => setD('astilladora', e.target.value)}>
                      <option value="">—</option>
                      {astilladoras.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Transportista</label>
                    <select className="edit-input" value={formDatos.transportista} onChange={e => setD('transportista', e.target.value)}>
                      <option value="">—</option>
                      {transportistas.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Instalación destino</label>
                    <select className="edit-input" value={formDatos.instalacion} onChange={e => setD('instalacion', e.target.value)}>
                      <option value="">—</option>
                      {instalaciones.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Especie</label>
                    <select className="edit-input" value={formDatos.especie} onChange={e => setD('especie', e.target.value)}>
                      {ESPECIES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Tipo biomasa</label>
                    <select className="edit-input" value={formDatos.tipoBiomasa} onChange={e => setD('tipoBiomasa', e.target.value)}>
                      {TIPOS_BIOMASA.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Origen</label>
                    <input className="edit-input" value={formDatos.origen} onChange={e => setD('origen', e.target.value)} placeholder="Paraje / término municipal" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Permiso / Ref.</label>
                    <input className="edit-input" value={formDatos.permiso} onChange={e => setD('permiso', e.target.value)} placeholder="Nº permiso o SURE" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Chófer</label>
                    <input className="edit-input" value={formDatos.chofer} onChange={e => setD('chofer', e.target.value)} placeholder="Nombre" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Matrícula tractora</label>
                    <input className="edit-input" value={formDatos.matriculaTractora} onChange={e => setD('matriculaTractora', e.target.value)} placeholder="Ej: 1234ABC" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Matrícula remolque</label>
                    <input className="edit-input" value={formDatos.matriculaRemolque} onChange={e => setD('matriculaRemolque', e.target.value)} placeholder="Ej: R-1234-ABC" />
                  </div>
                  <div className="edit-field" style={{gridColumn:'1/-1'}}>
                    <label className="edit-label">Observaciones</label>
                    <textarea className="edit-input" value={formDatos.observaciones} onChange={e => setD('observaciones', e.target.value)} placeholder="Observaciones..." style={{minHeight:56,resize:'vertical'}} />
                  </div>
                </div>
              ) : (
                [
                  ['Tipo operación',      a.tipo],
                  ['Certificación',       a.certificacion || '—'],
                  ['Proveedor',           a.proveedor || '—'],
                  ['Astilladora',         a.astilladora || '—'],
                  ['Transportista',       a.transportista || '—'],
                  ['Instalación destino', a.instalacion],
                  ['Especie',             `${a.especie} · ${a.tipoBiomasa}`],
                  ['Origen',              a.origen || '—'],
                  ['Permiso / Ref.',      a.permiso || '—'],
                  ['Chófer',              a.chofer || '—'],
                  ['Matrícula tractora',  a.matriculaTractora || '—'],
                  ['Matrícula remolque',  a.matriculaRemolque || '—'],
                  ['Observaciones',       a.observaciones || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="detalle-row">
                    <span className="detalle-key">{k}</span>
                    <span className="detalle-val">{v}</span>
                  </div>
                ))
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
                    ['Peso bruto',  a.pesada.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '—'],
                    ['Tara',        a.pesada.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : '—'],
                    ['Peso neto',   pesoNeto],
                    ['Humedad (%)', a.pesada.humedad != null ? `${a.pesada.humedad}%` : 'Pendiente análisis'],
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
                  {a.pesada.ticketUrl && !dragOverTicket && (
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
                {Object.entries(a.docs).map(([nombre, doc]) => {
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
            <div className="card" style={{marginBottom:14}}>
              <div className="section-label">Estado de firmas</div>
              {firmasOrdenadas.map((key) => {
                const firma = a.firmas[key]
                if (!firma) return null
                return (
                  <div key={key} className={`firma-block ${firma.firmado ? 'done' : ''}`}>
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
                        onClick={() => setConfirmModal('oficina')}>
                        ✓ Firmar como Oficina
                      </button>
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
              <div className="section-label">Enlace de campo</div>
              {urlSiguientePaso && (
                <div style={{background:'var(--green-50)',border:'1px solid var(--green-100)',borderRadius:'var(--radius-md)',padding:'10px 12px',marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:'var(--green-600)',marginBottom:4}}>
                    Siguiente paso — {getRolLabel(siguientePaso)}
                  </div>
                  <code style={{fontSize:11,color:'var(--green-600)',wordBreak:'break-all',display:'block',marginBottom:8}}>
                    {urlSiguientePaso}
                  </code>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-primary" style={{flex:1,fontSize:11,padding:'5px 8px'}}
                      onClick={() => copiar(urlSiguientePaso, 'siguiente')}>
                      {copiado === 'siguiente' ? <><CheckCircle size={11} /> Copiado</> : <><Copy size={11} /> Copiar enlace siguiente paso</>}
                    </button>
                    <button className="btn" style={{fontSize:11,padding:'5px 8px'}}
                      onClick={() => window.open(urlSiguientePaso, '_blank')}>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Actividad</div>
              <div className="timeline">
                {a.actividad.map((ev, i) => {
                  const externos = [a.proveedor, a.astilladora, a.transportista, a.instalacion].filter(Boolean)
                  const tipo = ev.actor === 'Sistema' ? 'sistema'
                    : externos.includes(ev.actor) ? 'externo'
                    : 'interno'
                  return (
                    <div key={i} className={`tl-item tl-${tipo}`}>
                      <div className={`tl-dot tl-${tipo}`} />
                      <div>
                        <div className="tl-texto">{ev.texto}</div>
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
    </>
  )
}

import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, CheckCircle, Clock, FileDown, Upload, Eye, FileText, AlertTriangle, Copy } from 'lucide-react'
import { Badge } from '../components/Badge'
import { generarPDF } from '../utils/generarPDF'
import '../components/shared.css'
import './DetalleAlbaran.css'

const ORDEN_FIRMAS = ['oficina', 'astilladora', 'transportista', 'instalacion']

const FIRMA_LABELS = {
  oficina:       'Oficina',
  astilladora:   'Astilladora',
  transportista: 'Transportista',
  instalacion:   'Receptor — Instalación destino',
}

export default function DetalleAlbaran({ albaranes, simularFirma, subirDocumento, usuario }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRefs = useRef({})
  const [subiendo, setSubiendo]         = useState({})
  const [confirmModal, setConfirmModal] = useState(null)
  const [copiado, setCopiado]           = useState('')

  const a = albaranes.find(x => x.id === id)
  if (!a) return <div style={{padding:40,color:'var(--gray-400)'}}>Albarán no encontrado.</div>

  const campoUrl = `${window.location.origin}/campo/${a.id}`
  const pesoNeto = a.pesada.entrada && a.pesada.salida
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '—'

  const firmasOrdenadas = ORDEN_FIRMAS.filter(k => a.firmas[k])

  const getSiguientePaso = () => {
    const pendientes = firmasOrdenadas.filter(k => k !== 'oficina' && !a.firmas[k]?.firmado)
    if (pendientes.length === 0) return null
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

  const siguientePaso = getSiguientePaso()
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

  const handleSubirDoc = async (docNombre, e) => {
    const fichero = e.target.files[0]
    if (!fichero) return
    setSubiendo(prev => ({ ...prev, [docNombre]: true }))
    try { await subirDocumento(a.id, docNombre, fichero) }
    finally { setSubiendo(prev => ({ ...prev, [docNombre]: false })); e.target.value = '' }
  }

  const formatBytes = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="detalle-page">
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
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} style={{marginBottom:12}}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div className="page-title" style={{fontFamily:'var(--font-mono)',fontSize:18}}>{a.id}</div>
            <Badge estado={a.estado} />
          </div>
          <button className="btn" onClick={() => generarPDF(a)}>
            <FileDown size={15} /> Descargar PDF
          </button>
        </div>
        <div className="page-sub">{a.astilladora || a.proveedor} → {a.instalacion} · {a.fecha.split('-').reverse().join('/')}</div>
      </div>

      <div className="detalle-content">
        <div className="detalle-cols">
          <div className="detalle-left">
            <div className="card" style={{marginBottom:14}}>
              <div className="section-label">Datos del albarán</div>
              {[
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
                ['Nº camiones',         a.numCamiones],
                ['Observaciones',       a.observaciones || '—'],
              ].map(([k, v]) => (
                <div key={k} className="detalle-row">
                  <span className="detalle-key">{k}</span>
                  <span className="detalle-val">{v}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{marginBottom:14}}>
              <div className="section-label">Datos de recepción y pesada</div>
              {[
                ['Peso bruto',         a.pesada.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '—'],
                ['Tara',               a.pesada.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : '—'],
                ['Peso neto',          pesoNeto],
                ['Humedad (%)',        a.pesada.humedad != null ? `${a.pesada.humedad}%` : 'Pendiente análisis'],
              ].map(([k, v]) => (
                <div key={k} className="detalle-row">
                  <span className="detalle-key">{k}</span>
                  <span className={`detalle-val ${v === 'Pendiente análisis' ? 'warn' : ''}`}>{v}</span>
                </div>
              ))}
              <div className="detalle-row">
                <span className="detalle-key">Ticket de pesada</span>
                <span className="detalle-val">
                  {a.pesada.ticketUrl
                    ? <a href={a.pesada.ticketUrl} target="_blank" rel="noreferrer"
                        style={{color:'var(--blue-700)',display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end'}}>
                        <Eye size={12} /> Ver ticket
                      </a>
                    : <span style={{color:'var(--gray-300)'}}>Sin adjuntar</span>
                  }
                </span>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Documentación</div>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {Object.entries(a.docs).map(([nombre, doc]) => (
                  <div key={nombre} className="doc-row">
                    <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
                      <FileText size={14} color={doc.adjunto ? 'var(--green-400)' : 'var(--gray-300)'} style={{flexShrink:0}} />
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,color:'var(--gray-800)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nombre}</div>
                        {doc.adjunto && doc.nombreFichero && (
                          <div style={{fontSize:11,color:'var(--gray-400)',marginTop:1}}>{doc.nombreFichero} · {formatBytes(doc.tamanyo)}</div>
                        )}
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
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                        ref={el => fileRefs.current[nombre] = el}
                        onChange={e => handleSubirDoc(nombre, e)}
                      />
                    </div>
                  </div>
                ))}
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
                    {firma.firmado && <div className="firma-fecha">{firma.fecha}</div>}
                    {firma.firmado && firma.firmaImagen && (
                      <img src={firma.firmaImagen} alt="Firma"
                        style={{marginTop:8,width:'100%',maxHeight:70,objectFit:'contain',
                          background:'#fafaf9',borderRadius:'var(--radius-sm)',border:'var(--border)'}}
                      />
                    )}
                    {!firma.firmado && a.estado !== 'cerrado' && key !== 'oficina' && (
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
              <div className="campo-link-box">
                <div style={{fontSize:11,color:'var(--gray-400)',marginBottom:4}}>Enlace general</div>
                <code className="campo-url">{campoUrl}</code>
                <div style={{display:'flex',gap:6,marginTop:8}}>
                  <button className="btn" style={{flex:1,fontSize:11}} onClick={() => copiar(campoUrl, 'general')}>
                    {copiado === 'general' ? <><CheckCircle size={11} /> Copiado</> : <><Copy size={11} /> Copiar enlace general</>}
                  </button>
                  <button className="btn" style={{fontSize:11,padding:'5px 8px'}} onClick={() => navigate(`/campo/${a.id}`)}>
                    <ExternalLink size={13} /> Ver vista campo
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">Actividad</div>
              <div className="timeline">
                {a.actividad.map((ev, i) => (
                  <div key={i} className="tl-item">
                    <div className="tl-dot" />
                    <div>
                      <div className="tl-texto">{ev.texto}</div>
                      <div className="tl-meta">{ev.ts} · {ev.actor}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
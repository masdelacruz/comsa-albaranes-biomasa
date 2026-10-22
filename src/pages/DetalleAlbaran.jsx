import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, CheckCircle, Clock, FileDown, Upload, Eye, FileText, AlertTriangle, Copy, Pencil, X, Check, Trash2, MapPin, Share2, Truck, RotateCcw, RefreshCw } from 'lucide-react'
import { Badge } from '../components/Badge'
import PdfLoadingOverlay from '../components/PdfLoadingOverlay'
import { generarPDF, generarPDFA5, cargarLogos } from '../utils/generarPDF'
import { api } from '../lib/api'
import { ESPECIES, TIPOS_BIOMASA } from '../data/mockData'
import SelectField from '../components/SelectField'
import CompartirWhatsApp, { WaIcon } from '../components/CompartirWhatsApp'
import { contactosEmpresa } from '../utils/clientes'
import { pasoPendiente, textoNotificado } from '../utils/pasos'
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

// Botón (simple o con desplegable "solo albarán" / "+ ticket pesada" si aplica
// certificación SURE) para generar el PDF, en modo descarga o vista previa.
// Documentación agrupada por para qué sirve cada papel
const GRUPOS_DOC = [
  { titulo: 'Origen y permisos',    docs: ['Autodeclaración', 'Permiso de corta', 'Permiso de obra', 'Certificado SURE'] },
  { titulo: 'Contratos',            docs: ['Acuerdo de cesión', 'Contrato prestación servicios'] },
  { titulo: 'Transporte y entrega', docs: ['Albarán físico adjunto', 'Albarán proveedor'] },
]

// Campo en modo lectura: etiqueta arriba y valor debajo, igual que el formulario de edición
function Campo({ label, valor, full, ancho, children }) {
  const vacio = children == null && (valor == null || valor === '' || valor === '—')
  return (
    <div className={`ver-field${full ? ' full' : ''}${ancho === 3 ? ' triple' : ''}`}>
      <span className="ver-label">{label}</span>
      <span className={`ver-val${vacio ? ' vacio' : ''}`}>{children ?? (vacio ? '—' : valor)}</span>
    </div>
  )
}
const Grupo = ({ children }) => <div className="grid-grupo">{children}</div>
// Fila compacta de lectura: nombre del grupo a la izquierda y sus campos en rejilla
const Fila = ({ titulo, children }) => (
  <div className="ver-fila">
    <span className="ver-fila-titulo">{titulo}</span>
    <div className="ver-fila-campos">{children}</div>
  </div>
)

function MenuPDF({ a, modo, generando, onGenerar }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // El desplegable se cierra al pulsar fuera o con Escape
  useEffect(() => {
    if (!open) return
    const fuera = e => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    const tecla = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [open])

  const Icon  = modo === 'preview' ? Eye : FileDown
  const label = modo === 'preview' ? 'Vista previa' : 'Descargar PDF'
  const baseOpts = modo === 'preview' ? { preview: true } : {}
  const tieneSure = a.certificacion?.includes('SURE')

  const disparar = (extra) => {
    setOpen(false)
    onGenerar({ ...baseOpts, ...extra })
  }

  if (!tieneSure) {
    return (
      <button className="btn" onClick={() => disparar({})} disabled={generando}>
        <Icon size={15} /> {generando ? 'Generando...' : label}
      </button>
    )
  }

  return (
    <div ref={menuRef} style={{position:'relative'}}>
      <button className="btn" onClick={() => setOpen(o => !o)} disabled={generando}>
        <Icon size={15} /> {generando ? 'Generando...' : `${label} ▾`}
      </button>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:'#fff',border:'var(--border)',borderRadius:'var(--radius-md)',boxShadow:'0 4px 16px rgba(0,0,0,0.1)',zIndex:50,minWidth:220}}>
          <button style={{display:'block',width:'100%',padding:'9px 14px',textAlign:'left',background:'none',border:'none',cursor:'pointer',fontSize:13}}
            onClick={() => disparar({})}>
            <Icon size={13} style={{marginRight:6}} /> Solo albarán
          </button>
          <button style={{display:'block',width:'100%',padding:'9px 14px',textAlign:'left',background:'none',border:'none',fontSize:13,
            cursor: a.pesada?.ticketAdjunto ? 'pointer' : 'not-allowed',
            color: a.pesada?.ticketAdjunto ? 'inherit' : 'var(--gray-400)'}}
            disabled={!a.pesada?.ticketAdjunto}
            onClick={() => { if (a.pesada?.ticketAdjunto) disparar({ includeTicket: true }) }}>
            <Icon size={13} style={{marginRight:6}} /> Albarán + ticket pesada
            {!a.pesada?.ticketAdjunto && <span style={{fontSize:11,marginLeft:6}}>(sin ticket)</span>}
          </button>
        </div>
      )}
    </div>
  )
}

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

export default function DetalleAlbaran({ albaranes, simularFirma, updateFirma, subirDocumento, eliminarDocumento, subirTicketPesada, actualizarAlbaran, borrarAlbaran, reabrirAlbaran, enviarACampoAlbaran, regenerarEnlaceCampo, usuario, refetch }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileRefs    = useRef({})
  const ticketRef   = useRef(null)
  const [subiendo, setSubiendo]             = useState({})
  const [subiendoTicket, setSubiendoTicket] = useState(false)
  const [borrarDoc, setBorrarDoc]           = useState(null)   // nombre del doc pendiente de confirmar borrado
  const [borrandoDoc, setBorrandoDoc]       = useState(false)
  const [confirmModal, setConfirmModal]     = useState(null)
  const [copiado, setCopiado]               = useState('')
  const [regenerando, setRegenerando]       = useState(false)
  const [waModal, setWaModal]               = useState(null)
  const [dragOverDoc, setDragOverDoc]       = useState(null)   // nombre del doc sobre el que se arrastra
  const [dragOverTicket, setDragOverTicket] = useState(false)
  // Un flag por botón (preview / descargar): antes era un único booleano
  // compartido y al pulsar uno de los dos, ambos se ponían en "Generando..."
  // aunque solo se estuviera generando uno.
  const [generandoPdf, setGenerandoPdf]     = useState({ preview: false, descargar: false })
  const [previewPdf, setPreviewPdf]         = useState(null)   // { url, nombre } del PDF mostrado en el modal

  const [editandoDatos,  setEditandoDatos]  = useState(false)
  const [editandoPesada, setEditandoPesada] = useState(false)
  const [formDatos,  setFormDatos]  = useState({})
  const [formPesada, setFormPesada] = useState({})
  const [guardando,  setGuardando]  = useState(false)
  const [toast,      setToast]      = useState('')
  const [confirmBorrar, setConfirmBorrar]   = useState(false)
  const [firmaOficinaModal, setFirmaOficinaModal] = useState(false)
  const [firmandoOficina, setFirmandoOficina]     = useState(false)
  const [confirmReabrir,    setConfirmReabrir]      = useState(false)
  const [reabriendo,        setReabriendo]          = useState(false)
  const [enviandoACampo,    setEnviandoACampo]      = useState(false)
  const [anulando,          setAnulando]            = useState(false)
  const [anularOpen,        setAnularOpen]          = useState(false)
  const [motivoAnulacion,   setMotivoAnulacion]     = useState('')
  const [duplicarOpen,    setDuplicarOpen]        = useState(false)
  const [numCopias,       setNumCopias]           = useState(1)
  const [duplicando,      setDuplicando]          = useState(false)

  const mostrarToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const [proveedores,    setProveedores]    = useState([])
  const [astilladoras,   setAstilladoras]   = useState([])
  const [transportistas, setTransportistas] = useState([])
  const [instalaciones,  setInstalaciones]  = useState([])
  const [todasEmpresas,  setTodasEmpresas]  = useState([])
  // Nombre de interviniente → enlace a su ficha de cliente (si existe la empresa)
  const linkEmpresa = (nombre, tipo) => {
    if (!nombre) return null
    const emp = todasEmpresas.find(e => e.nombre === nombre && e.tipo === tipo) || todasEmpresas.find(e => e.nombre === nombre)
    return emp
      ? <button type="button" className="ver-empresa" onClick={() => navigate(`/clientes/${emp.id}`)} title={`Ver ficha de ${nombre}`}>{nombre}</button>
      : nombre
  }
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
    // Precarga en segundo plano los logos del PDF (cacheados a nivel de módulo,
    // ver generarPDF.js) para que al pulsar "Vista previa" o "Descargar PDF" ya
    // estén listos y no se note la espera de red la primera vez de la sesión.
    cargarLogos()
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
  // Astilladora, instalación y proveedor reciben siempre su panel (el mismo
  // enlace para todos sus albaranes); el resto, el enlace de este albarán.
  const urlSiguientePaso = siguientePaso
    ? siguientePaso === 'instalacion'
      ? a.panelInstalacionUrl || null
      : siguientePaso === 'astilladora'
      ? a.panelAstilladoraUrl || null
      : siguientePaso === 'proveedor' && a.panelProveedorUrl
      ? a.panelProveedorUrl
      : `${window.location.origin}/campo/${a.id}/${siguientePaso}?t=${encodeURIComponent(a.campoToken || '')}`
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

  const handleRegenerarEnlace = async () => {
    if (!window.confirm('El enlace actual dejará de funcionar. ¿Generar uno nuevo?')) return
    setRegenerando(true)
    try {
      await regenerarEnlaceCampo(a.id)
    } catch {}
    setRegenerando(false)
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

  const handleDuplicar = async () => {
    setDuplicando(true)
    try {
      const { ids } = await api.post(`/albaranes/${a.id}/duplicar`, { count: numCopias })
      await refetch?.()
      setDuplicarOpen(false)
      setNumCopias(1)
      const msg = ids.length === 1
        ? `Albarán duplicado: ${ids[0]}`
        : `${ids.length} albaranes creados${a.grupoId ? ' y añadidos a la flota' : ''}`
      mostrarToast(msg)
    } catch {
      mostrarToast('Error al duplicar el albarán')
    } finally {
      setDuplicando(false)
    }
  }

  const handleGenerarPDF = async (opts) => {
    const modo = opts.preview ? 'preview' : 'descargar'
    setGenerandoPdf(prev => ({ ...prev, [modo]: true }))
    // generarPDF dibuja el PDF con jsPDF de forma síncrona (bloquea el hilo
    // principal); si lo llamamos ya en este mismo tick, el navegador nunca
    // llega a pintar el loader antes de que empiece ese bloqueo y la UI
    // parece "congelada". Cedemos el hilo un instante para forzar el pintado.
    await new Promise(r => setTimeout(r, 0))
    const inicio = Date.now()
    try {
      const resultado = await generarPDF(a, opts)
      if (opts.preview && resultado) setPreviewPdf(resultado)
    } finally {
      // Con los logos ya precargados puede terminar en muy poco tiempo: si la
      // ventana visible es más corta que un ciclo de la animación (0.7s) no
      // da tiempo a percibir movimiento. Forzamos que se vea al menos un
      // par de ciclos completos.
      const espera = 900 - (Date.now() - inicio)
      if (espera > 0) await new Promise(r => setTimeout(r, espera))
      setGenerandoPdf(prev => ({ ...prev, [modo]: false }))
    }
  }

  const cerrarPreviewPdf = () => {
    if (previewPdf?.url) URL.revokeObjectURL(previewPdf.url)
    setPreviewPdf(null)
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

  const confirmarBorrarDoc = async (docNombre) => {
    setBorrandoDoc(true)
    try {
      await eliminarDocumento(a.id, docNombre)
      mostrarToast('Documento eliminado')
    } catch (e) {
      mostrarToast(e?.message || 'No se pudo eliminar el documento')
    } finally {
      setBorrandoDoc(false)
      setBorrarDoc(null)
    }
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
      numeroPesada: a.pesada?.numeroPesada ?? '',
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
        numero_pesada: formPesada.numeroPesada !== '' ? formPesada.numeroPesada : null,
      }, 'Datos de pesada editados')
      setEditandoPesada(false)
      mostrarToast('Datos de pesada actualizados')
    } finally {
      setGuardando(false)
    }
  }

  const setD = (k, v) => setFormDatos(p => ({ ...p, [k]: v }))
  const setP = (k, v) => setFormPesada(p => ({ ...p, [k]: v }))

  // ── Compartir enlaces (WhatsApp / email) ──────────────────────────
  // Astilladora, instalación y proveedor tienen un panel fijo por empresa
  // (el mismo enlace para todos sus albaranes); el resto de pasos usa el
  // enlace de campo exclusivo de este albarán.
  const filaEmpresa = (nombre, tipo) => nombre
    ? todasEmpresas.find(e => e.nombre === nombre && e.tipo === tipo) || todasEmpresas.find(e => e.nombre === nombre)
    : null
  const primerRol    = siguientePaso?.split(',')[0]
  const actorNombre  = primerRol ? (a.firmas[primerRol]?.actor || a[primerRol]) : null
  const actorEmpresa = filaEmpresa(actorNombre, primerRol)
  const actorEmail   = actorEmpresa?.email || null
  const esPanelPaso  = !!{ astilladora: a.panelAstilladoraUrl, instalacion: a.panelInstalacionUrl, proveedor: a.panelProveedorUrl }[siguientePaso]

  const fechaAlb     = a.fecha?.slice(0,10).split('-').reverse().join('/') || '—'
  const lineaBiomasa = [a.especie, a.tipoBiomasa, a.estella].filter(Boolean).join(' · ') || '—'
  const matricula    = [a.matriculaTractora, a.matriculaRemolque].filter(Boolean).join(' · ') || '—'

  // Texto del enlace del siguiente paso. fmt 'wa' usa negritas de WhatsApp;
  // 'email' alinea los datos en columnas para el cuerpo en texto plano.
  const textoSiguientePaso = (nombre, fmt) => {
    const dato = fmt === 'wa' ? ([k, v]) => `*${k}:* ${v}` : ([k, v]) => `   ${k.padEnd(14)}: ${v}`
    let intro, datos
    if (siguientePaso === 'proveedor' && esPanelPaso) {
      intro = `Tienes un suministro programado para el ${fechaAlb} (Albarán ${a.id}). Desde tu panel de Comsa Service puedes adjuntar tu albarán${a.origen ? '' : ' e indicar el origen de la biomasa'}.`
      datos = [['Fecha', fechaAlb], ['Destino', a.instalacion || '—'], ['Biomasa', lineaBiomasa]]
    } else if (siguientePaso === 'astilladora' && esPanelPaso) {
      intro = `Tienes un nuevo albarán pendiente de confirmar en tu panel de Comsa Service: el Albarán ${a.id}.`
      datos = [['Fecha', fechaAlb], ['Transportista', a.transportista || '—'], ['Biomasa', lineaBiomasa], ['Destino', a.instalacion || '—']]
    } else if (siguientePaso === 'instalacion' && esPanelPaso) {
      intro = `Va de camino un camión con destino a ${a.instalacion} (Albarán ${a.id}). Cuando llegue, confirma la recepción desde tu panel de Comsa Service.`
      datos = [['Transportista', a.transportista || '—'], ...(a.chofer ? [['Conductor', a.chofer]] : []), ['Matrícula', matricula], ['Biomasa', lineaBiomasa]]
    } else {
      intro = `Te enviamos el Albarán ${a.id} para que lo confirmes como ${getRolLabel(siguientePaso).toLowerCase()}.`
      datos = [['Fecha', fechaAlb], ['Transportista', a.transportista || '—'], ['Matrícula', matricula], ['Biomasa', lineaBiomasa], ['Destino', a.instalacion || '—']]
    }
    const cierre = esPanelPaso
      ? `Tu panel (es siempre el mismo enlace: guárdalo y no lo compartas fuera de tu empresa):`
      : 'Este enlace es exclusivo de este albarán; no lo reenvíes:'
    return `Hola${nombre ? ' ' + nombre : ''},\n\n${intro}\n\n${datos.map(dato).join('\n')}\n\n${cierre}\n${urlSiguientePaso}`
  }

  const asuntoSiguientePaso = () => {
    if (esPanelPaso && siguientePaso === 'proveedor')   return `Albarán ${a.id} — adjunta tu albarán${a.origen ? '' : ' e indica el origen'} · Comsa Service`
    if (esPanelPaso && siguientePaso === 'instalacion') return `Camión en camino — Albarán ${a.id} · Comsa Service`
    return `Albarán ${a.id} pendiente de confirmar · Comsa Service`
  }

  const nombreDeContacto = emp => (contactosEmpresa(emp)[0]?.nombre || '').trim().split(/\s+/)[0] || actorNombre || ''

  // Marca "Notificado" del paso en curso (informativa, no cambia el estado)
  const notificado = pasoPendiente(a)?.notificado || null
  const marcarNotificado = async (medio, quitar = false) => {
    if (a.estado !== 'pendiente_campo') return
    try {
      await api.post('/albaranes/notificar', { ids: [a.id], medio, quitar })
      await refetch?.()
    } catch { mostrarToast('No se pudo guardar la marca de notificado') }
  }

  const compartirUrl = (url, medio) => {
    if (medio === 'whatsapp') {
      setWaModal({
        titulo: `${getRolLabel(siguientePaso)} · Albarán ${a.id}`,
        empresa: actorEmpresa, nombreEmpresa: actorNombre || '—',
        mensaje: nombre => textoSiguientePaso(nombre, 'wa'),
        onEnviado: () => marcarNotificado('whatsapp'),
      })
    }
    if (medio === 'email') {
      const body = `${textoSiguientePaso(nombreDeContacto(actorEmpresa), 'email')}\n\n` +
        `Gracias por tu colaboración.\n\n` +
        `Comsa Service — Gestión de Albaranes de Biomasa`
      window.open(`mailto:${actorEmail || ''}?subject=${encodeURIComponent(asuntoSiguientePaso())}&body=${encodeURIComponent(body)}`, '_blank')
      marcarNotificado('email')
    }
    if (medio === 'copiar') copiar(url, 'siguiente')
  }

  // Enlaces de panel permanente de cada empresa del albarán
  const paneles = [
    a.proveedor && a.panelProveedorUrl && {
      rol: 'proveedor', nombre: a.proveedor, url: a.panelProveedorUrl, empresa: filaEmpresa(a.proveedor, 'proveedor'),
    },
    a.astilladora && a.panelAstilladoraUrl && {
      rol: 'astilladora', nombre: a.astilladora, url: a.panelAstilladoraUrl, empresa: filaEmpresa(a.astilladora, 'astilladora'),
    },
    a.instalacion && a.panelInstalacionUrl && {
      rol: 'instalacion', nombre: a.instalacion, url: a.panelInstalacionUrl, empresa: filaEmpresa(a.instalacion, 'instalacion'),
    },
  ].filter(Boolean)

  const DESC_PANEL = {
    proveedor:   'tus suministros programados; desde ahí adjuntas tu albarán e indicas el origen de la biomasa',
    astilladora: 'los albaranes que tienes asignados; desde ahí confirmas cada carga cuando sale el camión',
    instalacion: 'los camiones que van de camino a tu instalación; desde ahí confirmas la recepción cuando llegan',
  }

  const compartirPanel = (panel, medio) => {
    if (medio === 'whatsapp') {
      setWaModal({
        titulo: `Panel de ${FIRMA_LABELS[panel.rol].toLowerCase()}`,
        empresa: panel.empresa, nombreEmpresa: panel.nombre,
        mensaje: nombre =>
          `Hola${nombre ? ' ' + nombre : ''},\n\n` +
          `Este es el enlace a tu panel de albaranes de Comsa Service. En él tienes ${DESC_PANEL[panel.rol]}.\n\n` +
          `Es siempre el mismo enlace: guárdalo para tenerlo a mano y no lo compartas fuera de tu empresa.\n${panel.url}`,
      })
    }
    if (medio === 'copiar') copiar(panel.url, `panel-${panel.rol}`)
  }

  // Al guardar un contacto nuevo se actualizan todas las fichas de la empresa
  const contactoGuardado = fila => {
    if (!fila?.nombre) return
    setTodasEmpresas(prev => prev.map(e => e.nombre.toLowerCase() === fila.nombre.toLowerCase()
      ? { ...e, contactos: fila.contactos, contacto: fila.contacto, telefono: fila.telefono } : e))
    mostrarToast('Contacto guardado en la ficha')
  }

  return (
    <>
    <PdfLoadingOverlay
      show={generandoPdf.preview || generandoPdf.descargar}
      texto={generandoPdf.preview ? 'Generando vista previa...' : 'Generando PDF...'}
    />
    <div className="detalle-page">
      {toast && (
        <div className="toast-guardado">
          <CheckCircle size={14} /> {toast}
        </div>
      )}
      {previewPdf && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:150,padding:20}}
          onClick={cerrarPreviewPdf}>
          <div style={{background:'#fff',borderRadius:'var(--radius-lg)',width:'100%',maxWidth:900,height:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderBottom:'var(--border)',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:7,fontSize:13,fontWeight:600,color:'var(--gray-800)'}}>
                <Eye size={14} /> Vista previa — Albarán {a.id}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <a href={previewPdf.url} download={previewPdf.nombre} className="btn" style={{fontSize:12,padding:'5px 10px'}}>
                  <FileDown size={13} /> Descargar
                </a>
                <button onClick={cerrarPreviewPdf} style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray-400)',display:'flex',padding:4}}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={previewPdf.url} title={previewPdf.nombre} style={{flex:1,border:'none',width:'100%'}} />
          </div>
        </div>
      )}
      {duplicarOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}
          onClick={() => !duplicando && setDuplicarOpen(false)}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,maxWidth:360,width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <Copy size={18} color="var(--gray-500)" />
              <div style={{fontSize:15,fontWeight:600}}>Duplicar albarán</div>
            </div>
            <div style={{fontSize:13,color:'var(--gray-500)',marginBottom:20}}>
              {a.grupoId
                ? 'Los nuevos albaranes se añadirán a la flota existente.'
                : 'Se creará una copia independiente con los mismos datos.'}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
              <span style={{fontSize:13,color:'var(--gray-700)',fontWeight:500}}>Nº de copias</span>
              <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto'}}>
                <button className="btn" style={{padding:'4px 10px',fontSize:16,lineHeight:1}}
                  onClick={() => setNumCopias(n => Math.max(1, n - 1))} disabled={numCopias <= 1}>−</button>
                <span style={{fontSize:18,fontWeight:700,fontFamily:'var(--font-mono)',minWidth:28,textAlign:'center'}}>{numCopias}</span>
                <button className="btn" style={{padding:'4px 10px',fontSize:16,lineHeight:1}}
                  onClick={() => setNumCopias(n => Math.min(10, n + 1))} disabled={numCopias >= 10}>+</button>
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setDuplicarOpen(false)} disabled={duplicando}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleDuplicar} disabled={duplicando}>
                {duplicando ? 'Creando...' : <><Copy size={13} /> Crear {numCopias === 1 ? 'copia' : `${numCopias} copias`}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {waModal && (
        <CompartirWhatsApp {...waModal} onClose={() => setWaModal(null)} onContactoGuardado={contactoGuardado} />
      )}
      {confirmModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
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
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{marginBottom:12}}>
          <ArrowLeft size={14} /> Volver
        </button>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div className="page-title" style={{fontFamily:'var(--font-mono)',fontSize:18}}>{a.id}</div>
            <Badge estado={a.estado} />
            {esFlota && (
              <div style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:5,background:'var(--blue-50)',border:'1px solid var(--blue-100)',fontSize:12,fontWeight:600,color:'var(--blue-700)'}}>
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
            <MenuPDF a={a} modo="preview"    generando={generandoPdf.preview}   onGenerar={handleGenerarPDF} />
            <MenuPDF a={a} modo="descargar"  generando={generandoPdf.descargar} onGenerar={handleGenerarPDF} />
            <button className="btn" onClick={() => { setDuplicarOpen(true); setNumCopias(1) }}>
              <Copy size={14} /> Duplicar
            </button>
            {a.estado !== 'cerrado' && a.estado !== 'cancelado' && (
              <button className="btn" style={{color:'var(--orange-700)',borderColor:'var(--orange-100)'}}
                onClick={() => { setAnularOpen(true); setMotivoAnulacion('') }}>
                <X size={15} /> Anular
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

      <div className="detalle-content">
        {/* Banner solicitud de revisión */}
        {a.solicitaRevision && (
          <BannerRevision albaranId={a.id} onReabrir={async () => { await refetch?.(); mostrarToast('Albarán reabierto para campo ✓') }} />
        )}

        {/* Banner anulado por oficina */}
        {a.estado === 'cancelado' && (
          <div style={{margin:'0 0 16px',padding:'12px 16px',background:'var(--red-50)',border:'1px solid var(--red-100)',
            borderRadius:'var(--radius-lg)',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:18,flexShrink:0}}>🚫</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--red-700)'}}>Albarán anulado</div>
              <div style={{fontSize:12,color:'var(--red-700)',marginTop:2,opacity:0.8}}>
                {a.motivoRechazoCampo || 'Anulado desde oficina sin motivo especificado.'}
              </div>
            </div>
          </div>
        )}

        {/* Banner rechazado desde campo */}
        {(a.estado === 'rechazado_campo_astilladora' || a.estado === 'rechazado_campo_instalacion') && (
          <div style={{margin:'0 0 16px',padding:'12px 16px',background:'#fff1f2',border:'1px solid #fecdd3',
            borderRadius:'var(--radius-lg)',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:18,flexShrink:0}}>⛔</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#991b1b'}}>
                Rechazado desde campo · {a.estado === 'rechazado_campo_astilladora' ? 'Astilladora' : 'Instalación'}
              </div>
              <div style={{fontSize:12,color:'#b91c1c',marginTop:2}}>
                {a.motivoRechazoCampo
                  ? a.motivoRechazoCampo
                  : 'El equipo de campo marcó este albarán como no gestionado.'}
              </div>
            </div>
            <button
              onClick={async () => {
                setEnviandoACampo(true)
                try { await api.post(`/albaranes/${a.id}/reenviar-campo`); await refetch?.(); mostrarToast('Reenviado a campo ✓') }
                catch {}
                setEnviandoACampo(false)
              }}
              disabled={enviandoACampo}
              style={{padding:'6px 14px',background:'#dc2626',color:'#fff',border:'none',borderRadius:'var(--radius-md)',
                fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0,opacity:enviandoACampo?0.6:1,whiteSpace:'nowrap'}}>
              {enviandoACampo ? '...' : 'Reenviar a campo'}
            </button>
          </div>
        )}

        {/* Banner programado — pendiente de enviar a campo */}
        {a.estado === 'programado' && (
          <div style={{margin:'0 0 16px',padding:'12px 16px',background:'#f5f3ff',border:'1px solid #ddd6fe',
            borderRadius:'var(--radius-lg)',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:18,flexShrink:0}}>📋</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'#5b21b6'}}>Albarán programado — no enviado a campo</div>
              <div style={{fontSize:12,color:'#7c3aed',marginTop:2}}>El equipo de campo no puede ver ni firmar este albarán hasta que lo envíes.</div>
            </div>
            <button
              onClick={async () => {
                setEnviandoACampo(true)
                try { await enviarACampoAlbaran?.([a.id]); mostrarToast('Enviado a campo ✓') }
                catch {}
                setEnviandoACampo(false)
              }}
              disabled={enviandoACampo}
              style={{padding:'6px 14px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:'var(--radius-md)',
                fontSize:12,fontWeight:600,cursor:'pointer',flexShrink:0,opacity:enviandoACampo?0.6:1,whiteSpace:'nowrap'}}>
              {enviandoACampo ? '...' : 'Enviar a campo'}
            </button>
          </div>
        )}

        <div className="detalle-cols">
          <div className="detalle-left">

            {/* ── DATOS DEL ALBARÁN ── */}
            <div className={`card${editandoDatos ? ' seccion-editando' : ''}`} style={{marginBottom:14}}>
              <div className="section-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>Datos del albarán{editandoDatos && <span className="pill-editando">Editando</span>}</span>
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
                  <Grupo>Operación</Grupo>
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
                  <Grupo>Intervinientes</Grupo>
                  <div className="edit-field">
                    <label className="edit-label">Proveedor</label>
                    <SelectField variant="edit" value={formDatos.proveedor} onChange={v => setD('proveedor', v)} options={proveedores} placeholder="Sin proveedor" clearable />
                  </div>
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Astilladora</label>
                    <SelectField variant="edit" value={formDatos.astilladora} onChange={v => setD('astilladora', v)} options={astilladoras} placeholder="Sin astilladora" clearable />
                  </div>
                  )}
                  {formDatos.tipo?.includes('1') && (
                  <div className="edit-field">
                    <label className="edit-label">Transportista</label>
                    <SelectField variant="edit" value={formDatos.transportista} onChange={v => setD('transportista', v)} options={transportistas} placeholder="Sin transportista" clearable />
                  </div>
                  )}
                  <div className="edit-field">
                    <label className="edit-label">Instalación</label>
                    <SelectField variant="edit" value={formDatos.instalacion} onChange={v => setD('instalacion', v)} options={instalaciones} placeholder="Sin instalación" clearable />
                  </div>
                  <Grupo>Material</Grupo>
                  <div className="edit-field">
                    <label className="edit-label">Especie</label>
                    <SelectField variant="edit" value={formDatos.especie || ''} onChange={v => setD('especie', v)} options={especiesTipo} placeholder="Sin especie" clearable />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Tipo biomasa</label>
                    <SelectField variant="edit" value={formDatos.tipoBiomasa || ''} onChange={v => setD('tipoBiomasa', v)} options={tiposBiomasa} placeholder="Sin tipo biomasa" clearable />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Estella</label>
                    <SelectField variant="edit" value={formDatos.estella || ''} onChange={v => setD('estella', v)} options={estellas} placeholder="Sin estella" clearable />
                  </div>
                  <Grupo>Origen y destino</Grupo>
                  <div className="edit-field">
                    <label className="edit-label">Origen</label>
                    <input className="edit-input" value={formDatos.origen} onChange={e => setD('origen', e.target.value)} placeholder="Paraje / término municipal" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Permiso / Ref.</label>
                    <input className="edit-input" value={formDatos.permiso} onChange={e => setD('permiso', e.target.value)} placeholder="Nº permiso o SURE" />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Maps origen</label>
                    <input className="edit-input" type="url" value={formDatos.mapsOrigen} onChange={e => setD('mapsOrigen', e.target.value)} placeholder="https://maps.google.com/..." />
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Maps destino</label>
                    <input className="edit-input" type="url" value={formDatos.mapsDestino} onChange={e => setD('mapsDestino', e.target.value)} placeholder="https://maps.google.com/..." />
                  </div>
                  {formDatos.tipo?.includes('1') && <Grupo>Transporte</Grupo>}
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
                <div className="ver-grupos">
                  <Fila titulo="Operación">
                    <Campo label="Tipo operación" valor={a.tipo} ancho={3} />
                    <Campo label="Certificación">
                      {(() => {
                        // Puede llegar como texto "SURE,PEFC" o como array
                        const certs = (Array.isArray(a.certificacion) ? a.certificacion : String(a.certificacion || '').split(','))
                          .map(c => String(c).trim()).filter(Boolean)
                        return certs.length
                          ? <span className="ver-chips">{certs.map(c => <span key={c} className="ver-chip">{c}</span>)}</span>
                          : null
                      })()}
                    </Campo>
                  </Fila>
                  <Fila titulo="Intervinientes">
                    <Campo label="Proveedor">{linkEmpresa(a.proveedor, 'proveedor')}</Campo>
                    {a.tipo?.includes('1') && <Campo label="Astilladora">{linkEmpresa(a.astilladora, 'astilladora')}</Campo>}
                    {a.tipo?.includes('1') && <Campo label="Transportista">{linkEmpresa(a.transportista, 'transportista')}</Campo>}
                    <Campo label="Instalación">{linkEmpresa(a.instalacion, 'instalacion')}</Campo>
                  </Fila>
                  <Fila titulo="Material">
                    <Campo label="Especie" valor={a.especie} />
                    <Campo label="Tipo biomasa" valor={a.tipoBiomasa} />
                    <Campo label="Estella" valor={a.estella} />
                  </Fila>
                  <Fila titulo="Ubicación">
                    <Campo label="Origen" valor={a.origen} />
                    <Campo label="Permiso / Ref." valor={a.permiso} />
                    {a.tipo?.includes('2') && <Campo label="Referencia SURE" valor={a.referenciaSure} />}
                    <Campo label="Maps">
                      {a.mapsOrigen || a.mapsDestino ? (
                        <span className="ver-chips">
                          {a.mapsOrigen && <a className="ver-link" href={a.mapsOrigen} target="_blank" rel="noreferrer"><MapPin size={11} /> Origen</a>}
                          {a.mapsDestino && <a className="ver-link" href={a.mapsDestino} target="_blank" rel="noreferrer"><MapPin size={11} /> Destino</a>}
                        </span>
                      ) : null}
                    </Campo>
                  </Fila>
                  {a.tipo?.includes('1') && <Fila titulo="Transporte">
                    <Campo label="Matrícula astilladora" valor={a.matriculaAstilladora} />
                    <Campo label="Chófer" valor={a.chofer} />
                    <Campo label="Matrícula tractora" valor={a.matriculaTractora} />
                    <Campo label="Matrícula remolque" valor={a.matriculaRemolque} />
                  </Fila>}
                  <Fila titulo="Notas">
                    <Campo label="Observaciones" valor={a.observaciones} full />
                  </Fila>
                </div>
              )}
            </div>

            {/* ── DATOS DE RECEPCIÓN Y PESADA ── */}
            <div className={`card${editandoPesada ? ' seccion-editando' : ''}`} style={{marginBottom:14}}>
              <div className="section-label" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>Datos de recepción y pesada{editandoPesada && <span className="pill-editando">Editando</span>}</span>
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
                  <div className="edit-field">
                    <label className="edit-label">Peso neto (calculado)</label>
                    <div className="edit-input edit-calc">
                      {formPesada.entrada && formPesada.salida
                        ? (Number(formPesada.entrada) - Number(formPesada.salida)).toLocaleString('es-ES') + ' kg'
                        : '—'}
                    </div>
                  </div>
                  <div className="edit-field">
                    <label className="edit-label">Nº de pesada</label>
                    <input
                      className="edit-input"
                      type="text"
                      value={formPesada.numeroPesada}
                      onChange={e => setP('numeroPesada', e.target.value)}
                      placeholder="Ej: 12345"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="pesada-stats">
                    <div className="pesada-stat">
                      <span className="ver-label">Peso bruto</span>
                      <span className="pesada-num">{a.pesada?.entrada ? <>{a.pesada.entrada.toLocaleString('es-ES')}<small> kg</small></> : '—'}</span>
                    </div>
                    <span className="pesada-op">−</span>
                    <div className="pesada-stat">
                      <span className="ver-label">Tara</span>
                      <span className="pesada-num">{a.pesada?.salida ? <>{a.pesada.salida.toLocaleString('es-ES')}<small> kg</small></> : '—'}</span>
                    </div>
                    <span className="pesada-op">=</span>
                    <div className="pesada-stat neto">
                      <span className="ver-label">Peso neto</span>
                      <span className="pesada-num">{pesoNeto === '—' ? '—' : <>{pesoNeto.replace(' kg', '')}<small> kg</small></>}</span>
                    </div>
                  </div>
                  <div className="edit-grid ver-grid">
                    <Campo label="Humedad">
                      {a.pesada?.humedad != null
                        ? `${a.pesada.humedad}%`
                        : <span className="ver-pend">Pendiente de análisis</span>}
                    </Campo>
                    <Campo label="Nº de pesada" valor={a.pesada?.numeroPesada} />
                  </div>
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
                    className="btn"
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
              {(() => {
                const vacio = { adjunto: false, url: null, nombreFichero: null, tamanyo: null }
                const docs = Object.entries({
                  ...a.docs,
                  ...('Albarán físico adjunto' in (a.docs || {}) ? {} : { 'Albarán físico adjunto': vacio }),
                  ...(!a.tipo?.includes('2') || 'Albarán proveedor' in (a.docs || {}) ? {} : { 'Albarán proveedor': vacio })
                })
                const total    = docs.length
                const adjuntos = docs.filter(([, d]) => d.adjunto).length
                // Agrupados por para qué sirven; lo que no encaje va a "Otros"
                const grupos = GRUPOS_DOC
                  .map(g => ({ ...g, docs: docs.filter(([n]) => g.docs.includes(n)) }))
                  .concat([{ titulo: 'Otros', docs: docs.filter(([n]) => !GRUPOS_DOC.some(g => g.docs.includes(n))) }])
                  .filter(g => g.docs.length)

                return <>
                  <div className="doc-head">
                    <div className="section-label" style={{margin:0}}>Documentación</div>
                    <span className={`doc-progreso${adjuntos === total ? ' completo' : ''}`}>
                      {adjuntos === total ? <><Check size={12} /> Completa</> : <>{adjuntos} de {total} adjuntos</>}
                    </span>
                  </div>

                  {grupos.map(g => (
                    <div key={g.titulo} className="doc-grupo">
                      <div className="doc-grupo-titulo">{g.titulo}</div>
                      {g.docs.map(([nombre, doc]) => {
                        const isDragOver = dragOverDoc === nombre
                        return (
                          <div
                            key={nombre}
                            className={`doc-row${doc.adjunto ? ' ok' : ''}${isDragOver ? ' drag' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragOverDoc(nombre) }}
                            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDoc(null) }}
                            onDrop={e => handleDropDoc(nombre, e)}
                          >
                            <span className="doc-estado">{doc.adjunto ? <Check size={13} /> : <span className="doc-hueco" />}</span>
                            <span className="doc-nombre">{nombre}</span>
                            <span className="doc-meta">
                              {isDragOver
                                ? 'Suelta para adjuntar'
                                : doc.adjunto && doc.nombreFichero ? `${doc.nombreFichero} · ${formatBytes(doc.tamanyo)}` : ''}
                            </span>
                            {borrarDoc === nombre ? (
                            <div className="doc-acciones">
                              <span className="doc-confirm">¿Eliminar archivo?</span>
                              <button type="button" className="btn doc-btn" onClick={() => setBorrarDoc(null)} disabled={borrandoDoc}>No</button>
                              <button type="button" className="btn doc-btn doc-btn-borrar" onClick={() => confirmarBorrarDoc(nombre)} disabled={borrandoDoc}>
                                {borrandoDoc ? 'Eliminando…' : 'Sí, eliminar'}
                              </button>
                            </div>
                            ) : (
                            <div className="doc-acciones">
                              {doc.adjunto && doc.url && (
                                <a href={doc.url} target="_blank" rel="noreferrer" className="btn doc-btn"><Eye size={11} /> Ver</a>
                              )}
                              <button
                                type="button"
                                className="btn doc-btn"
                                onClick={() => fileRefs.current[nombre]?.click()}
                                disabled={subiendo[nombre]}
                                title={doc.adjunto ? 'Sustituir el archivo' : 'Adjuntar archivo (o arrástralo a la fila)'}
                              >
                                {subiendo[nombre] ? 'Subiendo…' : doc.adjunto ? <><RefreshCw size={11} /> Cambiar</> : <><Upload size={11} /> Adjuntar</>}
                              </button>
                              {doc.adjunto && a.estado !== 'cerrado' && (
                                <button type="button" className="btn doc-btn doc-btn-icono" title="Eliminar archivo"
                                  onClick={() => setBorrarDoc(nombre)}>
                                  <Trash2 size={11} />
                                </button>
                              )}
                              <input
                                type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                                ref={el => fileRefs.current[nombre] = el}
                                onChange={e => handleSubirDoc(nombre, e)}
                              />
                            </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </>
              })()}
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
                        {key !== 'oficina' && <div className="firma-sub">{firma.actor}</div>}
                      </div>
                      {firma.firmado
                        ? <span className="badge badge-green"><CheckCircle size={10} /> Firmado</span>
                        : <span className="badge badge-amber"><Clock size={10} /> Pendiente</span>
                      }
                    </div>
                    {firma.firmado && firma.nombrePersona && key !== 'oficina' && (
                      <div style={{fontSize:11,color:'var(--gray-500)',marginTop:2}}>
                        Persona: {firma.nombrePersona}
                        {firma.telefonoPersona && <span style={{marginLeft:8}}>· Tel: {normalizarTelefono(firma.telefonoPersona)}</span>}
                      </div>
                    )}
                    {firma.firmado && <div className="firma-fecha">{firma.fecha}</div>}
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
              {urlSiguientePaso && a.estado !== 'programado' ? (
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
                    <button className="btn" style={{fontSize:11,padding:'5px 8px'}}
                      disabled={regenerando}
                      title="Invalida este enlace y genera uno nuevo"
                      onClick={handleRegenerarEnlace}>
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  {/* Compartir */}
                  <div style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--gray-400)',marginBottom:6}}>
                    Compartir por
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={() => compartirUrl(urlSiguientePaso, 'whatsapp')}
                      style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 8px',borderRadius:'var(--radius-sm)',border:'1px solid #d1fae5',background:'#ecfdf5',color:'#065f46',fontSize:11,fontWeight:500,cursor:'pointer'}}>
                      <WaIcon size={12} /> WhatsApp
                    </button>
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
                  {a.estado === 'pendiente_campo' && (
                    <div className="aviso-notificado">
                      {notificado
                        ? <><span className="aviso-notificado-si"><Check size={11} /> {textoNotificado(notificado, { conQuien: true })}</span>
                            <button type="button" onClick={() => marcarNotificado('manual', true)}>Quitar</button></>
                        : <button type="button" onClick={() => marcarNotificado('manual')}
                            title="Opcional: deja constancia si le has avisado por otra vía">Marcar como notificado</button>}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{fontSize:12,color:'var(--gray-400)',fontStyle:'italic'}}>
                  {a.estado === 'programado'
                    ? 'Envía el albarán a campo para generar el enlace de firma'
                    : a.estado === 'cerrado'
                    ? 'Todas las firmas completadas'
                    : 'Todas las firmas externas completadas — pendiente de firma oficina'}
                </div>
              )}

              {paneles.length > 0 && (
                <>
                  <div style={{borderTop:'var(--border)',margin:'12px 0 10px'}} />
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--gray-400)',marginBottom:8}}>
                    Paneles diarios
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {paneles.map(panel => (
                      <div key={panel.rol} style={{background:'var(--gray-50)',border:'var(--border)',borderRadius:'var(--radius-md)',padding:'8px 10px'}}>
                        <div style={{fontSize:11,fontWeight:600,color:'var(--gray-600)',marginBottom:3}}>
                          {{ astilladora: 'Astilladora', instalacion: 'Instalación', proveedor: 'Proveedor' }[panel.rol]} · {panel.nombre}
                        </div>
                        <code style={{fontSize:10,color:'var(--gray-500)',wordBreak:'break-all',display:'block',marginBottom:6}}>
                          {panel.url}
                        </code>
                        <div style={{display:'flex',gap:5}}>
                          <button className="btn btn-primary" style={{flex:1,fontSize:11,padding:'4px 8px'}}
                            onClick={() => compartirPanel(panel, 'copiar')}>
                            {copiado === `panel-${panel.rol}` ? <><CheckCircle size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                          </button>
                          <button
                            style={{flex:1,display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4,padding:'4px 8px',borderRadius:'var(--radius-sm)',border:'1px solid #d1fae5',background:'#ecfdf5',color:'#065f46',fontSize:11,fontWeight:500,cursor:'pointer'}}
                            onClick={() => compartirPanel(panel, 'whatsapp')}>
                            <WaIcon size={11} /> WhatsApp
                          </button>
                          <button className="btn" style={{fontSize:11,padding:'4px 8px'}}
                            onClick={() => window.open(panel.url, '_blank')}>
                            <ExternalLink size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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

    {anularOpen && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
        <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <X size={20} color='var(--orange-700)' />
            <span style={{fontSize:16,fontWeight:600}}>Anular albarán</span>
          </div>
          <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:14}}>
            El albarán <strong>{a.id}</strong> quedará marcado como <em>anulado</em>. Podrá consultarse en Albaranes pero no se podrá firmar.
          </p>
          <textarea
            autoFocus
            value={motivoAnulacion}
            onChange={e => setMotivoAnulacion(e.target.value)}
            placeholder="Motivo de la anulación (opcional): camión extraviado, error de asignación…"
            rows={3}
            style={{width:'100%',fontSize:13,padding:'8px 10px',borderRadius:'var(--radius-sm)',
              border:'1px solid var(--gray-200)',resize:'none',outline:'none',
              fontFamily:'inherit',marginBottom:16,boxSizing:'border-box'}}
          />
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn" onClick={() => setAnularOpen(false)}>Cancelar</button>
            <button
              className="btn"
              disabled={anulando}
              style={{background:'var(--orange-400)',color:'#fff',borderColor:'var(--orange-400)',opacity:anulando?0.6:1}}
              onClick={async () => {
                setAnulando(true)
                try {
                  await api.post(`/albaranes/${a.id}/cancelar`, { motivo: motivoAnulacion })
                  await refetch?.()
                  mostrarToast('Albarán anulado ✓')
                } catch {}
                setAnulando(false)
                setAnularOpen(false)
              }}
            >
              <X size={14} /> {anulando ? 'Anulando…' : 'Confirmar anulación'}
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
              onClick={async () => { await borrarAlbaran(a.id); setConfirmBorrar(false); navigate('/albaranes') }}
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

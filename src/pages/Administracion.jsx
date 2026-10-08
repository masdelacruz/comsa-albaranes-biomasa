import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, X, Check, Upload, Image, ExternalLink, Copy, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import EmpresaModal, { normalizarTelefono, TIPOS, TIPO_LABELS } from '../components/EmpresaModal'
import Usuarios from './Usuarios'
import Auditoria from './Auditoria'
import '../components/shared.css'
import './Administracion.css'

const SUBTITULOS = {
  elementos: 'Valores de los desplegables de biomasa y especie en los albaranes',
  logos:     'Logos y certificaciones para la cabecera de los albaranes PDF',
  usuarios:  'Gestión de usuarios y accesos a la aplicación',
  auditoria: 'Registro de acciones administrativas',
}
const SUBTITULO_DEFECTO = 'Gestión de astilladoras, transportistas e instalaciones'

const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

const LOGOS_SECTIONS = [
  {
    key: 'corporativos',
    titulo: 'Corporativos',
    color: '#1D9E75',
    logos: [
      { id: 'comsa', nombre: 'COMSA Service', descripcion: 'Logotipo corporativo · cabecera de todos los albaranes PDF' },
    ],
  },
  {
    key: 'applus',
    titulo: 'Applus®',
    color: '#E8720C',
    logos: [
      { id: 'applus_1', nombre: 'ISO 9001',  descripcion: 'Gestión de calidad · EC-1952/05' },
      { id: 'applus_2', nombre: 'ISO 14001', descripcion: 'Gestión ambiental · MA-0904/08' },
      { id: 'applus_3', nombre: 'ISO 45001', descripcion: 'Seguridad y salud laboral · PRL-4023/19' },
      { id: 'applus_4', nombre: 'ISO 50001', descripcion: 'Gestión energética · SGE-0021/24' },
    ],
  },
  {
    key: 'certs',
    titulo: 'Certificaciones',
    color: '#1D9E75',
    logos: [
      { id: 'pefc', nombre: 'PEFC', descripcion: 'Cadena de custodia forestal certificada · PEFC/14-31-00318' },
      { id: 'sure', nombre: 'SURE', descripcion: 'Biomasa sostenible verificada · SURE EU/ES 001/Z202 2281' },
    ],
  },
]
// Lista plana para compatibilidad con funciones de subida/borrado
const LOGOS_CONFIG = LOGOS_SECTIONS.flatMap(s => s.logos)

export default function Administracion({ usuario }) {
  const [searchParams] = useSearchParams()
  const esSuperadmin = usuario?.nivel === 'superadmin'

  const [proveedores, setProveedores]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState(() => {
    const t = searchParams.get('tab')
    if (t === 'auditoria') return esSuperadmin ? 'auditoria' : 'proveedor'
    if (t === 'usuarios') return esSuperadmin ? 'usuarios' : 'proveedor'
    return TIPOS.includes(t) ? t : 'proveedor'
  })
  const [busqueda, setBusqueda]           = useState('')
  const [modal, setModal]                 = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [copiadoPanel, setCopiadoPanel]   = useState(null)
  const [regenerandoCodigo, setRegenerandoCodigo] = useState(null)

  // Logos state
  const [logos, setLogos]                   = useState({})
  const [subiendoLogo, setSubiendoLogo]     = useState({})
  const [errorLogos, setErrorLogos]         = useState({})
  const [confirmDelLogo, setConfirmDelLogo] = useState(null)
  const [dragOverLogo, setDragOverLogo]     = useState(null)
  const [logoModalEmpresa, setLogoModalEmpresa]   = useState(null)
  const [dragOverLogoModal, setDragOverLogoModal] = useState(false)
  const [confirmBorrarLogo, setConfirmBorrarLogo] = useState(false)

  // Elementos state
  const [elementos, setElementos]   = useState({ especie: [], tipoBiomasa: [], estella: [] })
  const [nuevoElem, setNuevoElem]   = useState({ especie: '', tipoBiomasa: '', estella: '' })
  const [agregando, setAgregando]   = useState({})
  const logoFileRefs = useRef({})

  // ── data fetching ───────────────────────────────────────────────────────────

  const fetchElementos = async () => {
    try {
      const data = await api.get('/elementos')
      setElementos({ especie: data.especie || [], tipoBiomasa: data.tipoBiomasa || [], estella: data.estella || [] })
    } catch {}
  }

  const handleAgregarElemento = async (tipo) => {
    const valor = nuevoElem[tipo].trim()
    if (!valor) return
    setAgregando(s => ({ ...s, [tipo]: true }))
    try {
      await api.post('/elementos', { tipo, valor })
      setNuevoElem(s => ({ ...s, [tipo]: '' }))
      await fetchElementos()
    } finally {
      setAgregando(s => ({ ...s, [tipo]: false }))
    }
  }

  const handleEliminarElemento = async (id, tipo) => {
    await api.delete(`/elementos/${id}`)
    setElementos(prev => ({ ...prev, [tipo]: prev[tipo].filter(e => e.id !== id) }))
  }

  const fetchProveedores = async () => {
    const data = await api.get('/empresas')
    setProveedores(data || [])
    setLoading(false)
  }

  const fetchLogos = async () => {
    try {
      const map = await api.get('/storage/logos')
      setLogos(map || {})
    } catch {}
  }

  // Desde la ficha de un cliente se llega con ?editar=<id>: abre directamente
  // el modal de edición de esa empresa en cuanto se cargan.
  const editarInicial = useRef(searchParams.get('editar'))
  useEffect(() => {
    if (!editarInicial.current || !proveedores.length) return
    const p = proveedores.find(x => String(x.id) === editarInicial.current)
    editarInicial.current = null
    if (p) abrirEditar(p)
  }, [proveedores])

  useEffect(() => {
    fetchProveedores()
    fetchLogos()
    fetchElementos()
  }, [])

  // ── providers tab helpers ───────────────────────────────────────────────────

  const filtrados = proveedores.filter(p => {
    if (p.tipo !== tab) return false
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const abrirNuevo = () => setModal({ empresa: null })
  const abrirEditar = (p) => setModal({ empresa: p })

  const handleToggleActivo = async (p) => {
    await api.patch(`/empresas/${p.id}`, { activo: !p.activo })
    await fetchProveedores()
  }

  const tienePanel = (p) => p.tipo === 'astilladora' || p.tipo === 'instalacion' || p.tipo === 'proveedor'
  const panelUrl = (p) => {
    const base = `/campo/${p.tipo}/${p.nombre.replace(/\s+/g, '-')}`
    return `${window.location.origin}${base}?c=${encodeURIComponent(p.acceso_codigo || '')}`
  }

  const handleCopiarPanel = (p) => {
    navigator.clipboard.writeText(panelUrl(p))
    setCopiadoPanel(p.id)
    setTimeout(() => setCopiadoPanel(null), 2000)
  }

  const handleRegenerarCodigo = async (p) => {
    if (!window.confirm(`El enlace del panel actual de "${p.nombre}" dejará de funcionar. ¿Generar uno nuevo?`)) return
    setRegenerandoCodigo(p.id)
    try {
      await api.post(`/empresas/${p.id}/regenerar-codigo-acceso`, {})
      await fetchProveedores()
    } catch {}
    setRegenerandoCodigo(null)
  }

  const handleEliminar = async (id) => {
    await api.delete(`/empresas/${id}`)
    await fetchProveedores()
    setConfirmDelete(null)
  }

  const counts = {}
  TIPOS.forEach(t => { counts[t] = proveedores.filter(p => p.tipo === t).length })

  // ── certificaciones helpers ─────────────────────────────────────────────────

  const handleSubirLogo = async (id, file) => {
    if (!file) return
    setSubiendoLogo(s => ({ ...s, [id]: true }))
    setErrorLogos(e => ({ ...e, [id]: null }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { url } = await api.upload(`/storage/upload/logos/${id}`, fd)
      setLogos(l => ({ ...l, [id]: `${url}?t=${Date.now()}` }))
    } catch (err) {
      setErrorLogos(e => ({ ...e, [id]: err.message || 'Error desconocido' }))
    } finally {
      setSubiendoLogo(s => ({ ...s, [id]: false }))
      if (logoFileRefs.current[id]) logoFileRefs.current[id].value = ''
    }
  }

  const handleEliminarLogo = async (id) => {
    try {
      await api.delete(`/storage/logos/${id}`)
      setLogos(l => { const n = { ...l }; delete n[id]; return n })
    } catch (err) {
      console.error('Error eliminando logo:', err)
    } finally {
      setConfirmDelLogo(null)
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="admin-page">
      <div className="page-header">
        <div className="page-title">Configuración</div>
        <div className="page-sub">{SUBTITULOS[tab] || SUBTITULO_DEFECTO}</div>
      </div>

      <div className="admin-content">
        <div className="admin-tabs">
          {TIPOS.map(t => (
            <button
              key={t}
              className={`admin-tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); setBusqueda('') }}
            >
              {TIPO_LABELS[t]} <span style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 4 }}>({counts[t]})</span>
            </button>
          ))}
          <button
            className={`admin-tab ${tab === 'elementos' ? 'active' : ''}`}
            onClick={() => setTab('elementos')}
          >
            Elementos
          </button>
          <button
            className={`admin-tab ${tab === 'logos' ? 'active' : ''}`}
            onClick={() => setTab('logos')}
          >
            Logos
          </button>
          {esSuperadmin && (
            <>
              <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--gray-200)', margin: '4px 2px' }} />
              <button
                className={`admin-tab ${tab === 'usuarios' ? 'active' : ''}`}
                onClick={() => setTab('usuarios')}
              >
                Usuarios
              </button>
            </>
          )}
          {esSuperadmin && (
            <button
              className={`admin-tab ${tab === 'auditoria' ? 'active' : ''}`}
              onClick={() => setTab('auditoria')}
            >
              Auditoría
            </button>
          )}
        </div>

        {/* ── Elementos panel ── */}
        {tab === 'elementos' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
              Configura los valores de los desplegables de tipo de biomasa y especie en los albaranes.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {[
                { tipo: 'especie',     titulo: 'Especie' },
                { tipo: 'tipoBiomasa', titulo: 'Tipo de biomasa' },
                { tipo: 'estella',     titulo: 'Estella' },
              ].map(({ tipo, titulo }) => (
                <div key={tipo} className="card" style={{ padding: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-800)', marginBottom: 12 }}>{titulo}</div>
                  <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {elementos[tipo].length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', padding: '6px 0' }}>Sin valores configurados</div>
                    )}
                    {elementos[tipo].map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)' }}>
                        <span style={{ fontSize: 13, color: 'var(--gray-700)' }}>{e.valor}</span>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '2px 6px', color: 'var(--red-400)' }}
                          onClick={() => handleEliminarElemento(e.id, tipo)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder={`Nuevo ${titulo.toLowerCase()}...`}
                      value={nuevoElem[tipo]}
                      onChange={e => setNuevoElem(s => ({ ...s, [tipo]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleAgregarElemento(tipo) }}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)', fontSize: 13 }}
                    />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: 13 }}
                      onClick={() => handleAgregarElemento(tipo)}
                      disabled={!nuevoElem[tipo].trim() || agregando[tipo]}
                    >
                      <Plus size={13} /> Añadir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Logos panel ── */}
        {tab === 'logos' ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
              Logos que aparecen en la cabecera de los albaranes PDF. Formatos admitidos: PNG, JPG, SVG, WEBP.
            </div>

            {(() => {
              const renderCard = (cfg) => {
                const url        = logos[cfg.id]
                const subiendo   = !!subiendoLogo[cfg.id]
                const error      = errorLogos[cfg.id]
                const isDragOver = dragOverLogo === cfg.id
                return (
                  <div key={cfg.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>{cfg.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{cfg.descripcion}</div>
                    <div
                      style={{
                        border: isDragOver ? '2px dashed var(--green-400)' : '1px dashed var(--gray-200)',
                        borderRadius: 4, minHeight: 86, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer',
                        background: isDragOver ? 'rgba(29,158,117,0.06)' : 'var(--gray-50,#fafafa)',
                        overflow: 'hidden', transition: 'border 0.15s, background 0.15s',
                      }}
                      onClick={() => logoFileRefs.current[cfg.id]?.click()}
                      onDragOver={e => { e.preventDefault(); setDragOverLogo(cfg.id) }}
                      onDragLeave={() => setDragOverLogo(null)}
                      onDrop={e => { e.preventDefault(); setDragOverLogo(null); handleSubirLogo(cfg.id, e.dataTransfer.files?.[0]) }}
                    >
                      {subiendo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--gray-400)' }}>
                          <div style={{ width: 20, height: 20, border: '2px solid var(--green-400)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                          <span style={{ fontSize: 11 }}>Subiendo...</span>
                        </div>
                      ) : isDragOver ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--green-400)' }}>
                          <Upload size={22} />
                          <span style={{ fontSize: 11 }}>Soltar aquí</span>
                        </div>
                      ) : url ? (
                        <img src={url} alt={cfg.nombre} style={{ maxWidth: '100%', maxHeight: 86, objectFit: 'contain', padding: 6 }} />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--gray-300)' }}>
                          <Image size={26} />
                          <span style={{ fontSize: 11 }}>Soltar o clicar</span>
                        </div>
                      )}
                    </div>
                    {error && <div style={{ fontSize: 11, color: 'var(--red-600)', background: 'var(--red-50,#fff1f1)', border: '1px solid var(--red-100)', borderRadius: 3, padding: '4px 8px' }}>⚠ {error}</div>}
                    <input ref={el => { logoFileRefs.current[cfg.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleSubirLogo(cfg.id, e.target.files?.[0])} />
                    {confirmDelLogo === cfg.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '6px 4px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--red-700)', fontWeight: 500 }}>¿Eliminar imagen?</span>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: 11, color: 'var(--red-700)', borderColor: 'var(--red-200)' }}
                          onClick={() => handleEliminarLogo(cfg.id)}><Check size={11} /> Sí</button>
                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setConfirmDelLogo(null)}><X size={11} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary" style={{ flex: 1, fontSize: 11, padding: '5px 10px' }}
                          disabled={subiendo} onClick={() => logoFileRefs.current[cfg.id]?.click()}>
                          <Upload size={12} /> {url ? 'Reemplazar' : 'Subir'}
                        </button>
                        {url && (
                          <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11, color: 'var(--red-400)' }}
                            onClick={() => setConfirmDelLogo(cfg.id)}><Trash2 size={12} /></button>
                        )}
                      </div>
                    )}
                  </div>
                )
              }

              const renderSection = (key, titulo, color, items) => items.length === 0 ? null : (
                <div key={key} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    {titulo}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {items.map(renderCard)}
                  </div>
                </div>
              )

              return (
                <>
                  {LOGOS_SECTIONS.map(s =>
                    renderSection(s.key, s.titulo, s.color, s.logos)
                  )}
                </>
              )
            })()}
          </div>
        ) : tab === 'usuarios' ? (
          <div style={{ marginTop: 16 }}>
            {esSuperadmin && <Usuarios usuario={usuario} embedded />}
          </div>
        ) : tab === 'auditoria' ? (
          esSuperadmin && (
            <div style={{ marginTop: 16 }}>
              <Auditoria embedded />
            </div>
          )
        ) : tab !== 'elementos' ? (
          /* ── Providers panel ── */
          <>
            <div className="admin-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="admin-search">
                  <Search size={13} className="admin-search-icon" />
                  <input
                    type="text"
                    placeholder={`Buscar ${TIPO_LABELS[tab].toLowerCase()}...`}
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
                </div>
              </div>
              <button className="btn btn-primary" onClick={abrirNuevo}>
                <Plus size={15} /> Nuevo
              </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="proveedor-table-wrap">
              <table className="proveedor-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Contacto</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="empty-row">Cargando...</td></tr>
                  ) : filtrados.length === 0 ? (
                    <tr><td colSpan={6} className="empty-row">No hay {TIPO_LABELS[tab].toLowerCase()}s registrados</td></tr>
                  ) : filtrados.map(p => (
                    <tr key={p.id} onClick={() => abrirEditar(p)}>
                      <td className="nombre-col" style={{ fontWeight: 500, color:'var(--blue-700)', textDecoration:'underline', textDecorationColor:'var(--gray-200)' }}>
                        {p.nombre}
                        {p.tipo === 'proveedor' && p.es_sure && (
                          <span title={`Referencia SURE: ${p.referencia_sure || '—'}`}
                            style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--green-600)', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 3, padding: '1px 6px', textDecoration: 'none', display: 'inline-block', verticalAlign: 'middle' }}>
                            SURE · {p.referencia_sure || '—'}
                          </span>
                        )}
                      </td>
                      <td className="contacto-col" style={{ color: 'var(--gray-600)' }}>
                        {p.contacto || <span style={{ color: 'var(--gray-300)' }}>—</span>}
                        {(p.contactos?.length || 0) > 1 && (
                          <span title={p.contactos.slice(1).map(c => c.nombre).filter(Boolean).join(', ')}
                            style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: 'var(--gray-500)', background: 'var(--gray-100)', borderRadius: 4, padding: '1px 6px' }}>
                            +{p.contactos.length - 1}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--blue-700)' }}>
                        {p.email
                          ? <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()} style={{ color: 'var(--blue-700)' }}>{p.email}</a>
                          : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--gray-600)' }}>{normalizarTelefono(p.telefono) || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                      <td>
                        <button
                          onClick={e => { e.stopPropagation(); handleToggleActivo(p) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 12, color: p.activo ? 'var(--green-600)' : 'var(--gray-400)', padding: 0 }}
                        >
                          <span className={`activo-dot ${p.activo ? 'si' : 'no'}`} />
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="acciones-col">
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => abrirEditar(p)}>
                            <Pencil size={12} /> Editar
                          </button>
                          {tienePanel(p) && (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 11, color: logos[`empresa_${slugify(p.nombre)}`] ? 'var(--green-600)' : 'var(--gray-400)' }}
                              title={logos[`empresa_${slugify(p.nombre)}`] ? 'Logo registrado (también su firma) · click para cambiar' : 'Sin logo · click para añadir'}
                              onClick={() => { setConfirmBorrarLogo(false); setLogoModalEmpresa(p) }}
                            >
                              <Image size={12} /> Logo
                            </button>
                          )}
                          {tienePanel(p) && (
                            <>
                              <a
                                className="btn btn-ghost"
                                style={{ padding: '4px 8px', fontSize: 11, color: 'var(--gray-500)', textDecoration: 'none' }}
                                href={panelUrl(p)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                title="Abrir panel externo"
                              >
                                <ExternalLink size={12} /> Panel
                              </a>
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '4px 8px', fontSize: 11, color: copiadoPanel === p.id ? 'var(--green-600)' : 'var(--gray-500)' }}
                                onClick={() => handleCopiarPanel(p)}
                                title="Copiar enlace del panel (con código de acceso)"
                              >
                                {copiadoPanel === p.id ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                              {esSuperadmin && (
                                <button
                                  className="btn btn-ghost"
                                  style={{ padding: '4px 8px', fontSize: 11, color: 'var(--gray-500)' }}
                                  disabled={regenerandoCodigo === p.id}
                                  onClick={() => handleRegenerarCodigo(p)}
                                  title="Regenerar código de acceso (el enlace anterior deja de funcionar)"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                            </>
                          )}
                          {confirmDelete === p.id ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--red-700)' }}>¿Eliminar?</span>
                              <button className="btn" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red-700)', borderColor: 'var(--red-100)' }} onClick={() => handleEliminar(p.id)}>
                                <Check size={11} /> Sí
                              </button>
                              <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setConfirmDelete(null)}>
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--red-400)' }} onClick={() => setConfirmDelete(p.id)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Modal logo empresa (astilladora/instalacion) — también se usa como firma/sello */}
      {logoModalEmpresa && (() => {
        const logoId  = `empresa_${slugify(logoModalEmpresa.nombre)}`
        const logoUrl = logos[logoId]
        const subiendo = !!subiendoLogo[logoId]
        return (
          <div className="modal-overlay" onClick={() => { setLogoModalEmpresa(null); setConfirmBorrarLogo(false) }}>
            <div className="modal" style={{maxWidth:360}} onClick={e => e.stopPropagation()}>
              <div className="modal-title">Logo — {logoModalEmpresa.nombre}</div>
              <div style={{marginBottom:16}}>
                <div
                  style={{
                    border: dragOverLogoModal ? '2px dashed var(--green-400)' : logoUrl ? '1px solid var(--gray-200)' : '1px dashed var(--gray-200)',
                    borderRadius:5, padding: logoUrl ? 16 : 24,
                    background: dragOverLogoModal ? 'rgba(29,158,117,0.06)' : 'var(--gray-50)',
                    textAlign:'center', marginBottom:14, cursor:'pointer', transition:'border 0.15s, background 0.15s',
                  }}
                  onClick={() => document.getElementById('logo-input-modal').click()}
                  onDragOver={e => { e.preventDefault(); setDragOverLogoModal(true) }}
                  onDragLeave={() => setDragOverLogoModal(false)}
                  onDrop={e => { e.preventDefault(); setDragOverLogoModal(false); if(e.dataTransfer.files[0]) handleSubirLogo(logoId, e.dataTransfer.files[0]) }}
                >
                  {dragOverLogoModal ? (
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--green-400)'}}>
                      <Upload size={22}/><span style={{fontSize:12}}>Soltar aquí</span>
                    </div>
                  ) : logoUrl ? (
                    <>
                      <img src={logoUrl} alt="Logo" style={{maxHeight:90,maxWidth:'100%',objectFit:'contain'}} />
                      <div style={{fontSize:11,color:'var(--green-600)',marginTop:6,fontWeight:500}}>✓ Logo registrado · clic o arrastra para cambiar</div>
                    </>
                  ) : (
                    <div style={{color:'var(--gray-400)',fontSize:13}}>
                      <Upload size={20} style={{margin:'0 auto 6px',display:'block'}}/>
                      Sin logo · clic o arrastra para subir
                    </div>
                  )}
                </div>
                <input id="logo-input-modal" type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => { if(e.target.files[0]) handleSubirLogo(logoId, e.target.files[0]); e.target.value='' }}
                  disabled={subiendo}
                />
                {subiendo && <div style={{fontSize:12,color:'var(--gray-400)',textAlign:'center',marginBottom:8}}>Subiendo...</div>}
                <div style={{fontSize:11,color:'var(--gray-400)',textAlign:'center',marginBottom:12}}>
                  PNG, JPG, SVG, WEBP · Cabecera del panel externo y firma/sello al confirmar desde el campo
                </div>
                {logoUrl && (
                  confirmBorrarLogo ? (
                    <div style={{display:'flex',gap:6,alignItems:'center',justifyContent:'center',padding:'8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:5}}>
                      <span style={{fontSize:12,color:'var(--red-700)',fontWeight:500}}>¿Eliminar logo?</span>
                      <button className="btn" style={{padding:'4px 10px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-200)'}}
                        onClick={async () => { await handleEliminarLogo(logoId); setConfirmBorrarLogo(false) }}><Check size={11}/> Sí</button>
                      <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}}
                        onClick={() => setConfirmBorrarLogo(false)}><X size={11}/></button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost" style={{width:'100%',fontSize:12,color:'var(--red-400)',justifyContent:'center'}}
                      onClick={() => setConfirmBorrarLogo(true)}>
                      <Trash2 size={13}/> Eliminar logo
                    </button>
                  )
                )}
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={() => { setLogoModalEmpresa(null); setConfirmBorrarLogo(false) }}>Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {modal && (
        <EmpresaModal
          empresa={modal.empresa}
          tipoInicial={tab}
          logos={logos}
          onLogoChange={(id, url) => setLogos(l => { const n = { ...l }; if (url) n[id] = url; else delete n[id]; return n })}
          onClose={() => setModal(null)}
          onSaved={fetchProveedores}
        />
      )}
    </div>
  )
}

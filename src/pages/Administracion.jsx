import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, Check, Upload, Image, ExternalLink } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'
import './Administracion.css'

function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

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

const TIPOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']
const TIPO_LABELS = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }

const EMPTY_FORM = { nombre: '', tipo: 'proveedor', contacto: '', email: '', telefono: '', notas: '', activo: true, trabajadores: [], maquinas: [] }

const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

const LOGOS_SECTIONS = [
  {
    key: 'corporativos',
    titulo: 'Corporativos',
    color: '#1D9E75',
    logos: [
      { id: 'comsa', nombre: 'COMSA Service', descripcion: 'Logotipo corporativo · cabecera de todos los albaranes PDF' },
      { id: 'panel-header', nombre: 'Logo panel instalación', descripcion: 'Aparece en la cabecera del panel de recepción de camiones · reemplaza el icono de hoja' },
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
  const esSuperadmin = usuario?.nivel === 'superadmin'

  const [proveedores, setProveedores]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState('proveedor')
  const [busqueda, setBusqueda]           = useState('')
  const [modal, setModal]                 = useState(false)
  const [editando, setEditando]           = useState(null)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [guardando, setGuardando]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [subiendoFirma, setSubiendoFirma]         = useState(false)
  const [firmaUrl, setFirmaUrl]                   = useState(null)
  const [firmaModalEmpresa, setFirmaModalEmpresa] = useState(null)
  const [dragOverFirma, setDragOverFirma]         = useState(false)
  const [confirmBorrarFirma, setConfirmBorrarFirma] = useState(false)

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

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ ...EMPTY_FORM, tipo: tab })
    setModal(true)
  }

  const abrirEditar = (p) => {
    setEditando(p.id)
    setForm({ nombre: p.nombre, tipo: p.tipo, contacto: p.contacto || '', email: p.email || '', telefono: p.telefono || '', notas: p.notas || '', activo: p.activo, trabajadores: p.trabajadores || [], maquinas: p.maquinas || [] })
    setFirmaUrl(p.firma_imagen || null)
    setModal(true)
  }

  const cerrarModal = () => { setModal(false); setEditando(null); setForm(EMPTY_FORM); setFirmaUrl(null); setDragOverFirma(false); setConfirmBorrarFirma(false) }

  const handleSubirFirma = async (fichero) => {
    if (!fichero || !editando) return
    setSubiendoFirma(true)
    try {
      const fd = new FormData()
      fd.append('file', fichero)
      const token = localStorage.getItem('biomasa_token')
      const res = await fetch(`/api/storage/upload/empresa/${editando}/firma`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const { url } = await res.json()
      setFirmaUrl(url)
      await fetchProveedores()
    } finally {
      setSubiendoFirma(false)
    }
  }

  const handleSubirFirmaModal = async (fichero) => {
    if (!fichero || !firmaModalEmpresa) return
    setSubiendoFirma(true)
    try {
      const fd = new FormData()
      fd.append('file', fichero)
      const token = localStorage.getItem('biomasa_token')
      const res = await fetch(`/api/storage/upload/empresa/${firmaModalEmpresa.id}/firma`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const { url } = await res.json()
      setFirmaModalEmpresa(prev => prev ? { ...prev, firma_imagen: url } : null)
      setProveedores(prev => prev.map(p => p.id === firmaModalEmpresa.id ? { ...p, firma_imagen: url } : p))
    } finally {
      setSubiendoFirma(false)
    }
  }

  const handleBorrarFirma = async (empresaId, isQuickModal = false) => {
    try {
      await api.delete(`/storage/empresa/${empresaId}/firma`)
      if (isQuickModal) {
        setFirmaModalEmpresa(prev => prev ? { ...prev, firma_imagen: null } : null)
        setProveedores(prev => prev.map(p => p.id === empresaId ? { ...p, firma_imagen: null } : p))
      } else {
        setFirmaUrl(null)
        setProveedores(prev => prev.map(p => p.id === empresaId ? { ...p, firma_imagen: null } : p))
      }
    } catch (e) { console.error(e) }
    setConfirmBorrarFirma(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      const datos = {
        ...form,
        nombre:      toTitleCase(form.nombre.trim()),
        contacto:    form.contacto ? toTitleCase(form.contacto.trim()) : '',
        telefono:    normalizarTelefono(form.telefono),
        trabajadores: (form.trabajadores || []).map(t => toTitleCase(t.trim())).filter(Boolean),
        maquinas:    (form.maquinas || []).filter(m => m.matricula?.trim()).map(m => ({ nombre: m.nombre?.trim() || '', matricula: m.matricula.trim().toUpperCase() })),
      }
      if (editando) {
        await api.patch(`/empresas/${editando}`, datos)
      } else {
        await api.post('/empresas', datos)
      }
      await fetchProveedores()
      cerrarModal()
    } catch (e) {
      console.error('Error guardando empresa:', e)
    } finally {
      setGuardando(false)
    }
  }

  const handleToggleActivo = async (p) => {
    await api.patch(`/empresas/${p.id}`, { activo: !p.activo })
    await fetchProveedores()
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="page-title">Administración</div>
            <div className="page-sub">Gestión de astilladoras, transportistas e instalaciones</div>
          </div>
          {tab !== 'logos' && tab !== 'elementos' && (
            <button className="btn btn-primary" onClick={abrirNuevo}>
              <Plus size={15} /> Nuevo
            </button>
          )}
        </div>
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
          {esSuperadmin && (
            <button
              className={`admin-tab ${tab === 'logos' ? 'active' : ''}`}
              onClick={() => setTab('logos')}
            >
              Logos
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
                        borderRadius: 6, minHeight: 86, display: 'flex', alignItems: 'center',
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
                    {error && <div style={{ fontSize: 11, color: 'var(--red-600)', background: 'var(--red-50,#fff1f1)', border: '1px solid var(--red-100)', borderRadius: 4, padding: '4px 8px' }}>⚠ {error}</div>}
                    <input ref={el => { logoFileRefs.current[cfg.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleSubirLogo(cfg.id, e.target.files?.[0])} />
                    {confirmDelLogo === cfg.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '6px 4px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 6 }}>
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
        ) : tab !== 'elementos' ? (
          /* ── Providers panel ── */
          <>
            <div className="admin-toolbar">
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
                      <td className="nombre-col" style={{ fontWeight: 500, color:'var(--blue-700)', textDecoration:'underline', textDecorationColor:'var(--gray-200)' }}>{p.nombre}</td>
                      <td className="contacto-col" style={{ color: 'var(--gray-600)' }}>{p.contacto || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
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
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 11, color: p.firma_imagen ? 'var(--green-600)' : 'var(--gray-400)' }}
                            title={p.firma_imagen ? 'Firma registrada · click para cambiar' : 'Sin firma · click para añadir'}
                            onClick={() => { setFirmaUrl(null); setFirmaModalEmpresa(p) }}
                          >
                            <Image size={12} /> Firma
                          </button>
                          {(p.tipo === 'astilladora' || p.tipo === 'instalacion') && (
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 11, color: logos[`empresa_${slugify(p.nombre)}`] ? 'var(--green-600)' : 'var(--gray-400)' }}
                              title={logos[`empresa_${slugify(p.nombre)}`] ? 'Logo registrado · click para cambiar' : 'Sin logo · click para añadir'}
                              onClick={() => { setConfirmBorrarLogo(false); setLogoModalEmpresa(p) }}
                            >
                              <Image size={12} /> Logo
                            </button>
                          )}
                          {(p.tipo === 'astilladora' || p.tipo === 'instalacion') && (
                            <a
                              className="btn btn-ghost"
                              style={{ padding: '4px 8px', fontSize: 11, color: 'var(--gray-500)', textDecoration: 'none' }}
                              href={p.tipo === 'astilladora'
                                ? `/campo/astilladora/${p.nombre.replace(/\s+/g, '-')}`
                                : `/campo/instalacion/${p.nombre.replace(/\s+/g, '-')}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              title="Abrir panel externo"
                            >
                              <ExternalLink size={12} /> Panel
                            </a>
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

      {/* Modal firma rápida */}
      {firmaModalEmpresa && (
        <div className="modal-overlay" onClick={() => { setFirmaModalEmpresa(null); setConfirmBorrarFirma(false) }}>
          <div className="modal" style={{maxWidth:360}} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Firma — {firmaModalEmpresa.nombre}</div>
            <div style={{marginBottom:16}}>
              {/* Zona drag-drop */}
              <div
                style={{
                  border: dragOverFirma ? '2px dashed var(--green-400)' : firmaModalEmpresa.firma_imagen ? '1px solid var(--gray-200)' : '1px dashed var(--gray-200)',
                  borderRadius:8, padding:firmaModalEmpresa.firma_imagen ? 16 : 24,
                  background: dragOverFirma ? 'rgba(29,158,117,0.06)' : 'var(--gray-50)',
                  textAlign:'center', marginBottom:14, cursor:'pointer', transition:'border 0.15s, background 0.15s',
                }}
                onClick={() => document.getElementById('firma-input-modal').click()}
                onDragOver={e => { e.preventDefault(); setDragOverFirma(true) }}
                onDragLeave={() => setDragOverFirma(false)}
                onDrop={e => { e.preventDefault(); setDragOverFirma(false); if(e.dataTransfer.files[0]) handleSubirFirmaModal(e.dataTransfer.files[0]) }}
              >
                {dragOverFirma ? (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--green-400)'}}>
                    <Upload size={22}/><span style={{fontSize:12}}>Soltar aquí</span>
                  </div>
                ) : firmaModalEmpresa.firma_imagen ? (
                  <>
                    <img src={firmaModalEmpresa.firma_imagen} alt="Firma" style={{maxHeight:90,maxWidth:'100%',objectFit:'contain'}} />
                    <div style={{fontSize:11,color:'var(--green-600)',marginTop:6,fontWeight:500}}>✓ Firma registrada · clic o arrastra para cambiar</div>
                  </>
                ) : (
                  <div style={{color:'var(--gray-400)',fontSize:13}}>
                    <Upload size={20} style={{margin:'0 auto 6px',display:'block'}}/>
                    Sin firma · clic o arrastra para subir
                  </div>
                )}
              </div>
              <input id="firma-input-modal" type="file" accept=".png,.jpg,.jpeg,.svg" style={{display:'none'}}
                onChange={e => { if(e.target.files[0]) handleSubirFirmaModal(e.target.files[0]); e.target.value='' }}
                disabled={subiendoFirma}
              />
              {subiendoFirma && <div style={{fontSize:12,color:'var(--gray-400)',textAlign:'center',marginBottom:8}}>Subiendo...</div>}
              <div style={{fontSize:11,color:'var(--gray-400)',textAlign:'center',marginBottom:12}}>
                PNG, JPG o SVG · Se muestra al confirmar firma desde el campo
              </div>
              {firmaModalEmpresa.firma_imagen && (
                confirmBorrarFirma ? (
                  <div style={{display:'flex',gap:6,alignItems:'center',justifyContent:'center',padding:'8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:8}}>
                    <span style={{fontSize:12,color:'var(--red-700)',fontWeight:500}}>¿Eliminar firma?</span>
                    <button className="btn" style={{padding:'4px 10px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-200)'}}
                      onClick={() => handleBorrarFirma(firmaModalEmpresa.id, true)}><Check size={11}/> Sí</button>
                    <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}}
                      onClick={() => setConfirmBorrarFirma(false)}><X size={11}/></button>
                  </div>
                ) : (
                  <button className="btn btn-ghost" style={{width:'100%',fontSize:12,color:'var(--red-400)',justifyContent:'center'}}
                    onClick={() => setConfirmBorrarFirma(true)}>
                    <Trash2 size={13}/> Eliminar firma
                  </button>
                )
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { setFirmaModalEmpresa(null); setConfirmBorrarFirma(false) }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal logo empresa (astilladora/instalacion) */}
      {logoModalEmpresa && (() => {
        const logoId  = `empresa_${slugify(logoModalEmpresa.nombre)}`
        const logoUrl = logos[logoId]
        const subiendo = !!subiendoLogo[logoId]
        return (
          <div className="modal-overlay" onClick={() => { setLogoModalEmpresa(null); setConfirmBorrarLogo(false) }}>
            <div className="modal" style={{maxWidth:360}} onClick={e => e.stopPropagation()}>
              <div className="modal-title">Logo panel — {logoModalEmpresa.nombre}</div>
              <div style={{marginBottom:16}}>
                <div
                  style={{
                    border: dragOverLogoModal ? '2px dashed var(--green-400)' : logoUrl ? '1px solid var(--gray-200)' : '1px dashed var(--gray-200)',
                    borderRadius:8, padding: logoUrl ? 16 : 24,
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
                  PNG, JPG, SVG, WEBP · Se muestra en la cabecera del panel externo
                </div>
                {logoUrl && (
                  confirmBorrarLogo ? (
                    <div style={{display:'flex',gap:6,alignItems:'center',justifyContent:'center',padding:'8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:8}}>
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
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editando ? 'Editar' : 'Nuevo'} {TIPO_LABELS[form.tipo].toLowerCase()}</div>
            <div className="modal-grid">
              <div className="modal-field full">
                <label>Tipo</label>
                <select value={form.tipo} onChange={e => set('tipo', e.target.value)} disabled={!!editando}>
                  {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="modal-field full">
                <label>Nombre *</label>
                <input type="text" placeholder="Nombre de la empresa" value={form.nombre} onChange={e => set('nombre', e.target.value)} onBlur={e => set('nombre', toTitleCase(e.target.value))} autoFocus />
              </div>
              <div className="modal-field">
                <label>Persona de contacto</label>
                <input type="text" placeholder="Nombre y apellido" value={form.contacto} onChange={e => set('contacto', e.target.value)} onBlur={e => set('contacto', toTitleCase(e.target.value))} />
              </div>
              <div className="modal-field">
                <label>Teléfono</label>
                <input type="tel" placeholder="+34 600 000 000" value={form.telefono}
                  onChange={e => set('telefono', e.target.value)}
                  onBlur={e => set('telefono', normalizarTelefono(e.target.value))}
                />
              </div>
              <div className="modal-field full">
                <label>Email</label>
                <input type="email" placeholder="contacto@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="modal-field full">
                <label>Notas internas</label>
                <textarea placeholder="Observaciones, condiciones especiales..." value={form.notas} onChange={e => set('notas', e.target.value)} style={{ minHeight: 60 }} />
              </div>
              <div className="modal-field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => set('activo', !form.activo)}>
                <div style={{width:36,height:20,background:form.activo?'var(--green-400)':'var(--gray-200)',borderRadius:10,position:'relative',transition:'background 0.2s',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:form.activo?16:2,width:16,height:16,background:'#fff',borderRadius:'50%',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
                </div>
                <span style={{fontSize:13,color:'var(--gray-700)'}}>Activo — aparece en los desplegables de nuevos albaranes</span>
              </div>

              {editando && (
                <div className="modal-field full">
                  <label>Firma oficial de la empresa</label>
                  <div
                    style={{
                      border: dragOverFirma ? '2px dashed var(--green-400)' : '1px solid var(--gray-200)',
                      borderRadius:'var(--radius-md)', padding:12, background: dragOverFirma ? 'rgba(29,158,117,0.06)' : 'var(--gray-50)',
                      cursor:'pointer', transition:'border 0.15s, background 0.15s',
                    }}
                    onClick={() => document.getElementById('firma-input-edit').click()}
                    onDragOver={e => { e.preventDefault(); setDragOverFirma(true) }}
                    onDragLeave={() => setDragOverFirma(false)}
                    onDrop={e => { e.preventDefault(); setDragOverFirma(false); if(e.dataTransfer.files[0]) handleSubirFirma(e.dataTransfer.files[0]) }}
                  >
                    {dragOverFirma ? (
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--green-400)',padding:'10px 0'}}>
                        <Upload size={20}/><span style={{fontSize:12}}>Soltar aquí</span>
                      </div>
                    ) : firmaUrl ? (
                      <div style={{textAlign:'center',marginBottom:8}}>
                        <img src={firmaUrl} alt="Firma" style={{maxHeight:70,maxWidth:'100%',objectFit:'contain'}} />
                        <div style={{fontSize:11,color:'var(--gray-400)',marginTop:4}}>Clic o arrastra para cambiar</div>
                      </div>
                    ) : (
                      <div style={{textAlign:'center',fontSize:12,color:'var(--gray-400)',marginBottom:8,padding:'8px 0'}}>
                        <Upload size={16} style={{margin:'0 auto 4px',display:'block'}}/>
                        Sin firma · clic o arrastra para subir
                      </div>
                    )}
                    {subiendoFirma && <div style={{fontSize:11,color:'var(--gray-400)',textAlign:'center'}}>Subiendo...</div>}
                    <input id="firma-input-edit" type="file" accept=".png,.jpg,.jpeg,.svg" style={{display:'none'}}
                      onChange={e => { if(e.target.files[0]) handleSubirFirma(e.target.files[0]); e.target.value='' }}
                      disabled={subiendoFirma}
                    />
                  </div>
                  {firmaUrl && (
                    confirmBorrarFirma ? (
                      <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6,padding:'6px 8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:6}}>
                        <span style={{fontSize:11,color:'var(--red-700)',fontWeight:500,flex:1}}>¿Eliminar firma?</span>
                        <button className="btn" style={{padding:'3px 8px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-200)'}}
                          onClick={e => { e.stopPropagation(); handleBorrarFirma(editando) }}><Check size={11}/> Sí</button>
                        <button className="btn btn-ghost" style={{padding:'3px 6px',fontSize:11}}
                          onClick={e => { e.stopPropagation(); setConfirmBorrarFirma(false) }}><X size={11}/></button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" style={{marginTop:6,width:'100%',fontSize:11,color:'var(--red-400)',justifyContent:'center'}}
                        onClick={e => { e.stopPropagation(); setConfirmBorrarFirma(true) }}>
                        <Trash2 size={12}/> Eliminar firma
                      </button>
                    )
                  )}
                  <div style={{fontSize:11,color:'var(--gray-400)',marginTop:4}}>PNG, JPG o SVG · Se usará al confirmar con un clic desde el campo</div>
                </div>
              )}

              {editando && (form.tipo === 'astilladora' || form.tipo === 'instalacion') && (() => {
                const logoId  = `empresa_${slugify(form.nombre)}`
                const logoUrl = logos[logoId]
                const subiendo = !!subiendoLogo[logoId]
                return (
                  <div className="modal-field full">
                    <label>Logo panel de recepción</label>
                    <div
                      style={{
                        border: dragOverLogoModal ? '2px dashed var(--green-400)' : '1px solid var(--gray-200)',
                        borderRadius:'var(--radius-md)', padding:12, background: dragOverLogoModal ? 'rgba(29,158,117,0.06)' : 'var(--gray-50)',
                        cursor:'pointer', transition:'border 0.15s, background 0.15s',
                      }}
                      onClick={() => logoFileRefs.current[`modal_${logoId}`]?.click()}
                      onDragOver={e => { e.preventDefault(); setDragOverLogoModal(true) }}
                      onDragLeave={() => setDragOverLogoModal(false)}
                      onDrop={e => { e.preventDefault(); setDragOverLogoModal(false); if(e.dataTransfer.files[0]) handleSubirLogo(logoId, e.dataTransfer.files[0]) }}
                    >
                      {dragOverLogoModal ? (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--green-400)',padding:'10px 0'}}>
                          <Upload size={20}/><span style={{fontSize:12}}>Soltar aquí</span>
                        </div>
                      ) : logoUrl ? (
                        <div style={{textAlign:'center',marginBottom:8}}>
                          <img src={logoUrl} alt="Logo" style={{maxHeight:70,maxWidth:'100%',objectFit:'contain'}} />
                          <div style={{fontSize:11,color:'var(--gray-400)',marginTop:4}}>Clic o arrastra para cambiar</div>
                        </div>
                      ) : (
                        <div style={{textAlign:'center',fontSize:12,color:'var(--gray-400)',marginBottom:8,padding:'8px 0'}}>
                          <Upload size={16} style={{margin:'0 auto 4px',display:'block'}}/>
                          Sin logo · clic o arrastra para subir
                        </div>
                      )}
                      {subiendo && <div style={{fontSize:11,color:'var(--gray-400)',textAlign:'center'}}>Subiendo...</div>}
                      <input ref={el => { logoFileRefs.current[`modal_${logoId}`] = el }} type="file" accept="image/*" style={{display:'none'}}
                        onChange={e => { if(e.target.files[0]) handleSubirLogo(logoId, e.target.files[0]); e.target.value='' }}
                        disabled={subiendo}
                      />
                    </div>
                    {logoUrl && (
                      confirmBorrarLogo ? (
                        <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6,padding:'6px 8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:6}}>
                          <span style={{fontSize:11,color:'var(--red-700)',fontWeight:500,flex:1}}>¿Eliminar logo?</span>
                          <button className="btn" style={{padding:'3px 8px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-200)'}}
                            onClick={e => { e.stopPropagation(); handleEliminarLogo(logoId); setConfirmBorrarLogo(false) }}><Check size={11}/> Sí</button>
                          <button className="btn btn-ghost" style={{padding:'3px 6px',fontSize:11}}
                            onClick={e => { e.stopPropagation(); setConfirmBorrarLogo(false) }}><X size={11}/></button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost" style={{marginTop:6,width:'100%',fontSize:11,color:'var(--red-400)',justifyContent:'center'}}
                          onClick={e => { e.stopPropagation(); setConfirmBorrarLogo(true) }}>
                          <Trash2 size={12}/> Eliminar logo
                        </button>
                      )
                    )}
                    <div style={{fontSize:11,color:'var(--gray-400)',marginTop:4}}>PNG, JPG, SVG o WEBP · Se muestra en la cabecera del panel de instalación</div>
                  </div>
                )
              })()}

              {/* ── Trabajadores y máquinas (solo astilladora) ── */}
              {form.tipo === 'astilladora' && (
                <>
                  <div className="modal-field full" style={{borderTop:'1px solid var(--gray-100)',paddingTop:14,marginTop:4}}>
                    <label style={{marginBottom:8,display:'block'}}>Trabajadores</label>
                    {(form.trabajadores || []).map((t, i) => (
                      <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                        <input type="text" placeholder="Nombre y apellidos" value={t} style={{flex:1}}
                          onChange={e => set('trabajadores', form.trabajadores.map((x,j) => j===i ? e.target.value : x))}
                          onBlur={e => set('trabajadores', form.trabajadores.map((x,j) => j===i ? toTitleCase(e.target.value) : x))}
                        />
                        <button className="btn btn-ghost" style={{padding:'4px 6px',color:'var(--gray-400)'}}
                          onClick={() => set('trabajadores', form.trabajadores.filter((_,j) => j!==i))}>
                          <X size={12}/>
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-ghost" style={{fontSize:12,width:'100%',justifyContent:'center',marginTop:2}}
                      onClick={() => set('trabajadores', [...(form.trabajadores||[]), ''])}>
                      <Plus size={12}/> Añadir trabajador
                    </button>
                  </div>

                  <div className="modal-field full">
                    <label style={{marginBottom:8,display:'block'}}>Máquinas astilladoras</label>
                    {(form.maquinas || []).map((m, i) => (
                      <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                        <input type="text" placeholder="Nombre / descripción" value={m.nombre||''} style={{flex:2}}
                          onChange={e => set('maquinas', form.maquinas.map((x,j) => j===i ? {...x, nombre: e.target.value} : x))}
                        />
                        <input type="text" placeholder="Matrícula" value={m.matricula||''} style={{flex:1,fontFamily:'var(--font-mono)',fontSize:12}}
                          onChange={e => set('maquinas', form.maquinas.map((x,j) => j===i ? {...x, matricula: e.target.value.toUpperCase()} : x))}
                        />
                        <button className="btn btn-ghost" style={{padding:'4px 6px',color:'var(--gray-400)'}}
                          onClick={() => set('maquinas', form.maquinas.filter((_,j) => j!==i))}>
                          <X size={12}/>
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-ghost" style={{fontSize:12,width:'100%',justifyContent:'center',marginTop:2}}
                      onClick={() => set('maquinas', [...(form.maquinas||[]), {nombre:'', matricula:''}])}>
                      <Plus size={12}/> Añadir máquina
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={!form.nombre.trim() || guardando}>
                {guardando ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar cambios' : 'Crear'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

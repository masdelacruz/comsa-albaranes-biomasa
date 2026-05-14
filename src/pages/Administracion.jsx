import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, Check, Upload, Image } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'
import './Administracion.css'

const TIPOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']
const TIPO_LABELS = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }

const EMPTY_FORM = { nombre: '', tipo: 'proveedor', contacto: '', email: '', telefono: '', notas: '', activo: true }

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
  const [subiendoFirma, setSubiendoFirma] = useState(false)
  const [firmaUrl, setFirmaUrl]           = useState(null)

  // Logos state
  const [logos, setLogos]                   = useState({})
  const [subiendoLogo, setSubiendoLogo]     = useState({})
  const [errorLogos, setErrorLogos]         = useState({})
  const [confirmDelLogo, setConfirmDelLogo] = useState(null)
  const [dragOverLogo, setDragOverLogo]     = useState(null)
  const fileInputRefs = {
    comsa:    useRef(null),
    applus_1: useRef(null),
    applus_2: useRef(null),
    applus_3: useRef(null),
    applus_4: useRef(null),
    pefc:     useRef(null),
    sure:     useRef(null),
  }

  // ── data fetching ───────────────────────────────────────────────────────────

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
    setForm({ nombre: p.nombre, tipo: p.tipo, contacto: p.contacto || '', email: p.email || '', telefono: p.telefono || '', notas: p.notas || '', activo: p.activo })
    setFirmaUrl(p.firma_imagen || null)
    setModal(true)
  }

  const cerrarModal = () => { setModal(false); setEditando(null); setForm(EMPTY_FORM); setFirmaUrl(null) }

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await api.patch(`/empresas/${editando}`, form)
    } else {
      await api.post('/empresas', form)
    }
    await fetchProveedores()
    setGuardando(false)
    cerrarModal()
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
      if (fileInputRefs[id]?.current) fileInputRefs[id].current.value = ''
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
          {tab !== 'logos' && (
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
          {esSuperadmin && (
            <button
              className={`admin-tab ${tab === 'logos' ? 'active' : ''}`}
              onClick={() => setTab('logos')}
            >
              Logos
            </button>
          )}
        </div>

        {/* ── Logos panel ── */}
        {tab === 'logos' ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
              Logos que aparecen en la cabecera de los albaranes PDF. Formatos admitidos: PNG, JPG, SVG, WEBP.
            </div>

            {LOGOS_SECTIONS.map((section, si) => {
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
                      onClick={() => fileInputRefs[cfg.id].current?.click()}
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
                    <input ref={fileInputRefs[cfg.id]} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleSubirLogo(cfg.id, e.target.files?.[0])} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: 11, padding: '5px 10px' }}
                        disabled={subiendo} onClick={() => fileInputRefs[cfg.id].current?.click()}>
                        <Upload size={12} /> {url ? 'Reemplazar' : 'Subir'}
                      </button>
                      {url && (confirmDelLogo === cfg.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--red-700)', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                          <button className="btn" style={{ padding: '5px 8px', fontSize: 11, color: 'var(--red-700)', borderColor: 'var(--red-100)' }}
                            onClick={() => handleEliminarLogo(cfg.id)}><Check size={11} /> Sí</button>
                          <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}
                            onClick={() => setConfirmDelLogo(null)}><X size={11} /></button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost" style={{ padding: '5px 8px', fontSize: 11, color: 'var(--red-400)' }}
                          onClick={() => setConfirmDelLogo(cfg.id)}><Trash2 size={12} /></button>
                      ))}
                    </div>
                  </div>
                )
              }

              return (
                <div key={section.key} style={{ marginBottom: si < LOGOS_SECTIONS.length - 1 ? 28 : 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: section.color, display: 'inline-block', flexShrink: 0 }} />
                    {section.titulo}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {section.logos.map(renderCard)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
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

            <div className="card" style={{ padding: 0 }}>
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
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                      <td style={{ color: 'var(--gray-600)' }}>{p.contacto || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                      <td style={{ color: 'var(--blue-700)' }}>
                        {p.email
                          ? <a href={`mailto:${p.email}`} style={{ color: 'var(--blue-700)' }}>{p.email}</a>
                          : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--gray-600)' }}>{p.telefono || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                      <td>
                        <button
                          onClick={() => handleToggleActivo(p)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 12, color: p.activo ? 'var(--green-600)' : 'var(--gray-400)', padding: 0 }}
                        >
                          <span className={`activo-dot ${p.activo ? 'si' : 'no'}`} />
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => abrirEditar(p)}>
                            <Pencil size={12} /> Editar
                          </button>
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
          </>
        )}
      </div>

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
                <input type="text" placeholder="Nombre de la empresa" value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus />
              </div>
              <div className="modal-field">
                <label>Persona de contacto</label>
                <input type="text" placeholder="Nombre y apellido" value={form.contacto} onChange={e => set('contacto', e.target.value)} />
              </div>
              <div className="modal-field">
                <label>Teléfono</label>
                <input type="tel" placeholder="+34 600 000 000" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
              </div>
              <div className="modal-field full">
                <label>Email</label>
                <input type="email" placeholder="contacto@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="modal-field full">
                <label>Notas internas</label>
                <textarea placeholder="Observaciones, condiciones especiales..." value={form.notas} onChange={e => set('notas', e.target.value)} style={{ minHeight: 60 }} />
              </div>
              <div className="modal-field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="activo" checked={form.activo} onChange={e => set('activo', e.target.checked)} style={{ width: 'auto' }} />
                <label htmlFor="activo" style={{ margin: 0, cursor: 'pointer' }}>Activo — aparece en los desplegables de nuevos albaranes</label>
              </div>

              {editando && (
                <div className="modal-field full">
                  <label>Firma oficial de la empresa</label>
                  <div style={{border:'1px solid var(--gray-200)',borderRadius:'var(--radius-md)',padding:12,background:'var(--gray-50)'}}>
                    {firmaUrl ? (
                      <div style={{textAlign:'center',marginBottom:10}}>
                        <img src={firmaUrl} alt="Firma" style={{maxHeight:70,maxWidth:'100%',objectFit:'contain'}} />
                      </div>
                    ) : (
                      <div style={{textAlign:'center',fontSize:12,color:'var(--gray-400)',marginBottom:10}}>
                        Sin firma registrada
                      </div>
                    )}
                    <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',justifyContent:'center',fontSize:12,color:'var(--green-600)',fontWeight:500}}>
                      <Upload size={14} />
                      {subiendoFirma ? 'Subiendo...' : firmaUrl ? 'Cambiar imagen de firma' : 'Subir imagen de firma'}
                      <input type="file" accept=".png,.jpg,.jpeg,.svg" style={{display:'none'}}
                        onChange={e => { if(e.target.files[0]) handleSubirFirma(e.target.files[0]); e.target.value='' }}
                        disabled={subiendoFirma}
                      />
                    </label>
                    <div style={{fontSize:11,color:'var(--gray-400)',textAlign:'center',marginTop:4}}>
                      PNG, JPG o SVG · Se usará al confirmar con un clic desde el campo
                    </div>
                  </div>
                </div>
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

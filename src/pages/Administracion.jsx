import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, Check, Upload, Image } from 'lucide-react'
import { supabase } from '../supabase'
import '../components/shared.css'
import './Administracion.css'

const TIPOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']
const TIPO_LABELS = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }

const EMPTY_FORM = { nombre: '', tipo: 'proveedor', contacto: '', email: '', telefono: '', notas: '', activo: true }

const LOGOS_CONFIG = [
  { id: 'comsa',    nombre: 'COMSA Service',       descripcion: 'Logo principal COMSA Service (aparece en el PDF)' },
  { id: 'applus_1', nombre: 'Applus · ISO 9001',  descripcion: 'Certificación ISO 9001 (ej. EC-1952/05)' },
  { id: 'applus_2', nombre: 'Applus · ISO 14001', descripcion: 'Certificación ISO 14001 (ej. MA-0904/08)' },
  { id: 'applus_3', nombre: 'Applus · ISO 45001', descripcion: 'Certificación ISO 45001 (ej. PRL-4023/19)' },
  { id: 'applus_4', nombre: 'Applus · ISO 50001', descripcion: 'Certificación ISO 50001 (ej. SGE-0021/24)' },
  { id: 'pefc',     nombre: 'PEFC',               descripcion: 'Logo PEFC cadena de custodia' },
  { id: 'sure',     nombre: 'SURE',               descripcion: 'Logo SURE Sustainable Resources' },
]

export default function Administracion() {
  const [proveedores, setProveedores]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [tab, setTab]                     = useState('proveedor')
  const [busqueda, setBusqueda]           = useState('')
  const [modal, setModal]                 = useState(false)
  const [editando, setEditando]           = useState(null)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [guardando, setGuardando]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Certificaciones state
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
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    setProveedores(data || [])
    setLoading(false)
  }

  const fetchLogos = async () => {
    try {
      const { data } = await supabase.from('logos_config').select('id,url')
      if (data) {
        const map = {}
        data.forEach(row => { map[row.id] = row.url })
        setLogos(map)
      }
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
    setModal(true)
  }

  const cerrarModal = () => { setModal(false); setEditando(null); setForm(EMPTY_FORM) }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true)
    if (editando) {
      await supabase.from('proveedores').update(form).eq('id', editando)
    } else {
      await supabase.from('proveedores').insert(form)
    }
    await fetchProveedores()
    setGuardando(false)
    cerrarModal()
  }

  const handleToggleActivo = async (p) => {
    await supabase.from('proveedores').update({ activo: !p.activo }).eq('id', p.id)
    await fetchProveedores()
  }

  const handleEliminar = async (id) => {
    await supabase.from('proveedores').delete().eq('id', id)
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
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${id}.${ext}`

      // Intentar borrar versiones anteriores con extensiones comunes
      await supabase.storage.from('logos').remove([
        `${id}.png`, `${id}.jpg`, `${id}.jpeg`, `${id}.svg`, `${id}.webp`
      ])

      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) throw new Error(`Storage: ${upErr.message}`)

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) throw new Error('No se obtuvo URL pública. ¿El bucket es público?')

      const urlWithTs = `${publicUrl}?t=${Date.now()}`

      const { error: dbErr } = await supabase.from('logos_config').upsert({ id, url: urlWithTs })
      if (dbErr) throw new Error(`Base de datos: ${dbErr.message}`)

      setLogos(l => ({ ...l, [id]: urlWithTs }))
    } catch (err) {
      console.error('Error subiendo logo:', err)
      setErrorLogos(e => ({ ...e, [id]: err.message || 'Error desconocido' }))
    } finally {
      setSubiendoLogo(s => ({ ...s, [id]: false }))
      if (fileInputRefs[id]?.current) fileInputRefs[id].current.value = ''
    }
  }

  const handleEliminarLogo = async (id) => {
    try {
      // Try to remove known extensions; ignore errors
      await supabase.storage.from('logos').remove([`${id}.png`, `${id}.jpg`, `${id}.jpeg`, `${id}.svg`, `${id}.webp`])
      await supabase.from('logos_config').delete().eq('id', id)
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
          {tab !== 'certificaciones' && (
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
            className={`admin-tab ${tab === 'certificaciones' ? 'active' : ''}`}
            onClick={() => setTab('certificaciones')}
          >
            Certificaciones
          </button>
        </div>

        {/* ── Certificaciones panel ── */}
        {tab === 'certificaciones' ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
              Logos que aparecerán en la cabecera de los albaranes PDF.
            </div>

            {/* Bloque Applus */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8720C', display: 'inline-block' }} />
                Applus® — 4 logos ISO (se muestran en cuadrícula 2×2 en el PDF)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {LOGOS_CONFIG.filter(c => c.id.startsWith('applus')).map(cfg => {
                  const url      = logos[cfg.id]
                  const subiendo = !!subiendoLogo[cfg.id]
                  const error    = errorLogos[cfg.id]
                  const isDragOver = dragOverLogo === cfg.id
                  return (
                    <div key={cfg.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>{cfg.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{cfg.descripcion}</div>
                      <div
                        style={{
                          border: isDragOver ? '2px dashed var(--green-400)' : '1px dashed var(--gray-200)',
                          borderRadius: 6, minHeight: 90, display: 'flex', alignItems: 'center',
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
                          <img src={url} alt={cfg.nombre} style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain', padding: 4 }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--gray-300)' }}>
                            <Image size={24} />
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
                })}
              </div>
            </div>

            {/* Bloque PEFC + SURE */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-400)', display: 'inline-block' }} />
                Certificaciones de biomasa
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {LOGOS_CONFIG.filter(c => !c.id.startsWith('applus')).map(cfg => {
                  const url      = logos[cfg.id]
                  const subiendo = !!subiendoLogo[cfg.id]
                  const error    = errorLogos[cfg.id]
                  const isDragOver = dragOverLogo === cfg.id
                  return (
                    <div key={cfg.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-800)' }}>{cfg.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{cfg.descripcion}</div>
                      <div
                        style={{
                          border: isDragOver ? '2px dashed var(--green-400)' : '1px dashed var(--gray-200)',
                          borderRadius: 6, minHeight: 80, display: 'flex', alignItems: 'center',
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
                          <img src={url} alt={cfg.nombre} style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain', padding: 4 }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--gray-300)' }}>
                            <Image size={28} />
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
                          <Upload size={12} /> {url ? 'Reemplazar' : 'Subir logo'}
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
                })}
              </div>
            </div>
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

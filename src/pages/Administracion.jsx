import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Pencil, Trash2, X, Check, Upload, Image } from 'lucide-react'
import { supabase } from '../supabase'
import '../components/shared.css'
import './Administracion.css'

const TIPOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']
const TIPO_LABELS = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }

const EMPTY_FORM = { nombre: '', tipo: 'proveedor', contacto: '', email: '', telefono: '', notas: '', activo: true }

const LOGOS_CONFIG = [
  { id: 'applus', nombre: 'Applus®',  descripcion: 'Logo de certificación Applus' },
  { id: 'pefc',   nombre: 'PEFC',     descripcion: 'Logo PEFC cadena de custodia' },
  { id: 'sure',   nombre: 'SURE',     descripcion: 'Logo SURE Sustainable Resources' },
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
  const [logos, setLogos]               = useState({})         // { applus: url, pefc: url, sure: url }
  const [subiendoLogo, setSubiendoLogo] = useState({})         // { applus: true/false, ... }
  const [confirmDelLogo, setConfirmDelLogo] = useState(null)   // logo id pending delete
  const fileInputRefs = {
    applus: useRef(null),
    pefc:   useRef(null),
    sure:   useRef(null),
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
    try {
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${id}.${ext}`

      // Remove existing file first (ignore errors — may not exist)
      await supabase.storage.from('logos').remove([path])

      const { error: upErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = urlData?.publicUrl
      if (!url) throw new Error('No public URL returned')

      // Add a cache-busting timestamp so the img tag refreshes
      const urlWithTs = `${url}?t=${Date.now()}`

      await supabase.from('logos_config').upsert({ id, url: urlWithTs })
      setLogos(l => ({ ...l, [id]: urlWithTs }))
    } catch (err) {
      console.error('Error subiendo logo:', err)
    } finally {
      setSubiendoLogo(s => ({ ...s, [id]: false }))
      // Reset the file input so the same file can be re-uploaded if needed
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
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
              Logos que aparecerán en la cabecera de los albaranes PDF.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {LOGOS_CONFIG.map(cfg => {
                const url      = logos[cfg.id]
                const subiendo = !!subiendoLogo[cfg.id]
                return (
                  <div key={cfg.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-800)' }}>{cfg.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{cfg.descripcion}</div>

                    {/* Preview area */}
                    <div style={{
                      border: '1px dashed var(--gray-200)',
                      borderRadius: 6,
                      minHeight: 80,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--gray-50, #fafafa)',
                      overflow: 'hidden',
                    }}>
                      {url ? (
                        <img
                          src={url}
                          alt={cfg.nombre}
                          style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain', padding: 4 }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: 'var(--gray-300)' }}>
                          <Image size={28} />
                          <span style={{ fontSize: 11 }}>Sin logo</span>
                        </div>
                      )}
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRefs[cfg.id]}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleSubirLogo(cfg.id, e.target.files?.[0])}
                    />

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, fontSize: 11, padding: '5px 10px' }}
                        disabled={subiendo}
                        onClick={() => fileInputRefs[cfg.id].current?.click()}
                      >
                        {subiendo ? (
                          'Subiendo...'
                        ) : (
                          <><Upload size={12} /> {url ? 'Reemplazar' : 'Subir logo'}</>
                        )}
                      </button>

                      {url && (
                        confirmDelLogo === cfg.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: 'var(--red-700)', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                            <button
                              className="btn"
                              style={{ padding: '5px 8px', fontSize: 11, color: 'var(--red-700)', borderColor: 'var(--red-100)' }}
                              onClick={() => handleEliminarLogo(cfg.id)}
                            >
                              <Check size={11} /> Sí
                            </button>
                            <button
                              className="btn btn-ghost"
                              style={{ padding: '5px 8px', fontSize: 11 }}
                              onClick={() => setConfirmDelLogo(null)}
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '5px 8px', fontSize: 11, color: 'var(--red-400)' }}
                            onClick={() => setConfirmDelLogo(cfg.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
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

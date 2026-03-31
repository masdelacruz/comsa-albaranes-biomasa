import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'
import { supabase } from '../supabase'
import '../components/shared.css'
import './Administracion.css'

const TIPOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']
const TIPO_LABELS = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }

const EMPTY_FORM = { nombre: '', tipo: 'astilladora', contacto: '', email: '', telefono: '', notas: '', activo: true }

export default function Administracion() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState('astilladora')
  const [busqueda, setBusqueda]       = useState('')
  const [modal, setModal]             = useState(false)
  const [editando, setEditando]       = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [guardando, setGuardando]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const fetchProveedores = async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    setProveedores(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProveedores() }, [])

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

  return (
    <div className="admin-page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div className="page-title">Administración</div>
            <div className="page-sub">Gestión de astilladoras, transportistas e instalaciones</div>
          </div>
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-tabs">
          {TIPOS.map(t => (
            <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setBusqueda('') }}>
              {TIPO_LABELS[t]} <span style={{fontSize:11,color:'var(--gray-400)',marginLeft:4}}>({counts[t]})</span>
            </button>
          ))}
        </div>

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
          <div style={{fontSize:12,color:'var(--gray-400)'}}>
            {filtrados.length} {filtrados.length === 1 ? 'registro' : 'registros'}
          </div>
        </div>

        <div className="card" style={{padding:0}}>
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
                  <td style={{fontWeight:500}}>{p.nombre}</td>
                  <td style={{color:'var(--gray-600)'}}>{p.contacto || <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                  <td style={{color:'var(--blue-700)'}}>{p.email
                    ? <a href={`mailto:${p.email}`} style={{color:'var(--blue-700)'}}>{p.email}</a>
                    : <span style={{color:'var(--gray-300)'}}>—</span>}
                  </td>
                  <td style={{color:'var(--gray-600)'}}>{p.telefono || <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                  <td>
                    <button
                      onClick={() => handleToggleActivo(p)}
                      style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',fontSize:12,color:p.activo ? 'var(--green-600)' : 'var(--gray-400)',padding:0}}
                    >
                      <span className={`activo-dot ${p.activo ? 'si' : 'no'}`} />
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}} onClick={() => abrirEditar(p)}>
                        <Pencil size={12} /> Editar
                      </button>
                      {confirmDelete === p.id ? (
                        <div style={{display:'flex',gap:4,alignItems:'center'}}>
                          <span style={{fontSize:11,color:'var(--red-700)'}}>¿Eliminar?</span>
                          <button className="btn" style={{padding:'4px 8px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-100)'}} onClick={() => handleEliminar(p.id)}>
                            <Check size={11} /> Sí
                          </button>
                          <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}} onClick={() => setConfirmDelete(null)}>
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11,color:'var(--red-400)'}} onClick={() => setConfirmDelete(p.id)}>
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
                <textarea placeholder="Observaciones, condiciones especiales..." value={form.notas} onChange={e => set('notas', e.target.value)} style={{minHeight:60}} />
              </div>
              <div className="modal-field full" style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <input type="checkbox" id="activo" checked={form.activo} onChange={e => set('activo', e.target.checked)} style={{width:'auto'}} />
                <label htmlFor="activo" style={{margin:0,cursor:'pointer'}}>Activo — aparece en los desplegables de nuevos albaranes</label>
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
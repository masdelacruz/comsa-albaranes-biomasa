import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { Plus, Check, X, Shield, ShieldOff, Trash2, Eye, EyeOff } from 'lucide-react'
import '../components/shared.css'
import './Usuarios.css'
import PerfilUsuario from './PerfilUsuario'

const ROLES_DISPONIBLES = [
  'Transformación Digital',
  'Resp. Operaciones Biomasa',
  'Administrativa Operaciones',
  'Delegado Operaciones',
  'Resp. Operaciones',
]

const EMPTY_FORM = { nombre: '', email: '', rol: ROLES_DISPONIBLES[0], nivel: 'usuario', password: '' }

export default function Usuarios({ usuario }) {
  const [usuarios, setUsuarios]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]                   = useState(false)
  const [form, setForm]                     = useState(EMPTY_FORM)
  const [guardando, setGuardando]           = useState(false)
  const [error, setError]                   = useState('')
  const [perfilUsuario, setPerfilUsuario]   = useState(null)   // user object | null
  const [confirmDesact, setConfirmDesact]   = useState(null)
  const [confirmDelete, setConfirmDelete]   = useState(null)
  const [deleteError, setDeleteError]       = useState('')
  const [showPassword, setShowPassword]     = useState(false)
  const [pwVisible, setPwVisible]           = useState({})

  const esSuperadmin = usuario?.nivel === 'superadmin'

  const fetchUsuarios = async () => {
    const data = await api.get('/usuarios')
    setUsuarios(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsuarios() }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const abrirNuevo = () => { setForm(EMPTY_FORM); setError(''); setShowPassword(false); setModal(true) }

  const cerrarModal = () => { setModal(false); setForm(EMPTY_FORM); setError(''); setShowPassword(false) }

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.email.trim()) return
    setGuardando(true); setError('')
    try {
      await api.post('/usuarios', {
        nombre:   form.nombre,
        email:    form.email,
        rol:      form.rol,
        nivel:    form.nivel,
        password: form.password || 'Comsa2025!',
      })
    } catch (err) {
      setError(err.message || 'Error al guardar')
      setGuardando(false)
      return
    }
    await fetchUsuarios()
    setGuardando(false)
    cerrarModal()
  }

  const handleToggleActivo = async (u) => {
    await api.patch(`/usuarios/${u.id}`, { activo: !u.activo })
    await fetchUsuarios()
    setConfirmDesact(null)
  }

  const handleDelete = async (id) => {
    setDeleteError('')
    try {
      await api.delete(`/usuarios/${id}`)
      await fetchUsuarios()
      setConfirmDelete(null)
    } catch (err) {
      setDeleteError(err.message || 'Error al eliminar el usuario')
      setConfirmDelete(null)
    }
  }

  return (
    <div className="usuarios-page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div className="page-title">Gestión de usuarios</div>
            <div className="page-sub">{usuarios.length} usuarios registrados</div>
          </div>
          {esSuperadmin && (
            <button className="btn btn-primary" onClick={abrirNuevo}>
              <Plus size={15} /> Nuevo usuario
            </button>
          )}
        </div>
      </div>

      <div className="usuarios-content">
        {deleteError && (
          <div style={{marginBottom:12,background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:'var(--radius-md)',padding:'10px 14px',fontSize:13,color:'var(--red-700)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            {deleteError}
            <button onClick={() => setDeleteError('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red-400)',display:'flex',alignItems:'center'}}><X size={14} /></button>
          </div>
        )}
        <div className="card" style={{padding:0}}>
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Nivel</th>
                <th>Estado</th>
                {esSuperadmin && <th>Contraseña</th>}
                {esSuperadmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={esSuperadmin ? 7 : 5} style={{padding:32,textAlign:'center',color:'var(--gray-400)'}}>Cargando...</td></tr>
              ) : usuarios.map(u => (
                <tr key={u.id} className="usuarios-tr-click" onClick={() => setPerfilUsuario(u)}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:'var(--green-100)',color:'var(--green-600)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,flexShrink:0}}>
                        {u.nombre.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <span style={{fontWeight:500}}>{u.nombre}</span>
                      {u.id === usuario?.id && <span style={{fontSize:11,color:'var(--gray-400)'}}>(tú)</span>}
                    </div>
                  </td>
                  <td style={{color:'var(--gray-600)'}}>{u.email}</td>
                  <td>{u.rol}</td>
                  <td>
                    <span className={`nivel-badge ${u.nivel === 'superadmin' ? 'nivel-superadmin' : 'nivel-usuario'}`}>
                      {u.nivel === 'superadmin' ? '★ Superadmin' : 'Usuario'}
                    </span>
                  </td>
                  <td>
                    <span style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color: u.activo ? 'var(--green-600)' : 'var(--gray-400)'}}>
                      <span style={{width:7,height:7,borderRadius:'50%',background: u.activo ? 'var(--green-400)' : 'var(--gray-300)',display:'inline-block'}} />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {esSuperadmin && (
                    <td onClick={e => e.stopPropagation()}>
                      {u.password_visible ? (
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontFamily:'monospace',fontSize:12,color:'var(--gray-700)',letterSpacing: pwVisible[u.id] ? 0 : 2}}>
                            {pwVisible[u.id] ? u.password_visible : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPwVisible(v => ({...v, [u.id]: !v[u.id]}))}
                            style={{background:'none',border:'none',cursor:'pointer',padding:2,color:'var(--gray-400)',display:'flex',alignItems:'center'}}
                          >
                            {pwVisible[u.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      ) : (
                        <span style={{fontSize:11,color:'var(--gray-300)'}}>—</span>
                      )}
                    </td>
                  )}
                  {esSuperadmin && (
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}} onClick={() => setPerfilUsuario(u)}>
                          Ver perfil
                        </button>
                        {u.id !== usuario?.id && (
                          confirmDesact === u.id ? (
                            <div style={{display:'flex',gap:4,alignItems:'center'}}>
                              <span style={{fontSize:11,color:'var(--red-700)'}}>¿{u.activo ? 'Desactivar' : 'Activar'}?</span>
                              <button className="btn" style={{padding:'4px 8px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-100)'}} onClick={() => handleToggleActivo(u)}>
                                <Check size={11} />
                              </button>
                              <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}} onClick={() => setConfirmDesact(null)}>
                                <X size={11} />
                              </button>
                            </div>
                          ) : confirmDelete === u.id ? (
                            <div style={{display:'flex',gap:4,alignItems:'center'}}>
                              <span style={{fontSize:11,color:'var(--red-700)',fontWeight:500}}>¿Eliminar definitivamente?</span>
                              <button className="btn" style={{padding:'4px 8px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-100)',background:'var(--red-50)'}} onClick={() => handleDelete(u.id)}>
                                <Check size={11} />
                              </button>
                              <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:11}} onClick={() => setConfirmDelete(null)}>
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <div style={{display:'flex',gap:4}}>
                              <button
                                className="btn btn-ghost"
                                style={{padding:'4px 8px',fontSize:11,color: u.activo ? 'var(--red-400)' : 'var(--green-400)'}}
                                onClick={() => { setConfirmDelete(null); setConfirmDesact(u.id) }}
                              >
                                {u.activo ? <><ShieldOff size={12} /> Desactivar</> : <><Shield size={12} /> Activar</>}
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{padding:'4px 8px',fontSize:11,color:'var(--red-300)'}}
                                onClick={() => { setConfirmDesact(null); setConfirmDelete(u.id) }}
                                title="Eliminar usuario permanentemente"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal crear usuario ── */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:20}}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:20}}>Nuevo usuario</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:12,fontWeight:500,color:'var(--gray-600)'}}>Nombre completo *</label>
                <input type="text" placeholder="Nombre y apellido" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:12,fontWeight:500,color:'var(--gray-600)'}}>Email corporativo *</label>
                <input type="email" placeholder="nombre@comsa.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div style={{display:'flex',gap:10}}>
                <div style={{display:'flex',flexDirection:'column',gap:5,flex:1}}>
                  <label style={{fontSize:12,fontWeight:500,color:'var(--gray-600)'}}>Rol</label>
                  <select value={form.rol} onChange={e => set('rol', e.target.value)}>
                    {ROLES_DISPONIBLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5,flex:1}}>
                  <label style={{fontSize:12,fontWeight:500,color:'var(--gray-600)'}}>Nivel</label>
                  <select value={form.nivel} onChange={e => set('nivel', e.target.value)}>
                    <option value="usuario">Usuario</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:5}}>
                <label style={{fontSize:12,fontWeight:500,color:'var(--gray-600)'}}>Contraseña provisional</label>
                <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                  <input type={showPassword?'text':'password'} placeholder="Comsa2025!" value={form.password} onChange={e => set('password', e.target.value)} style={{paddingRight:36,width:'100%'}} />
                  <button type="button" onClick={() => setShowPassword(v=>!v)} style={{position:'absolute',right:8,background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--gray-400)',display:'flex',alignItems:'center'}} tabIndex={-1}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {error && <div style={{background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:'var(--radius-sm)',padding:'8px 12px',fontSize:12,color:'var(--red-700)'}}>{error}</div>}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20,paddingTop:16,borderTop:'var(--border)'}}>
              <button className="btn" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={!form.nombre.trim()||!form.email.trim()||guardando}>
                {guardando ? 'Creando...' : <><Check size={14}/> Crear usuario</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Perfil / notificaciones ── */}
      {perfilUsuario && (
        <PerfilUsuario
          usuario={perfilUsuario}
          onClose={() => setPerfilUsuario(null)}
          onGuardado={fetchUsuarios}
        />
      )}
    </div>
  )
}
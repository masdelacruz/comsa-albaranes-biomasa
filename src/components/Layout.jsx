import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Leaf, Clock, BarChart2, Settings, LogOut, User, X, Mail, Briefcase, Shield, Users } from 'lucide-react'
import './Layout.css'

export default function Layout({ usuario, logout }) {
  const [perfilOpen, setPerfilOpen]       = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const esSuperadmin = usuario?.nivel === 'superadmin'

  const handleLogout = async () => {
    await logout()
    setConfirmLogout(false)
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon"><Leaf size={18} /></div>
          <div>
            <div className="logo-title">Comsa Service</div>
            <div className="logo-sub">Biomasa · Operaciones</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard"      className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <LayoutDashboard size={16} /><span>Dashboard</span>
          </NavLink>
          <NavLink to="/nuevo"          className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <PlusCircle size={16} /><span>Nuevo albarán</span>
          </NavLink>
          <NavLink to="/historial"      className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Clock size={16} /><span>Historial</span>
          </NavLink>
          <NavLink to="/estadisticas"   className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <BarChart2 size={16} /><span>Estadísticas</span>
          </NavLink>
          <NavLink to="/administracion" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
            <Settings size={16} /><span>Administración</span>
          </NavLink>
          {esSuperadmin && (
            <NavLink to="/usuarios" className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <Users size={16} /><span>Usuarios</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="user-chip-btn" onClick={() => setPerfilOpen(true)}>
            <div className="user-avatar" style={{background:'var(--green-100)',color:'var(--green-600)'}}>
              {iniciales}
            </div>
            <div style={{flex:1,minWidth:0,textAlign:'left'}}>
              <div className="user-name">{usuario?.nombre || '—'}</div>
              <div className="user-role">{usuario?.rol || '—'}</div>
            </div>
            <User size={13} style={{color:'var(--gray-400)',flexShrink:0}} />
          </button>
        </div>
      </aside>

      <main className="main-area"><Outlet /></main>

      {perfilOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}}>
            <div style={{background:'var(--gray-900)',padding:'24px 24px 20px',position:'relative'}}>
              <button onClick={() => setPerfilOpen(false)} style={{position:'absolute',top:16,right:16,background:'none',border:'none',cursor:'pointer',color:'var(--gray-400)',display:'flex',alignItems:'center'}}>
                <X size={16} />
              </button>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'var(--green-400)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:600,color:'#fff',flexShrink:0}}>
                  {iniciales}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:'#fff'}}>{usuario?.nombre}</div>
                  <div style={{fontSize:12,color:'var(--gray-400)',marginTop:3}}>{usuario?.rol}</div>
                  {esSuperadmin && <span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 6px',borderRadius:20,fontWeight:600,marginTop:4,display:'inline-block'}}>★ Superadmin</span>}
                </div>
              </div>
            </div>

            <div style={{padding:'20px 24px'}}>
              <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--gray-400)',marginBottom:12}}>Información de cuenta</div>
              {[
                { icon: <Mail size={14} />,      label: 'Email',   value: usuario?.email },
                { icon: <Briefcase size={14} />, label: 'Rol',     value: usuario?.rol },
                { icon: <Shield size={14} />,    label: 'Acceso',  value: esSuperadmin ? 'Superadministrador' : 'Usuario estándar' },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'var(--border-light)'}}>
                  <div style={{color:'var(--gray-400)',marginTop:1,flexShrink:0}}>{icon}</div>
                  <div>
                    <div style={{fontSize:11,color:'var(--gray-400)',marginBottom:2}}>{label}</div>
                    <div style={{fontSize:13,color:'var(--gray-800)',fontWeight:500}}>{value || '—'}</div>
                  </div>
                </div>
              ))}

              <div style={{marginTop:20,paddingTop:16,borderTop:'var(--border)'}}>
                {!confirmLogout ? (
                  <button onClick={() => setConfirmLogout(true)} style={{width:'100%',padding:'10px',borderRadius:'var(--radius-md)',border:'1px solid var(--red-100)',background:'var(--red-50)',color:'var(--red-700)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                ) : (
                  <div style={{background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:'var(--radius-md)',padding:'14px'}}>
                    <div style={{fontSize:13,color:'var(--red-700)',fontWeight:500,marginBottom:10,textAlign:'center'}}>¿Seguro que quieres cerrar sesión?</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => setConfirmLogout(false)} style={{flex:1,padding:'8px',borderRadius:'var(--radius-sm)',border:'var(--border)',background:'#fff',fontSize:13,cursor:'pointer'}}>Cancelar</button>
                      <button onClick={handleLogout} style={{flex:1,padding:'8px',borderRadius:'var(--radius-sm)',border:'none',background:'var(--red-400)',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>Sí, cerrar sesión</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
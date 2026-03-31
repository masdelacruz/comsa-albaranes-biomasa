import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Leaf, Clock, BarChart2, Settings, LogOut } from 'lucide-react'
import './Layout.css'

export default function Layout({ usuario, logout }) {
  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

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
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar" style={{background:'var(--green-100)',color:'var(--green-600)'}}>
              {iniciales}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">{usuario?.nombre || '—'}</div>
              <div className="user-role">{usuario?.rol || '—'}</div>
            </div>
            <button
              onClick={logout}
              style={{background:'none',border:'none',cursor:'pointer',color:'var(--gray-400)',padding:4,flexShrink:0,display:'flex',alignItems:'center'}}
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-area"><Outlet /></main>
    </div>
  )
}
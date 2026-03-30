import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Leaf, Clock, BarChart2, Settings } from 'lucide-react'
import './Layout.css'

export default function Layout() {
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
            <div className="user-avatar">MS</div>
            <div><div className="user-name">Marc Serrano</div><div className="user-role">Transformación digital</div></div>
          </div>
          <div className="user-chip">
            <div className="user-avatar" style={{background:'var(--green-100)',color:'var(--green-600)'}}>MM</div>
            <div><div className="user-name">Marc Marin</div><div className="user-role">Resp. Operaciones Biomasa</div></div>
          </div>
        </div>
      </aside>
      <main className="main-area"><Outlet /></main>
    </div>
  )
}
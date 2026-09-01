import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, FileClock, BarChart2, Settings, Users, LayoutGrid } from 'lucide-react'
import Dock from './Dock'
import Header from './Header'
import './Layout.css'

export default function Layout({ usuario, albaranes = [], logout }) {
  const navigate = useNavigate()
  const location = useLocation()

  // .layout usa min-height:100vh, así que el scroll real es el de la
  // ventana (no uno interno) — React Router no lo resetea solo al navegar.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  // Si ya estamos en la ruta destino, el pathname no cambia al pulsar el
  // icono del dock, así que el efecto de arriba no salta solo: forzamos
  // el scroll suave aquí también.
  const irA = ruta => () => {
    if (location.pathname === ruta) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate(ruta)
    }
  }

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const esSuperadmin = usuario?.nivel === 'superadmin'

  const pendientesOficina = albaranes.filter(a => a.estado === 'pendiente_oficina').length

  const dockItems = [
    { key: 'dashboard',      label: 'Dashboard',      icon: <LayoutDashboard size={18} />, active: location.pathname === '/dashboard',      badge: pendientesOficina, onClick: irA('/dashboard') },
    { key: 'nuevo',          label: 'Nuevo albarán',  icon: <PlusCircle size={18} />,      active: location.pathname === '/nuevo',          onClick: irA('/nuevo') },
    { key: 'historial',      label: 'Historial',      icon: <FileClock size={18} />,       active: location.pathname === '/historial',      onClick: irA('/historial') },
    { key: 'estadisticas',   label: 'Estadísticas',   icon: <BarChart2 size={18} />,       active: location.pathname === '/estadisticas',   onClick: irA('/estadisticas') },
    { key: 'administracion', label: 'Administración', icon: <Settings size={18} />,        active: location.pathname === '/administracion', onClick: irA('/administracion') },
    ...(esSuperadmin ? [
      { key: 'usuarios', label: 'Usuarios', icon: <Users size={18} />, active: location.pathname === '/usuarios', onClick: irA('/usuarios') },
    ] : []),
    ...(usuario?.acceso_biomasa !== false && usuario?.acceso_trabajo ? [
      { key: 'apps', label: 'Cambiar de aplicación', icon: <LayoutGrid size={18} />, onClick: () => navigate('/apps') },
    ] : []),
    { key: 'perfil', label: usuario?.nombre || 'Perfil', isAvatar: true, initials: iniciales, active: location.pathname === '/perfil', onClick: irA('/perfil') },
  ]

  return (
    <div className="layout">
      <Header usuario={usuario} logout={logout} />
      <main className="main-area"><Outlet /></main>
      <Dock items={dockItems} />
    </div>
  )
}

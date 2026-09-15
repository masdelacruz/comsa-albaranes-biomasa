import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileClock, BarChart2, Settings, Globe } from 'lucide-react'
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

  const puedeConfiguracion = usuario?.nivel !== 'basico'

  const pendientesOficina = albaranes.filter(a => a.estado === 'pendiente_oficina').length

  const dockItems = [
    { key: 'dashboard',      label: 'Dashboard',      icon: <LayoutDashboard size={18} />, active: location.pathname === '/dashboard',      badge: pendientesOficina, onClick: irA('/dashboard') },
    { key: 'historial',      label: 'Historial',      icon: <FileClock size={18} />,       active: location.pathname === '/historial',      onClick: irA('/historial') },
    { key: 'estadisticas',   label: 'Estadísticas',   icon: <BarChart2 size={18} />,       active: location.pathname === '/estadisticas',   onClick: irA('/estadisticas') },
    ...(puedeConfiguracion ? [
      { key: 'portales', label: 'Portales de clientes', icon: <Globe size={18} />, active: location.pathname === '/portales', onClick: irA('/portales') },
      { key: 'configuracion', label: 'Configuración', icon: <Settings size={18} />, active: location.pathname.startsWith('/configuracion'), onClick: irA('/configuracion') },
    ] : []),
    { key: 'perfil', label: usuario?.nombre || 'Perfil', isAvatar: true, initials: iniciales, active: location.pathname === '/perfil', dividerBefore: true, onClick: irA('/perfil') },
  ]

  return (
    <div className="layout">
      <Header usuario={usuario} logout={logout} />
      <main className="main-area"><Outlet /></main>
      <Dock items={dockItems} />
    </div>
  )
}

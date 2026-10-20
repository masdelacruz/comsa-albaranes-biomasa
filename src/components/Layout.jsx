import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, BarChart2, Settings, Handshake } from 'lucide-react'
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
  // apartado, así que el efecto de arriba no salta solo: forzamos el
  // scroll suave aquí también.
  const irA = ruta => () => {
    if (location.pathname === ruta) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate(ruta)
    }
  }

  const puedeConfiguracion = usuario?.nivel !== 'basico'

  const pendientesOficina = albaranes.filter(a => a.estado === 'pendiente_oficina').length

  // El perfil no va aquí: ya está a la derecha de la cabecera
  const apartados = [
    { key: 'albaranes',    label: 'Albaranes',    icon: <FileText size={16} />,        active: location.pathname === '/albaranes' || location.pathname.startsWith('/albaran/'), badge: pendientesOficina, onClick: irA('/albaranes') },
    { key: 'panel',        label: 'Panel',        icon: <LayoutDashboard size={16} />, active: location.pathname === '/panel',          onClick: irA('/panel') },
    { key: 'estadisticas', label: 'Estadísticas', icon: <BarChart2 size={16} />,       active: location.pathname === '/estadisticas',   onClick: irA('/estadisticas') },
    { key: 'clientes',     label: 'Clientes',     icon: <Handshake size={16} />,       active: location.pathname.startsWith('/clientes'), onClick: irA('/clientes') },
    ...(puedeConfiguracion ? [
      { key: 'configuracion', label: 'Configuración', icon: <Settings size={16} />, active: location.pathname.startsWith('/configuracion'), onClick: irA('/configuracion') },
    ] : []),
  ]

  return (
    <div className="layout">
      <Header usuario={usuario} logout={logout} nav={apartados} />
      <main className="main-area"><Outlet /></main>
    </div>
  )
}

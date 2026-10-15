import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, LogOut } from 'lucide-react'
import logoIcon from '../assets/logo_biomasa_icon.png'
import './Header.css'

// Cabecera común. El contenido va en una franja con el mismo ancho máximo y
// márgenes que las páginas, para que el logo y el perfil queden alineados
// con el borde izquierdo y derecho del contenido. `nav` (opcional) son los
// apartados de la app: { key, label, icon, active, badge, onClick }.
export default function Header({ usuario, logout, nav = [] }) {
  const navigate = useNavigate()
  const location = useLocation()

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const esSuperadmin = usuario?.nivel === 'superadmin'
  const tieneBiomasa = usuario?.acceso_biomasa !== false
  const tieneTrabajo = !!usuario?.acceso_trabajo
  const multiApp = tieneBiomasa && tieneTrabajo

  const irInicio = () => {
    if (multiApp) navigate('/apps')
    else if (tieneTrabajo) navigate('/trabajo')
    else navigate('/dashboard')
  }

  return (
    <header className="app-header">
      <div className="ah-inner">
        <button className="ah-brand" onClick={irInicio}>
          <span className="ah-brand-icon"><img src={logoIcon} alt="COMSA Biomasa" className="ah-brand-icon-img" /></span>
          <span className="ah-brand-text">COMSA Service</span>
        </button>

        {nav.length > 0 && (
          <nav className="ah-nav">
            {nav.map(item => (
              <button
                key={item.key}
                type="button"
                className={`ah-nav-item${item.active ? ' activo' : ''}`}
                onClick={item.onClick}
                title={item.label}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.icon}
                <span className="ah-nav-label">{item.label}</span>
                {!!item.badge && <span className="ah-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        )}

        <div className="ah-right">
          {multiApp && location.pathname !== '/apps' && (
            <button className="ah-switch" onClick={() => navigate('/apps')} title="Cambiar de aplicación">
              <LayoutGrid size={13} /> <span>Cambiar app</span>
            </button>
          )}
          <button
            className={`ah-user${location.pathname === '/perfil' ? ' activo' : ''}`}
            onClick={() => tieneBiomasa && navigate('/perfil')}
            title={tieneBiomasa ? 'Ver perfil' : undefined}
          >
            <span className="ah-avatar">{iniciales}</span>
            <span className="ah-user-info">
              <span className="ah-user-nombre">{usuario?.nombre}</span>
              {esSuperadmin && <span className="ah-user-rol">Superadmin</span>}
            </span>
          </button>
          <button className="ah-logout" onClick={logout} title="Cerrar sesión"><LogOut size={14} /></button>
        </div>
      </div>
    </header>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, LogOut, ChevronDown, UserRound } from 'lucide-react'
import logoIcon from '../assets/logo_biomasa_icon.png'
import './Header.css'

// Cabecera común. El contenido va en una franja con el mismo ancho máximo y
// márgenes que las páginas, para que el logo y el perfil queden alineados
// con el borde izquierdo y derecho del contenido. `nav` (opcional) son los
// apartados de la app: { key, label, icon, active, badge, onClick }.
export default function Header({ usuario, logout, nav = [] }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef(null)

  // El menú del perfil se cierra al pulsar fuera, con Escape o al navegar
  useEffect(() => {
    if (!menuAbierto) return
    const fuera = e => { if (!menuRef.current?.contains(e.target)) setMenuAbierto(false) }
    const tecla = e => { if (e.key === 'Escape') setMenuAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [menuAbierto])

  const elegir = accion => () => { setMenuAbierto(false); accion() }

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const esSuperadmin = usuario?.nivel === 'superadmin'
  const tieneBiomasa = usuario?.acceso_biomasa !== false
  const tieneTrabajo = !!usuario?.acceso_trabajo
  const multiApp = tieneBiomasa && tieneTrabajo

  // El logo lleva al inicio de la app en la que se está: Trabajo → /trabajo,
  // selector → se queda en /apps, y cualquier apartado de Biomasa → Dashboard
  const irInicio = () => {
    const ruta = location.pathname
    if (ruta.startsWith('/trabajo')) navigate('/trabajo')
    else if (ruta.startsWith('/apps')) navigate('/apps')
    else if (tieneBiomasa) navigate('/dashboard')
    else navigate(tieneTrabajo ? '/trabajo' : '/apps')
  }

  return (
    <header className="app-header">
      <div className={`ah-inner${nav.length ? ' con-nav' : ''}`}>
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
                <span className="ah-nav-label">
                  <span>{item.label}</span>
                </span>
                {!!item.badge && <span className="ah-nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        )}

        <div className="ah-right" ref={menuRef}>
          <button
            className={`ah-user${menuAbierto || location.pathname === '/perfil' ? ' activo' : ''}`}
            onClick={() => setMenuAbierto(o => !o)}
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
          >
            <span className="ah-avatar">{iniciales}</span>
            <span className="ah-user-info">
              <span className="ah-user-nombre">{usuario?.nombre}</span>
              {esSuperadmin && <span className="ah-user-rol">Superadmin</span>}
            </span>
            <ChevronDown size={14} className={`ah-user-chevron${menuAbierto ? ' abierto' : ''}`} />
          </button>

          {menuAbierto && (
            <div className="ah-menu" role="menu">
              <div className="ah-menu-cabecera">
                <span className="ah-avatar">{iniciales}</span>
                <span className="ah-menu-quien">
                  <span className="ah-menu-nombre">{usuario?.nombre}</span>
                  {usuario?.email && <span className="ah-menu-email">{usuario.email}</span>}
                </span>
              </div>
              {tieneBiomasa && (
                <button role="menuitem" className="ah-menu-item" onClick={elegir(() => navigate('/perfil'))}>
                  <UserRound size={15} /> Mi perfil
                </button>
              )}
              {multiApp && location.pathname !== '/apps' && (
                <button role="menuitem" className="ah-menu-item" onClick={elegir(() => navigate('/apps'))}>
                  <LayoutGrid size={15} /> Cambiar de aplicación
                </button>
              )}
              <div className="ah-menu-sep" />
              <button role="menuitem" className="ah-menu-item salir" onClick={elegir(logout)}>
                <LogOut size={15} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

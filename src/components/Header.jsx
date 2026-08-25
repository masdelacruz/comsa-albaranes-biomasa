import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutGrid, LogOut } from 'lucide-react'
import logoIcon from '../assets/logo_biomasa.png'
import './Header.css'

export default function Header({ usuario, logout }) {
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
      <button className="ah-brand" onClick={irInicio}>
        <span className="ah-brand-icon"><img src={logoIcon} alt="COMSA Biomasa" className="ah-brand-icon-img" /></span>
        <span className="ah-brand-text">COMSA Service</span>
      </button>

      <div className="ah-right">
        {multiApp && location.pathname !== '/apps' && (
          <button className="ah-switch" onClick={() => navigate('/apps')} title="Cambiar de aplicación">
            <LayoutGrid size={13} /> Cambiar app
          </button>
        )}
        <button
          className="ah-user"
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
    </header>
  )
}

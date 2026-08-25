import { useNavigate } from 'react-router-dom'
import { Leaf, HardHat, ArrowRight, LogOut } from 'lucide-react'
import './SelectorApp.css'

export default function SelectorApp({ usuario, logout }) {
  const navigate = useNavigate()
  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="sa-page">
      <div className="sa-topbar">
        <span className="sa-brand">COMSA Service</span>
        <div className="sa-user">
          <span className="sa-avatar">{iniciales}</span>
          <span className="sa-user-nombre">{usuario?.nombre}</span>
          <button className="sa-logout" onClick={logout} title="Cerrar sesión"><LogOut size={14} /></button>
        </div>
      </div>

      <div className="sa-content">
        <div className="sa-heading">
          <div className="sa-title">¿Qué aplicación quieres abrir?</div>
          <div className="sa-sub">Puedes cambiar entre ellas cuando quieras.</div>
        </div>

        <div className="sa-grid">
          <button className="sa-card sa-card-biomasa" onClick={() => navigate('/dashboard')}>
            <span className="sa-card-icon"><Leaf size={24} /></span>
            <span className="sa-card-name">Biomasa</span>
            <span className="sa-card-desc">Gestión de albaranes de biomasa</span>
            <span className="sa-card-cta">Entrar <ArrowRight size={14} /></span>
          </button>

          <button className="sa-card sa-card-trabajo" onClick={() => navigate('/trabajo')}>
            <span className="sa-card-icon"><HardHat size={24} /></span>
            <span className="sa-card-name">Trabajo</span>
            <span className="sa-card-desc">Próximamente</span>
            <span className="sa-card-cta">Entrar <ArrowRight size={14} /></span>
          </button>
        </div>
      </div>
    </div>
  )
}

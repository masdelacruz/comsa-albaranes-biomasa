import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Header from '../components/Header'
import logoBiomasa from '../assets/logo_biomasa_full.png'
import iconTrabajo from '../assets/icon_trabajo.png'
import './SelectorApp.css'

export default function SelectorApp({ usuario, logout }) {
  const navigate = useNavigate()

  return (
    <div className="sa-page">
      <Header usuario={usuario} logout={logout} />

      <div className="sa-content">
        <div className="sa-heading">
          <div className="sa-title">¿Qué aplicación quieres abrir?</div>
          <div className="sa-sub">Puedes cambiar entre ellas cuando quieras.</div>
        </div>

        <div className="sa-grid">
          <button className="sa-card sa-card-biomasa" onClick={() => navigate('/dashboard')}>
            <span className="sa-card-icon"><img src={logoBiomasa} alt="" /></span>
            <span className="sa-card-name">Biomasa</span>
            <span className="sa-card-desc">Gestión de albaranes de biomasa</span>
            <span className="sa-card-cta">Entrar <ArrowRight size={14} /></span>
          </button>

          <button className="sa-card sa-card-trabajo" onClick={() => navigate('/trabajo')}>
            <span className="sa-card-icon"><img src={iconTrabajo} alt="" /></span>
            <span className="sa-card-name">Trabajo</span>
            <span className="sa-card-desc">Próximamente</span>
            <span className="sa-card-cta">Entrar <ArrowRight size={14} /></span>
          </button>
        </div>
      </div>
    </div>
  )
}

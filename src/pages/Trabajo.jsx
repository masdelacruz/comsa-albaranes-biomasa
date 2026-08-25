import { useNavigate } from 'react-router-dom'
import { HardHat, ArrowLeft } from 'lucide-react'
import Header from '../components/Header'
import '../components/shared.css'
import './Trabajo.css'

// Placeholder — esta app todavía no tiene lógica propia, solo el acceso
// desde el selector. Cuando se defina qué hace, esta página se sustituye
// por su propio árbol de rutas (ver src/App.jsx, "/trabajo/*").
export default function Trabajo({ usuario, logout }) {
  const navigate = useNavigate()
  const puedeVolver = usuario?.acceso_biomasa !== false

  return (
    <div className="tr-page">
      <Header usuario={usuario} logout={logout} />
      <div className="tr-content">
        <div className="tr-card">
          <div className="tr-icon"><HardHat size={26} /></div>
          <div className="tr-title">Trabajo</div>
          <div className="tr-sub">Esta aplicación está en construcción. Muy pronto podrás usarla desde aquí.</div>
          {puedeVolver && (
            <div className="tr-actions">
              <button className="btn" onClick={() => navigate('/apps')}>
                <ArrowLeft size={14} /> Volver al selector
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

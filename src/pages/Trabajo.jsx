import { useNavigate } from 'react-router-dom'
import { HardHat, ArrowLeft, LogOut } from 'lucide-react'
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
      <div className="tr-card">
        <div className="tr-icon"><HardHat size={26} /></div>
        <div className="tr-title">Trabajo</div>
        <div className="tr-sub">Esta aplicación está en construcción. Muy pronto podrás usarla desde aquí.</div>
        <div className="tr-actions">
          {puedeVolver && (
            <button className="btn" onClick={() => navigate('/apps')}>
              <ArrowLeft size={14} /> Volver al selector
            </button>
          )}
          <button className="btn btn-ghost" onClick={logout}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

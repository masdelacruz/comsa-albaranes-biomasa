import Loader from './Loader'
import '../components/shared.css'

// Overlay centrado a pantalla completa para acciones largas (generar PDF...).
// Separado del botón que la disparó: así se ve claramente en toda la
// pantalla, no solo en un icono diminuto dentro del botón.
export default function PdfLoadingOverlay({ show, texto = 'Generando PDF...' }) {
  if (!show) return null
  return (
    <div className="pdf-loading-overlay">
      <div className="pdf-loading-card">
        <Loader size="lg" />
        <div className="pdf-loading-text">{texto}</div>
      </div>
    </div>
  )
}

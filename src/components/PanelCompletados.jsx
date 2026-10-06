import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import '../pages/PanelInstalacion.css'

// Tarjeta plegable "Completados" de los paneles externos (proveedor,
// astilladora, instalación): los albaranes ya firmados/completados que no
// salen en la vista del día siguen consultables aquí. Cada panel pinta las
// filas con su propia tarjeta mediante renderFila(albaran, esUltimo).
export default function PanelCompletados({ albaranes, renderFila, dias = 60 }) {
  const [abierto, setAbierto] = useState(false)
  if (!albaranes.length) return null

  return (
    <div className="pi-section">
      <div className="pi-flota">
        <div className="pi-flota-header" onClick={() => setAbierto(v => !v)} style={{ cursor: 'pointer' }}>
          <div className="pi-flota-icon"><CheckCircle size={15} color="var(--green-600)" /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pi-flota-title">Completados</div>
            <div className="pi-flota-sub">Últimos {dias} días · toca para {abierto ? 'ocultar' : 'consultar'}</div>
          </div>
          <div className="pi-flota-badge">{albaranes.length}</div>
          {abierto ? <ChevronDown size={16} color="var(--gray-400)" /> : <ChevronRight size={16} color="var(--gray-400)" />}
        </div>
        {abierto && (
          <div className="pi-camiones-list">
            {albaranes.map((a, i) => renderFila(a, i === albaranes.length - 1))}
          </div>
        )}
      </div>
    </div>
  )
}


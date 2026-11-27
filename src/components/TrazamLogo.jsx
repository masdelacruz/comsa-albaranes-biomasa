import { TRAZAM_PIEZAS, TRAZAM_VIEWBOX as VB } from './trazamLogoForma'

// Logotipo estático de Trazam. Toma el color del texto (currentColor), así
// que se colorea desde CSS con `color`.
export default function TrazamLogo({ className = '', titulo = 'Trazam' }) {
  return (
    <svg
      className={className}
      viewBox={`${VB.x} ${VB.y} ${VB.width} ${VB.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={titulo}
    >
      {TRAZAM_PIEZAS.map((d, i) => <path key={i} d={d} fill="currentColor" fillRule="evenodd" />)}
    </svg>
  )
}

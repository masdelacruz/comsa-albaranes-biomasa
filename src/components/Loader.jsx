import '../components/shared.css'

// Loader "boxes" — From Uiverse.io by elijahgummer, en el verde de marca.
// size: 'sm' (icono inline) o 'lg' (overlay a pantalla completa).
export default function Loader({ size = 'sm' }) {
  return (
    <span className={`uiv-loader-spin uiv-loader-${size}`}>
      <svg className="uiv-loader-svg">
        <rect className="uiv-loader-box" />
      </svg>
    </span>
  )
}

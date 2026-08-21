import '../components/shared.css'

// Loader "boxes" — From Uiverse.io by elijahgummer, en el verde de marca.
// Pensado para sustituir al icono estático de un botón mientras dura una
// acción (generar/descargar PDF...), como feedback de que se ha ejecutado.
export default function Loader() {
  return (
    <svg className="uiv-loader">
      <rect className="uiv-loader-box" />
    </svg>
  )
}

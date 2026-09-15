// Icono de astilladora (chipper forestal): tolva, cuerpo, rueda y chimenea
// de descarga. Trazo simple, sin relleno, construido en la misma rejilla de
// 24x24 y con el mismo strokeWidth por defecto que los iconos de
// lucide-react (p.ej. <Building2 />), para que el grosor de línea sea
// idéntico al del resto del set en cualquier tamaño.
export default function AstilladoraIcon({ size = 24, color = 'currentColor', strokeWidth = 2, className, style, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...props}
    >
      <path d="M4 5h6l-1 5H5z" />
      <rect x="4" y="10" width="12" height="7" rx="1" />
      <circle cx="8" cy="19" r="2" />
      <path d="M16 10V6c0-3 3-3 3-3" />
      <path d="M19 3l2-2" />
    </svg>
  )
}

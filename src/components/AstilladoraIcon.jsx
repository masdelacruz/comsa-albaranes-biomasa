// Icono de astilladora (chipper forestal) — reemplazo de <Factory /> (lucide)
// para representar este tipo de empresa/rol en toda la app. Trazo lineal sin
// relleno, mismo estilo e interfaz de props (size, color, strokeWidth) que
// los iconos de lucide-react (p.ej. <Truck />, <Building2 />) para encajar
// visualmente con el resto del set.
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
      {/* Cuerpo de la máquina */}
      <rect x="2" y="8" width="11" height="10" rx="1" />
      {/* Tolva de alimentación */}
      <path d="M13 11h4l5-5" />
      {/* Ruedas */}
      <circle cx="6" cy="19.5" r="1.8" />
      <circle cx="11" cy="19.5" r="1.8" />
    </svg>
  )
}

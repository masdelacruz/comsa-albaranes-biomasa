// Icono de astilladora (chipper forestal), basado en la imagen de referencia
// proporcionada (tolva, cuerpo, chimenea con astillas saliendo y soporte).
// Trazo lineal sin relleno, mismo estilo e interfaz de props (size, color,
// strokeWidth) que los iconos de lucide-react (p.ej. <Truck />, <Building2 />)
// para encajar visualmente con el resto del set.
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
      {/* Tolva de alimentación */}
      <path d="M3 5h5v5l-2.5 3L3 10z" />
      <path d="M4.5 7h2" />
      <path d="M4.5 9h2" />
      {/* Cuerpo de la máquina */}
      <rect x="8" y="9" width="9" height="7" rx="1" />
      <path d="M10 11.5h5" />
      <path d="M10 13.5h5" />
      {/* Chimenea de salida */}
      <path d="M15 9V6c0-3 2-3.5 3-3.5l2-2" />
      {/* Astillas saliendo */}
      <path d="M20 4l1-1" />
      <path d="M21.5 6.5l1-1" />
      <path d="M20.5 8.5l1-1" />
      {/* Soporte trasero */}
      <path d="M17 16v5" />
      <path d="M15 18.5h4" />
      {/* Rueda */}
      <circle cx="6.5" cy="19" r="2.2" />
      <circle cx="6.5" cy="19" r="0.4" />
    </svg>
  )
}

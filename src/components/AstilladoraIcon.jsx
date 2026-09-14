// Icono de astilladora (chipper forestal) — reemplazo de <Factory /> (lucide)
// para representar este tipo de empresa/rol en toda la app. Silueta rellena
// (no lineal, a diferencia de lucide) porque a los tamaños pequeños en los
// que se usa (14-18px) un icono con trazos finos pierde legibilidad; se
// colorea igual que un icono de lucide, vía `color` (o `currentColor` con
// las clases "tone-*" existentes).
export default function AstilladoraIcon({ size = 24, color = 'currentColor', className, style, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke="none"
      className={className}
      style={style}
      {...props}
    >
      {/* Tolva de alimentación */}
      <path d="M7 16 L22 2 L22 12 L11 16 Z" />
      {/* Cuerpo de la máquina */}
      <rect x="2" y="14" width="13" height="6" rx="1.5" />
      {/* Rueda */}
      <circle cx="7" cy="20" r="3" />
    </svg>
  )
}

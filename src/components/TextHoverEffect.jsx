import { useEffect, useId, useRef, useState } from 'react'
import './TextHoverEffect.css'

// Texto en trazo que se "dibuja" al aparecer y que, al pasar el ratón, se
// ilumina con los colores de la marca siguiendo el cursor. Adaptación sin
// Tailwind ni framer-motion del TextHoverEffect de Aceternity UI.
// autoBarrido: si nadie pasa el ratón, el brillo recorre el texto solo
// (para la intro y en pantallas táctiles).
export default function TextHoverEffect({ text, className = '', autoBarrido = false, duracion = 3 }) {
  const id = useId().replace(/:/g, '')
  const svgRef  = useRef(null)
  const gradRef = useRef(null)
  const objetivo = useRef({ x: 50, y: 50 })
  const actual   = useRef({ x: autoBarrido ? -20 : 50, y: 50 })
  const [hover, setHover] = useState(false)

  useEffect(() => {
    let raf
    let t0 = null
    const paso = (t) => {
      if (t0 === null) t0 = t
      if (autoBarrido && !hover) {
        // Barrido de izquierda a derecha y vuelta, suave
        const fase = ((t - t0) / 2600) % 2
        const k = fase < 1 ? fase : 2 - fase
        objetivo.current = { x: -20 + k * 140, y: 50 }
      }
      const a = actual.current, o = objetivo.current
      a.x += (o.x - a.x) * 0.12
      a.y += (o.y - a.y) * 0.12
      if (gradRef.current) {
        gradRef.current.setAttribute('cx', `${a.x}%`)
        gradRef.current.setAttribute('cy', `${a.y}%`)
      }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [autoBarrido, hover])

  const mover = (e) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    objetivo.current = {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    }
  }

  const encendido = hover || autoBarrido

  return (
    <svg
      ref={svgRef}
      className={`the-svg ${className}`}
      viewBox="0 0 300 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={text}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseMove={mover}
      style={{ '--the-duracion': `${duracion}s` }}
    >
      <defs>
        <linearGradient id={`${id}-grad`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
          {encendido && <>
            <stop offset="0%"   stopColor="#e52d3a" />
            <stop offset="35%"  stopColor="#f08a24" />
            <stop offset="55%"  stopColor="#1d9e75" />
            <stop offset="80%"  stopColor="#009fe3" />
            <stop offset="100%" stopColor="#5b6cff" />
          </>}
        </linearGradient>
        <radialGradient ref={gradRef} id={`${id}-reveal`} gradientUnits="userSpaceOnUse" r="25%" cx="50%" cy="50%">
          <stop offset="0%"   stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-reveal)`} />
        </mask>
      </defs>

      {/* Contorno base, tenue */}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        className="the-text the-base" style={{ opacity: encendido ? 0.7 : 0 }}>
        {text}
      </text>
      {/* Trazo que se dibuja al aparecer */}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        className="the-text the-dibujo">
        {text}
      </text>
      {/* Trazo de color, visible solo alrededor del cursor */}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        className="the-text the-color" stroke={`url(#${id}-grad)`} mask={`url(#${id}-mask)`}>
        {text}
      </text>
    </svg>
  )
}

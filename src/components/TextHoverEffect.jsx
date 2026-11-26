import { useEffect, useId, useRef, useState } from 'react'
import './TextHoverEffect.css'

// Marca en trazo: la palabra se "dibuja" con una línea fina y, al acabar, se
// rellena con los verdes de la app y un brillo suave que la recorre. Al pasar
// el ratón, un halo más claro sigue al cursor. Inspirado en el TextHoverEffect
// de Aceternity UI, sin Tailwind ni framer-motion.
//
// El contorno se saca con una máscara (trazo grueso menos la letra rellena):
// así solo queda el perímetro exterior de cada letra, sin las líneas internas
// donde la fuente solapa piezas (la barra y el palo de la T, por ejemplo).
export default function TextHoverEffect({ text, className = '', duracion = 3 }) {
  const id = useId().replace(/:/g, '')
  const svgRef  = useRef(null)
  const gradRef = useRef(null)
  const objetivo = useRef({ x: 50, y: 50 })
  const actual   = useRef({ x: 50, y: 50 })
  const [hover, setHover] = useState(false)

  // El halo sigue al cursor con un poco de inercia
  useEffect(() => {
    if (!hover) return
    let raf
    const paso = () => {
      const a = actual.current, o = objetivo.current
      a.x += (o.x - a.x) * 0.14
      a.y += (o.y - a.y) * 0.14
      gradRef.current?.setAttribute('cx', `${a.x}%`)
      gradRef.current?.setAttribute('cy', `${a.y}%`)
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [hover])

  const mover = (e) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    objetivo.current = {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    }
  }

  const texto = (props) => (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="the-text" {...props}>
      {text}
    </text>
  )
  const area = { x: 0, y: 0, width: 300, height: 100 }

  return (
    <svg
      ref={svgRef}
      className={`the-svg ${className}`}
      viewBox="0 0 300 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={text}
      onMouseEnter={(e) => { mover(e); actual.current = { ...objetivo.current }; setHover(true) }}
      onMouseLeave={() => setHover(false)}
      onMouseMove={mover}
      style={{ '--the-duracion': `${duracion}s` }}
    >
      <defs>
        {/* Relleno: verdes de la app, de oscuro a menta */}
        <linearGradient id={`${id}-relleno`} gradientUnits="userSpaceOnUse" x1="40" y1="20" x2="260" y2="80">
          <stop offset="0%"   stopColor="#0b5a46" />
          <stop offset="45%"  stopColor="#1d9e75" />
          <stop offset="80%"  stopColor="#3fbf93" />
          <stop offset="100%" stopColor="#8fdcbf" />
        </linearGradient>

        {/* Brillo que cruza la palabra de vez en cuando */}
        <linearGradient id={`${id}-brillo`} gradientUnits="userSpaceOnUse" x1="-60" y1="0" x2="0" y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          <animateTransform
            attributeName="gradientTransform" type="translate"
            values="0 0; 380 0; 380 0" keyTimes="0; 0.4; 1"
            dur="6s" begin={`${duracion + 0.8}s`} repeatCount="indefinite"
          />
        </linearGradient>

        {/* Halo del cursor */}
        <radialGradient ref={gradRef} id={`${id}-halo`} gradientUnits="userSpaceOnUse" r="18%" cx="50%" cy="50%">
          <stop offset="0%"   stopColor="#d9f7ea" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#d9f7ea" stopOpacity="0" />
        </radialGradient>

        {/* Contorno exterior que se va dibujando */}
        <mask id={`${id}-trazo`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ className: 'the-text the-mask-trazo the-dibujo', stroke: 'white' })}
          {texto({ fill: 'black' })}
        </mask>
        {/* Contorno exterior completo (sin animar) */}
        <mask id={`${id}-contorno`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ className: 'the-text the-mask-trazo', stroke: 'white' })}
          {texto({ fill: 'black' })}
        </mask>
        {/* La palabra rellena, para limitar el halo y el brillo */}
        <mask id={`${id}-letras`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ fill: 'white' })}
        </mask>
      </defs>

      <rect {...area} className="the-contorno" mask={`url(#${id}-contorno)`} />
      <rect {...area} className="the-linea" mask={`url(#${id}-trazo)`} />
      {texto({ fill: `url(#${id}-relleno)`, className: 'the-text the-relleno' })}
      <g className="the-relleno" mask={`url(#${id}-letras)`}>
        <rect {...area} fill={`url(#${id}-brillo)`} />
        <rect {...area} fill={`url(#${id}-halo)`} className="the-halo" style={{ opacity: hover ? 1 : 0 }} />
      </g>
    </svg>
  )
}

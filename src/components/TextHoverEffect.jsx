import { useEffect, useId, useRef, useState } from 'react'
import { TRAZAM_PIEZAS, TRAZAM_VIEWBOX as VB } from './trazamLogoForma'
import './TextHoverEffect.css'

// Marca en trazo: el logotipo se "dibuja" con una línea y, al acabar, se
// rellena de verde sólido con textura de fibra de madera, y la línea pasa a
// un verde más oscuro que el relleno. Al pasar el ratón, un halo claro sigue al
// cursor. Inspirado en el TextHoverEffect de Aceternity UI, sin Tailwind ni
// framer-motion.
//
// El contorno se saca con una máscara (trazo grueso menos la letra rellena):
// solo queda el perímetro exterior de cada pieza, por fuera de la letra.
//
// La forma es el logotipo vectorial de Trazam (trazamLogoForma.js).

const vb = VB

export default function TextHoverEffect({ text = 'Trazam', className = '', duracion = 3 }) {
  const id = useId().replace(/:/g, '')
  const svgRef    = useRef(null)
  const gradRef   = useRef(null)
  const objetivo  = useRef({ x: 50, y: 50 })
  const actual    = useRef({ x: 50, y: 50 })
  const [hover, setHover] = useState(false)
  // El halo sigue al cursor con un poco de inercia
  useEffect(() => {
    if (!hover) return
    let raf
    const paso = () => {
      const a = actual.current, o = objetivo.current
      a.x += (o.x - a.x) * 0.14
      a.y += (o.y - a.y) * 0.14
      gradRef.current?.setAttribute('cx', vb.x + (a.x / 100) * vb.width)
      gradRef.current?.setAttribute('cy', vb.y + (a.y / 100) * vb.height)
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

  // Todas las piezas del logo; pathLength normaliza la longitud de cada una
  // para que el trazo se dibuje a la vez en todas
  const texto = ({ className: c, ...props }) => (
    <g className={c} {...props}>
      {TRAZAM_PIEZAS.map((d, i) => <path key={i} d={d} fillRule="evenodd" pathLength="1000" />)}
    </g>
  )
  const area = vb
  const x0 = vb.x

  return (
    <svg
      ref={svgRef}
      className={`the-svg ${className}`}
      viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={text}
      onMouseEnter={(e) => { mover(e); actual.current = { ...objetivo.current }; setHover(true) }}
      onMouseLeave={() => setHover(false)}
      onMouseMove={mover}
      style={{ '--the-duracion': `${duracion}s` }}
    >
      <defs>
        {/* Relleno: verde sólido de la app, solo un leve volumen de arriba
            abajo (sin degradado lateral, que parecía una transición) */}
        <linearGradient id={`${id}-relleno`} gradientUnits="userSpaceOnUse" x1={x0} y1={vb.y} x2={x0} y2={vb.y + vb.height}>
          <stop offset="0%"   stopColor="#21a67b" />
          <stop offset="100%" stopColor="#14805f" />
        </linearGradient>

        {/* Textura: fibra de madera, vetas horizontales finas */}
        <filter id={`${id}-fibra`} x={x0} y={vb.y} width={vb.width} height={vb.height} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.0026 0.068" numOctaves="3" seed="7" result="ruido" />
          <feColorMatrix in="ruido" type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 -2.4 1.6" />
        </filter>

        {/* Halo del cursor */}
        <radialGradient ref={gradRef} id={`${id}-halo`} gradientUnits="userSpaceOnUse" r={vb.width * 0.16} cx={vb.x + vb.width / 2} cy={vb.y + vb.height / 2}>
          <stop offset="0%"   stopColor="#d9f7ea" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#d9f7ea" stopOpacity="0" />
        </radialGradient>

        {/* Contorno exterior que se va dibujando */}
        <mask id={`${id}-trazo`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ className: 'the-mask-trazo the-dibujo', stroke: 'white' })}
          {texto({ fill: 'black' })}
        </mask>
        {/* Contorno exterior completo (sin animar) */}
        <mask id={`${id}-contorno`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ className: 'the-mask-trazo', stroke: 'white' })}
          {texto({ fill: 'black' })}
        </mask>
        {/* La palabra rellena, para limitar textura y halo */}
        <mask id={`${id}-letras`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ fill: 'white' })}
        </mask>
      </defs>

      <rect {...area} className="the-contorno" mask={`url(#${id}-contorno)`} />
      <g className="the-relleno" mask={`url(#${id}-letras)`}>
        <rect {...area} fill={`url(#${id}-relleno)`} />
        <rect {...area} filter={`url(#${id}-fibra)`} className="the-fibra" />
        <rect {...area} fill={`url(#${id}-halo)`} className="the-halo" style={{ opacity: hover ? 1 : 0 }} />
      </g>
      <rect {...area} className="the-linea" mask={`url(#${id}-trazo)`} />
    </svg>
  )
}

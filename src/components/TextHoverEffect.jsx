import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import './TextHoverEffect.css'

// Marca en trazo: la palabra se "dibuja" con una línea y, al acabar, se
// rellena con los verdes de la app sobre una textura de fibra de madera, con
// un brillo suave que la recorre. Al pasar el ratón, un halo claro sigue al
// cursor. Inspirado en el TextHoverEffect de Aceternity UI, sin Tailwind ni
// framer-motion.
//
// El contorno se saca con una máscara (trazo grueso menos la letra rellena):
// solo queda el perímetro exterior de cada letra, sin las líneas internas
// donde la fuente solapa piezas (la barra y el palo de la T).
//
// El área de dibujo se ajusta a lo que mide la palabra ya con la fuente
// cargada: con un área fija, la T y la M se cortaban por los lados.
const PAD = 4

export default function TextHoverEffect({ text, className = '', duracion = 3 }) {
  const id = useId().replace(/:/g, '')
  const svgRef    = useRef(null)
  const medidaRef = useRef(null)
  const gradRef   = useRef(null)
  const objetivo  = useRef({ x: 50, y: 50 })
  const actual    = useRef({ x: 50, y: 50 })
  const [hover, setHover] = useState(false)
  const [vb, setVb] = useState({ x: 0, y: 0, width: 300, height: 100 })

  useLayoutEffect(() => {
    let vivo = true
    const medir = () => {
      const t = medidaRef.current
      if (!vivo || !t) return
      try {
        const b = t.getBBox()
        if (b.width > 0) {
          setVb({ x: b.x - PAD, y: b.y - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2 })
        }
      } catch { /* sin layout todavía (pestaña oculta): se queda el área por defecto */ }
    }
    medir()
    document.fonts?.ready.then(medir)
    return () => { vivo = false }
  }, [text])

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
  }, [hover, vb])

  const mover = (e) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return
    objetivo.current = {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    }
  }

  const texto = (props) => (
    <text x="150" y="50" textAnchor="middle" dominantBaseline="central" className="the-text" {...props}>
      {text}
    </text>
  )
  const area = vb
  const x0 = vb.x, x1 = vb.x + vb.width

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
        {/* Relleno: verdes de la app, de oscuro a menta */}
        <linearGradient id={`${id}-relleno`} gradientUnits="userSpaceOnUse" x1={x0} y1={vb.y} x2={x1} y2={vb.y + vb.height}>
          <stop offset="0%"   stopColor="#0b5a46" />
          <stop offset="45%"  stopColor="#1d9e75" />
          <stop offset="80%"  stopColor="#3fbf93" />
          <stop offset="100%" stopColor="#8fdcbf" />
        </linearGradient>

        {/* Textura: fibra de madera, vetas horizontales finas */}
        <filter id={`${id}-fibra`} x={x0} y={vb.y} width={vb.width} height={vb.height} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.32" numOctaves="3" seed="7" result="ruido" />
          <feColorMatrix in="ruido" type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 -1.6 1.15" />
        </filter>

        {/* Brillo que cruza la palabra de vez en cuando */}
        <linearGradient id={`${id}-brillo`} gradientUnits="userSpaceOnUse" x1={x0 - 70} y1="0" x2={x0} y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          <animateTransform
            attributeName="gradientTransform" type="translate"
            values={`0 0; ${vb.width + 140} 0; ${vb.width + 140} 0`} keyTimes="0; 0.4; 1"
            dur="6s" begin={`${duracion + 0.8}s`} repeatCount="indefinite"
          />
        </linearGradient>

        {/* Halo del cursor */}
        <radialGradient ref={gradRef} id={`${id}-halo`} gradientUnits="userSpaceOnUse" r={vb.width * 0.16} cx="150" cy="50">
          <stop offset="0%"   stopColor="#d9f7ea" stopOpacity="0.85" />
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
        {/* La palabra rellena, para limitar textura, halo y brillo */}
        <mask id={`${id}-letras`} maskUnits="userSpaceOnUse" {...area}>
          {texto({ fill: 'white' })}
        </mask>
      </defs>

      {/* Solo para medir la palabra (invisible) */}
      {texto({ ref: medidaRef, fill: 'none', 'aria-hidden': true })}

      <rect {...area} className="the-contorno" mask={`url(#${id}-contorno)`} />
      <g className="the-relleno" mask={`url(#${id}-letras)`}>
        <rect {...area} fill={`url(#${id}-relleno)`} />
        <rect {...area} filter={`url(#${id}-fibra)`} className="the-fibra" />
        <rect {...area} fill={`url(#${id}-brillo)`} />
        <rect {...area} fill={`url(#${id}-halo)`} className="the-halo" style={{ opacity: hover ? 1 : 0 }} />
      </g>
      <rect {...area} className="the-linea" mask={`url(#${id}-trazo)`} />
    </svg>
  )
}

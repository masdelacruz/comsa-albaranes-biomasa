import { useRef } from 'react'
// 'motion' se usa como <motion.div>/<motion.button>; no-unused-vars no lo detecta sin eslint-plugin-react.
// eslint-disable-next-line no-unused-vars
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import './Dock.css'

const BASE     = 44   // tamaño base del icono (px)
const MAX      = 62   // tamaño al pasar el ratón por encima
const DISTANCE = 130  // radio de influencia del ratón (px)

function DockButton({ item, mouseX }) {
  const ref = useRef(null)

  const distance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return DISTANCE
    return val - (rect.left + rect.width / 2)
  })

  const sizeSync = useTransform(distance, [-DISTANCE, 0, DISTANCE], [BASE, MAX, BASE])
  const size = useSpring(sizeSync, { mass: 0.1, stiffness: 200, damping: 14 })

  return (
    <motion.button
      ref={ref}
      type="button"
      style={{ width: size, height: size }}
      className={`dock-btn${item.active ? ' dock-btn--active' : ''}${item.isAvatar ? ' dock-btn--avatar' : ''}`}
      onClick={item.onClick}
      aria-label={item.label}
    >
      <span className="dock-btn-tooltip">{item.label}</span>
      {!!item.badge && <span className="dock-btn-badge">{item.badge}</span>}
      {item.isAvatar ? <span className="dock-avatar">{item.initials}</span> : item.icon}
      {item.active && <span className="dock-btn-dot" />}
    </motion.button>
  )
}

export default function Dock({ items }) {
  const mouseX = useMotionValue(Infinity)

  return (
    <div className="dock-wrap">
      <motion.div
        className="dock-bar"
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
      >
        {items.map((item, i) => (
          <span key={item.key} style={{ display: 'flex', alignItems: 'flex-end' }}>
            {item.isAvatar && i > 0 && <span className="dock-divider" />}
            <DockButton item={item} mouseX={mouseX} />
          </span>
        ))}
      </motion.div>
    </div>
  )
}

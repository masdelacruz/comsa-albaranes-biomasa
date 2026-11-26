import { useEffect, useState } from 'react'
import TextHoverEffect from './TextHoverEffect'
import logoIcon from '../assets/logo_biomasa_icon.png'
import './IntroTrazam.css'

const CLAVE = 'trazam:intro-vista'

const yaVista = () => {
  try { return sessionStorage.getItem(CLAVE) === '1' } catch { return false }
}
const marcarVista = () => {
  try { sessionStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento: se verá otra vez */ }
}
const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Intro de marca al abrir la web: "TRAZAM" se dibuja en trazo y un brillo de
// colores lo recorre. Una vez por sesión del navegador; se salta con un clic
// o una tecla, y no aparece si el sistema pide reducir el movimiento.
export default function IntroTrazam() {
  const [visible, setVisible] = useState(() => !yaVista() && !sinMovimiento())
  const [saliendo, setSaliendo] = useState(false)

  useEffect(() => {
    if (!visible) return
    // Se marca como vista al terminar, no al montar: si el componente se
    // vuelve a montar (StrictMode, recarga de rutas) la intro no se pierde
    const salir = setTimeout(() => setSaliendo(true), 3600)
    const fin   = setTimeout(() => { marcarVista(); setVisible(false) }, 4200)
    const saltar = () => { marcarVista(); setSaliendo(true); setTimeout(() => setVisible(false), 500) }
    window.addEventListener('keydown', saltar, { once: true })
    return () => { clearTimeout(salir); clearTimeout(fin); window.removeEventListener('keydown', saltar) }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className={`intro-trazam${saliendo ? ' saliendo' : ''}`}
      onClick={() => { marcarVista(); setSaliendo(true); setTimeout(() => setVisible(false), 500) }}
      role="presentation"
    >
      <div className="intro-trazam-contenido">
        <TextHoverEffect text="TRAZAM" autoBarrido duracion={2.6} className="intro-trazam-texto" />
        <div className="intro-trazam-firma">
          <img src={logoIcon} alt="" />
          <span>by COMSA Service</span>
        </div>
      </div>
      <div className="intro-trazam-saltar">Haz clic para continuar</div>
    </div>
  )
}

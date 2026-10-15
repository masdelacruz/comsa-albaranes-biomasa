import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell } from 'lucide-react'
import './NotificacionesBell.css'

// Campanita de notificaciones para los paneles públicos de cliente
// (astilladora / instalación). Sin usuario logueado detrás — se identifica
// por tipo + nombre de empresa, igual que el resto del panel. `tipo` puede ser
// una lista: una empresa con varios tipos tiene un solo panel y una sola
// campana con las notificaciones de todos ellos.
export default function NotificacionesBell({ tipo, nombre, codigo }) {
  const [notifs, setNotifs] = useState([])
  const [open,   setOpen]   = useState(false)
  const wrapRef = useRef(null)
  const tiposKey = [].concat(tipo).join(',')
  const qs = `?c=${encodeURIComponent(codigo || '')}`

  const fetchNotifs = useCallback(async () => {
    try {
      const listas = await Promise.all(tiposKey.split(',').map(async t => {
        const res  = await fetch(`/api/notificaciones/${t}/${encodeURIComponent(nombre)}${qs}`)
        const data = await res.json()
        return Array.isArray(data) ? data : []
      }))
      setNotifs(listas.flat().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
    } catch {}
  }, [tiposKey, nombre, qs])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const noLeidas = notifs.filter(n => !n.leida).length

  const toggle = async () => {
    const next = !open
    setOpen(next)
    // Se marcan como leídas al abrir el desplegable — no hay usuario
    // individual detrás de este panel, así que no tiene sentido marcar
    // una a una.
    if (next && noLeidas > 0) {
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
      try {
        await Promise.all(tiposKey.split(',').map(t =>
          fetch(`/api/notificaciones/${t}/${encodeURIComponent(nombre)}/marcar-leidas${qs}`, { method: 'POST' })))
      } catch {}
    }
  }

  const fmtFecha = (f) => {
    const d = new Date(f)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button className="nb-btn" onClick={toggle} title="Notificaciones">
        <Bell size={14} />
        {noLeidas > 0 && <span className="nb-badge">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>
      {open && (
        <div className="nb-dropdown">
          <div className="nb-dropdown-title">Notificaciones</div>
          {notifs.length === 0 ? (
            <div className="nb-empty">Sin notificaciones</div>
          ) : (
            <div className="nb-list">
              {notifs.map(n => (
                <div key={n.id} className="nb-item">
                  <div className="nb-item-msg">{n.mensaje}</div>
                  <div className="nb-item-fecha">{fmtFecha(n.fecha)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

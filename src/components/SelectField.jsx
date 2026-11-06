import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import './SelectField.css'

export default function SelectField({ value, onChange, options, placeholder, clearable, variant }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const listaRef = useRef(null)

  // Al abrir: medir el hueco dentro del contenedor (el más cercano con
  // data-sf-limite, p. ej. un modal; si no, la ventana) y abrir hacia donde quepa
  useLayoutEffect(() => {
    if (!open || !listaRef.current) return
    const lista = listaRef.current
    lista.style.maxHeight = ''
    const tope = parseFloat(getComputedStyle(lista).maxHeight) || 360
    const alto = Math.min(lista.scrollHeight, tope)
    const trig = wrapRef.current.querySelector('.sf-trigger').getBoundingClientRect()
    const lim  = wrapRef.current.closest('[data-sf-limite]')?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
    const abajo  = lim.bottom - trig.bottom - 12
    const encima = trig.top - lim.top - 12
    const haciaArriba = alto > abajo && encima > abajo
    // Altura en opciones enteras: que la última visible no quede cortada a medias
    let max = Math.max(96, Math.min(tope, haciaArriba ? encima : abajo))
    const opcion = lista.querySelector('.sf-option')
    if (opcion && lista.scrollHeight > max) {
      const cs = getComputedStyle(lista)
      const extra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
      const h = opcion.getBoundingClientRect().height
      max = Math.max(2, Math.floor((max - extra) / h)) * h + extra
    }
    // Directo al DOM (data-arriba y max-height): es solo colocación, no estado de React
    wrapRef.current.dataset.arriba = haciaArriba ? '1' : ''
    lista.style.maxHeight = `${max}px`
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className={`sf${variant ? ` sf-${variant}` : ''}`} ref={wrapRef}>
      <div className="sf-inner">
        <div
          className={`sf-trigger${!value ? ' sf-empty' : ''}${open ? ' sf-open' : ''}`}
          onClick={() => setOpen(o => !o)}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) }
            if (e.key === 'Escape') setOpen(false)
          }}
        >
          <span className="sf-label">{value || placeholder}</span>
          <svg className="sf-chevron" viewBox="0 0 12 12" width="11" height="11">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {open && (
          <ul className="sf-dropdown" ref={listaRef}>
            {options.map(opt => (
              <li
                key={opt}
                className={`sf-option${opt === value ? ' sf-selected' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
      {clearable && value && (
        <button type="button" className="sf-clear" onClick={() => onChange('')} title="Limpiar">×</button>
      )}
    </div>
  )
}

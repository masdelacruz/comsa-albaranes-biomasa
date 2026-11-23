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

  // Opción resaltada: una sola, compartida por ratón y teclado (antes el
  // fondo gris de :hover se quedaba en la fila del ratón al usar el teclado).
  const [activo, setActivo] = useState(-1)
  const busqueda = useRef({ texto: '', t: 0 })

  const abrir = (indice) => {
    setActivo(indice ?? options.indexOf(value))
    setOpen(true)
  }
  const cerrar = () => { setOpen(false); setActivo(-1) }
  const elegir = (opt) => { onChange(opt); cerrar() }

  useEffect(() => {
    if (!open || activo < 0) return
    listaRef.current?.children[activo]?.scrollIntoView({ block: 'nearest' })
  }, [open, activo])

  // Búsqueda por teclado como un <select> nativo: varias letras seguidas
  // buscan por prefijo ("fu" → Fustes…); repetir la misma letra recorre en
  // bucle las opciones que empiezan por ella (f → Forest, f → Fustes, …).
  const normal = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const buscar = (tecla) => {
    const ahora = Date.now()
    const b = busqueda.current
    b.texto = ahora - b.t > 800 ? tecla : b.texto + tecla
    b.t = ahora
    const q = normal(b.texto)
    const mismaLetra = [...q].every(c => c === q[0])
    const desde = open ? activo : options.indexOf(value)
    const n = options.length
    // Misma letra: siguiente coincidencia tras la actual; prefijo: desde la actual
    const inicio = mismaLetra ? desde + 1 : Math.max(desde, 0)
    const patron = mismaLetra ? q[0] : q
    for (let k = 0; k < n; k++) {
      const i = (inicio + k + n) % n
      if (normal(options[i]).startsWith(patron)) { open ? setActivo(i) : abrir(i); return }
    }
  }

  const onKeyDown = (e) => {
    const n = options.length
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return abrir()
      const d = e.key === 'ArrowDown' ? 1 : -1
      setActivo(a => (a < 0 ? (d > 0 ? 0 : n - 1) : (a + d + n) % n))
    } else if (e.key === 'Enter' || (e.key === ' ' && Date.now() - busqueda.current.t > 800)) {
      // El espacio abre/elige, salvo en mitad de una búsqueda ("serveis m…")
      e.preventDefault()
      if (open && activo >= 0) elegir(options[activo])
      else open ? cerrar() : abrir()
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); cerrar() }
    } else if (e.key === 'Tab') {
      cerrar()
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      buscar(e.key)
    }
  }
  return (
    <div className={`sf${variant ? ` sf-${variant}` : ''}`} ref={wrapRef}>
      <div className="sf-inner">
        <div
          className={`sf-trigger${!value ? ' sf-empty' : ''}${open ? ' sf-open' : ''}`}
          onClick={() => (open ? cerrar() : abrir())}
          tabIndex={0}
          role="combobox"
          aria-expanded={open}
          onKeyDown={onKeyDown}
        >
          <span className="sf-label">{value || placeholder}</span>
          <svg className="sf-chevron" viewBox="0 0 12 12" width="11" height="11">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {open && (
          <ul className="sf-dropdown" ref={listaRef}>
            {options.map((opt, i) => (
              <li
                key={opt}
                role="option"
                aria-selected={opt === value}
                className={`sf-option${opt === value ? ' sf-selected' : ''}${i === activo ? ' sf-activa' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onMouseMove={() => { if (i !== activo) setActivo(i) }}
                onClick={() => elegir(opt)}
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

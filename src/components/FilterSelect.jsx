import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, Check, Search } from 'lucide-react'

// Filtro de selección múltiple. Sin valores muestra el nombre del campo en
// gris ("Proveedor", "Estado"...); con valores se resalta en verde y una ×
// quita ese filtro entero. `value` es un array; `options` admite strings o
// { value, label }. El panel va en un portal con posición fija para que no
// lo recorte el overflow de la tarjeta que contiene los filtros.
export default function FilterSelect({ label, value = [], onChange, options = [] }) {
  const [abierto, setAbierto] = useState(false)
  const [texto,   setTexto]   = useState('')
  const [pos,     setPos]     = useState(null)
  const triggerRef = useRef(null)
  const panelRef   = useRef(null)

  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
  const seleccion = new Set(value)
  const activo = value.length > 0
  const visibles = texto
    ? opts.filter(o => o.label.toLowerCase().includes(texto.toLowerCase()))
    : opts

  const resumen = !activo ? label
    : value.length === 1 ? (opts.find(o => o.value === value[0])?.label ?? value[0])
    : `${label}: ${value.length}`

  const toggle = (v) => onChange(seleccion.has(v) ? value.filter(x => x !== v) : [...value, v])

  const recolocar = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const ancho = Math.max(r.width, 240)
    const left  = Math.min(r.left, window.innerWidth - ancho - 8)
    setPos({ top: r.bottom + 4, left: Math.max(8, left), width: ancho })
  }

  useLayoutEffect(() => { if (abierto) recolocar() }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      setAbierto(false)
    }
    const esc = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    window.addEventListener('resize', recolocar)
    window.addEventListener('scroll', recolocar, true)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('resize', recolocar)
      window.removeEventListener('scroll', recolocar, true)
    }
  }, [abierto])

  useEffect(() => { if (!abierto) setTexto('') }, [abierto])

  return (
    <div className={`filter-select${activo ? ' is-active' : ''}${abierto ? ' is-open' : ''}`} ref={triggerRef}>
      <button type="button" className="filter-select-trigger" onClick={() => setAbierto(o => !o)}
        title={activo ? value.map(v => opts.find(o => o.value === v)?.label ?? v).join(', ') : label}
        aria-haspopup="listbox" aria-expanded={abierto}>
        <span className="filter-select-text">{resumen}</span>
        <ChevronDown size={14} className="filter-select-chevron" />
      </button>
      {activo && (
        <button type="button" className="filter-select-clear" onClick={() => onChange([])}
          title={`Quitar filtro de ${label.toLowerCase()}`} aria-label={`Quitar filtro de ${label.toLowerCase()}`}>
          <X size={12} />
        </button>
      )}

      {abierto && pos && createPortal(
        <div className="filter-select-panel" ref={panelRef} role="listbox" aria-multiselectable="true"
          style={{ top: pos.top, left: pos.left, width: pos.width }}>
          {opts.length > 8 && (
            <div className="filter-select-search">
              <Search size={13} />
              <input autoFocus type="text" placeholder={`Buscar ${label.toLowerCase()}...`} value={texto} onChange={e => setTexto(e.target.value)} />
            </div>
          )}
          <div className="filter-select-list">
            {visibles.length === 0 && <div className="filter-select-empty">Sin resultados</div>}
            {visibles.map(o => {
              const marcado = seleccion.has(o.value)
              return (
                <button type="button" key={o.value} role="option" aria-selected={marcado}
                  className={`filter-select-option${marcado ? ' is-checked' : ''}`} onClick={() => toggle(o.value)}>
                  <span className="filter-select-check">{marcado && <Check size={11} strokeWidth={3} />}</span>
                  <span className="filter-select-option-label">{o.label}</span>
                </button>
              )
            })}
          </div>
          <div className="filter-select-foot">
            <button type="button" disabled={!activo} onClick={() => onChange([])}>Mostrar todos</button>
            <button type="button" className="is-primary" onClick={() => setAbierto(false)}>Listo</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import './SelectField.css'

export default function SelectField({ value, onChange, options, placeholder, clearable, variant }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

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
          <ul className="sf-dropdown">
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

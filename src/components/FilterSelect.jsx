import { X } from 'lucide-react'

// Select de filtro: sin valor muestra el nombre del campo en gris
// ("Proveedor", "Estado"...) en lugar de "Todos los ..."; con valor se
// resalta y aparece una × para quitar ese filtro concreto.
export default function FilterSelect({ label, value, onChange, children }) {
  return (
    <div className={`filter-select${value ? ' is-active' : ''}`}>
      <select value={value} onChange={e => onChange(e.target.value)} title={label} aria-label={label}>
        <option value="">{label}</option>
        {children}
      </select>
      {value && (
        <button type="button" className="filter-select-clear" onClick={() => onChange('')}
          title={`Quitar filtro de ${label.toLowerCase()}`} aria-label={`Quitar filtro de ${label.toLowerCase()}`}>
          <X size={12} />
        </button>
      )}
    </div>
  )
}

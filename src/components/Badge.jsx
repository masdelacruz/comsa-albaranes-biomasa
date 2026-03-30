export const ESTADOS = {
  pendiente_campo:   { label: 'Pendiente campo',  color: 'amber' },
  en_transito:       { label: 'En tránsito',       color: 'blue'  },
  humedad_pendiente: { label: 'Humedad pendiente', color: 'red'   },
  cerrado:           { label: 'Cerrado',            color: 'green' },
}

export function Badge({ estado }) {
  const e = ESTADOS[estado] || { label: estado, color: 'gray' }
  return <span className={`badge badge-${e.color}`}>{e.label}</span>
}

export function FirmaSteps({ firmas }) {
  const steps = [
    { key: 'oficina',     label: 'Oficina' },
    { key: 'astilladora', label: 'Astilladora' },
    { key: 'camionero',   label: 'Camionero' },
    { key: 'instalacion', label: 'Instalación' },
  ]
  return (
    <div className="firma-steps">
      {steps.map((s, i) => {
        const primeroSinFirmar = steps.findIndex(x => !firmas[x.key]?.firmado)
        const estado = firmas[s.key]?.firmado ? 'done' : i === primeroSinFirmar ? 'active' : 'pending'
        return (
          <div key={s.key} className="firma-step-wrap">
            <div className={`firma-dot ${estado}`}>{firmas[s.key]?.firmado ? '✓' : i + 1}</div>
            {i < steps.length - 1 && <div className="firma-line" />}
          </div>
        )
      })}
    </div>
  )
}
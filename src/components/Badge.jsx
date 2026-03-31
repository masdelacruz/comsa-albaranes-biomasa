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
  const keys = Object.keys(firmas)
  const esOp2 = !keys.includes('astilladora') && !keys.includes('camionero')

  if (esOp2) {
    const pasos = [
      { key: 'oficina',     num: 1 },
      { key: 'instalacion', num: 2 },
    ]
    return (
      <div className="firma-steps">
        {pasos.map((s, i) => {
          const firma = firmas[s.key]
          const estado = firma?.firmado ? 'done' : 'pending'
          return (
            <div key={s.key} className="firma-step-wrap">
              <div className={`firma-dot ${estado}`}>{firma?.firmado ? '✓' : s.num}</div>
              {i < pasos.length - 1 && (
                <div className="firma-line" style={{width: 64}} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const pasos = [
    { key: 'oficina' },
    { key: 'proveedor' },
    { key: 'astilladora' },
    { key: 'camionero' },
    { key: 'instalacion' },
  ].filter(s => keys.includes(s.key))

  const primeroSinFirmar = pasos.findIndex(s => !firmas[s.key]?.firmado)

  return (
    <div className="firma-steps">
      {pasos.map((s, i) => {
        const firma = firmas[s.key]
        const estado = firma?.firmado ? 'done' : i === primeroSinFirmar ? 'active' : 'pending'
        return (
          <div key={s.key} className="firma-step-wrap">
            <div className={`firma-dot ${estado}`}>{firma?.firmado ? '✓' : i + 1}</div>
            {i < pasos.length - 1 && <div className="firma-line" />}
          </div>
        )
      })}
    </div>
  )
}
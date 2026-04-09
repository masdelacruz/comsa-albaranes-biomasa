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

const LINE_W = 16

export function FirmaSteps({ firmas }) {
  const keys = Object.keys(firmas)
  const esOp2 = !keys.includes('astilladora') && !keys.includes('transportista')

  if (esOp2) {
    const pasos = [{ key: 'oficina' }, { key: 'instalacion' }]
    return (
      <div className="firma-steps">
        {pasos.map((s, i) => {
          const firma = firmas[s.key]
          const estado = firma?.firmado ? 'done' : 'pending'
          return (
            <div key={s.key} className="firma-step-wrap">
              <div className={`firma-dot ${estado}`}>{firma?.firmado ? '✓' : i + 1}</div>
              {i < pasos.length - 1 && <div className="firma-line" style={{width: LINE_W * 3 + 20 * 2}} />}
            </div>
          )
        })}
      </div>
    )
  }

  const pasos = [
    { key: 'oficina' },
    { key: 'astilladora' },
    { key: 'transportista' },
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
            {i < pasos.length - 1 && <div className="firma-line" style={{width: LINE_W}} />}
          </div>
        )
      })}
    </div>
  )
}
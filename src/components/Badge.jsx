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

const PASOS_OP1 = ['proveedor', 'astilladora', 'transportista', 'instalacion', 'oficina']
const PASOS_OP2 = ['proveedor', 'instalacion', 'oficina']

export function FirmaSteps({ firmas, estado }) {
  const keys = Object.keys(firmas)
  const esOp2 = !keys.includes('astilladora') && !keys.includes('transportista')
  const cerrado = estado === 'cerrado'

  const pasos = (esOp2 ? PASOS_OP2 : PASOS_OP1)
    .filter(k => keys.includes(k))
    .map(k => ({ key: k }))

  const primeroSinFirmar = pasos.findIndex(s => !firmas[s.key]?.firmado)

  return (
    <div className={`firma-steps${cerrado ? ' firma-steps-cerrado' : ''}`}>
      {pasos.map((s, i) => {
        const firma = firmas[s.key]
        const dotEstado = firma?.firmado ? (cerrado ? 'cerrado' : 'done') : i === primeroSinFirmar ? 'active' : 'pending'
        return (
          <div key={s.key} className="firma-step-wrap">
            <div className={`firma-dot ${dotEstado}`}>{firma?.firmado ? '✓' : i + 1}</div>
            {i < pasos.length - 1 && <div className={`firma-line${cerrado ? ' firma-line-cerrado' : ''}`} style={{width: LINE_W}} />}
          </div>
        )
      })}
    </div>
  )
}
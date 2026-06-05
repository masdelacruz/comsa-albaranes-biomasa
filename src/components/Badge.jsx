export const ESTADOS = {
  programado:        { label: 'Programado',         color: 'gray'   },
  pendiente_campo:   { label: 'Pendiente campo',    color: 'amber'  },
  pendiente_oficina: { label: 'Pendiente oficina',  color: 'blue'   },
  humedad_pendiente: { label: 'Humedad pendiente',  color: 'red'    },
  cerrado:           { label: 'Cerrado',             color: 'green'  },
}

export function Badge({ estado }) {
  const e = ESTADOS[estado] || { label: estado, color: 'gray' }
  return <span className={`badge badge-${e.color}`}>{e.label}</span>
}

const LINE_W = 16

const PASOS_OP1 = ['proveedor', 'astilladora', 'transportista', 'instalacion']
const PASOS_OP2 = ['proveedor', 'instalacion']

export function FirmaSteps({ firmas, estado }) {
  const keys = Object.keys(firmas)
  const esOp2 = !keys.includes('astilladora') && !keys.includes('transportista')
  const cerrado = estado === 'cerrado'
  const oficinaSiguiente = estado === 'pendiente_oficina' || estado === 'humedad_pendiente'

  const pasos = (esOp2 ? PASOS_OP2 : PASOS_OP1)
    .filter(k => keys.includes(k))
    .map(k => ({ key: k }))

  const primeroSinFirmar = pasos.findIndex(s => !firmas[s.key]?.firmado)

  let wrapClass = 'firma-steps'
  if (cerrado)           wrapClass += ' firma-steps-cerrado'
  else if (oficinaSiguiente) wrapClass += ' firma-steps-oficina-next'

  return (
    <div className={wrapClass}>
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
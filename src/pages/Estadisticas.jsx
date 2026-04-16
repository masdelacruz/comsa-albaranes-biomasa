import { useMemo } from 'react'
import { ultimas4Semanas } from '../utils/semana'
import '../components/shared.css'
import './Estadisticas.css'

const COLORES = ['#1D9E75','#3b82f6','#f5a623','#e24b4a','#8b5cf6','#ec4899']

export default function Estadisticas({ albaranes }) {
  const stats = useMemo(() => {
    const total = albaranes.length
    const cerrados = albaranes.filter(a => a.estado === 'cerrado').length
    const pendientes = albaranes.filter(a => a.estado !== 'cerrado').length
    const conHumedad = albaranes.filter(a => a.pesada.humedad != null)
    const humedadMedia = conHumedad.length
      ? (conHumedad.reduce((acc, a) => acc + a.pesada.humedad, 0) / conHumedad.length).toFixed(1)
      : null
    const conPeso = albaranes.filter(a => a.pesada.entrada && a.pesada.salida)
    const pesoTotal = conPeso.reduce((acc, a) => acc + (a.pesada.entrada - a.pesada.salida), 0)

    const porInstalacion = {}
    albaranes.forEach(a => {
      if (!porInstalacion[a.instalacion]) porInstalacion[a.instalacion] = { total: 0, cerrados: 0, peso: 0 }
      porInstalacion[a.instalacion].total++
      if (a.estado === 'cerrado') porInstalacion[a.instalacion].cerrados++
      if (a.pesada.entrada && a.pesada.salida) porInstalacion[a.instalacion].peso += (a.pesada.entrada - a.pesada.salida)
    })

    const porAstilladora = {}
    albaranes.forEach(a => {
      if (!porAstilladora[a.astilladora]) porAstilladora[a.astilladora] = 0
      porAstilladora[a.astilladora]++
    })

    const porEspecie = {}
    albaranes.forEach(a => {
      if (!porEspecie[a.especie]) porEspecie[a.especie] = 0
      porEspecie[a.especie]++
    })

    const porEstado = {
      'Cerrado':           albaranes.filter(a => a.estado === 'cerrado').length,
      'En tránsito':       albaranes.filter(a => a.estado === 'en_transito').length,
      'Pendiente campo':   albaranes.filter(a => a.estado === 'pendiente_campo').length,
      'Humedad pendiente': albaranes.filter(a => a.estado === 'humedad_pendiente').length,
    }

    const semanas = ultimas4Semanas(albaranes)

    return {
      total, cerrados, pendientes, humedadMedia, pesoTotal,
      porInstalacion: Object.entries(porInstalacion).sort((a,b) => b[1].total - a[1].total),
      porAstilladora: Object.entries(porAstilladora).sort((a,b) => b[1] - a[1]),
      porEspecie:     Object.entries(porEspecie).sort((a,b) => b[1] - a[1]),
      porEstado:      Object.entries(porEstado).filter(([,v]) => v > 0),
      semanas,
      maxSemana: Math.max(...semanas.map(s => s.val), 1),
    }
  }, [albaranes])

  return (
    <div className="stats-page">
      <div className="page-header">
        <div className="page-title">Estadísticas</div>
        <div className="page-sub">Resumen de operaciones de biomasa · {new Date().getFullYear()}</div>
      </div>

      <div className="stats-content">
        <div className="stats-grid-3">
          <div className="stat-card">
            <div className="kpi-big">
              <div className="kpi-big-val" style={{color:'var(--gray-900)'}}>{stats.total}</div>
              <div className="kpi-big-label">Albaranes totales</div>
              <div className="kpi-big-sub">esta semana</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="kpi-big">
              <div className="kpi-big-val" style={{color:'var(--green-400)'}}>{stats.cerrados}</div>
              <div className="kpi-big-label">Cerrados correctamente</div>
              <div className="kpi-big-sub">{stats.total > 0 ? Math.round(stats.cerrados/stats.total*100) : 0}% del total</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="kpi-big">
              <div className="kpi-big-val" style={{color:'var(--green-400)'}}>
                {stats.pesoTotal > 0 ? (stats.pesoTotal/1000).toFixed(1) + ' t' : '—'}
              </div>
              <div className="kpi-big-label">Peso neto gestionado</div>
              <div className="kpi-big-sub">con pesada registrada</div>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">Albaranes por instalación</div>
            {stats.porInstalacion.map(([inst, data], i) => (
              <div key={inst} className="bar-row">
                <div className="bar-label" title={inst}>{inst}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    width: `${(data.total / stats.total) * 100}%`,
                    background: COLORES[i % COLORES.length]
                  }} />
                </div>
                <div className="bar-val">{data.total}</div>
              </div>
            ))}
          </div>

          <div className="stat-card">
            <div className="stat-card-title">Albaranes por astilladora</div>
            {stats.porAstilladora.map(([ast, count], i) => (
              <div key={ast} className="bar-row">
                <div className="bar-label" title={ast}>{ast}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    width: `${(count / stats.total) * 100}%`,
                    background: COLORES[i % COLORES.length]
                  }} />
                </div>
                <div className="bar-val">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-title">Estado de albaranes</div>
            <div className="donut-wrap">
              <svg width="90" height="90" viewBox="0 0 90 90">
                {(() => {
                  let offset = 0
                  const r = 30, cx = 45, cy = 45
                  const circ = 2 * Math.PI * r
                  return stats.porEstado.map(([label, val], i) => {
                    const pct = val / stats.total
                    const dash = pct * circ
                    const el = (
                      <circle key={label} cx={cx} cy={cy} r={r}
                        fill="none" stroke={COLORES[i]} strokeWidth="18"
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 45 45)"
                      />
                    )
                    offset += dash
                    return el
                  })
                })()}
                <circle cx="45" cy="45" r="20" fill="white" />
                <text x="45" y="49" textAnchor="middle" fontSize="13" fontWeight="600" fill="#2c2b27">{stats.total}</text>
              </svg>
              <div className="donut-legend">
                {stats.porEstado.map(([label, val], i) => (
                  <div key={label} className="donut-legend-item">
                    <div className="donut-dot" style={{background: COLORES[i]}} />
                    <span className="donut-legend-label">{label}</span>
                    <span className="donut-legend-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-title">Volumen semanal (albaranes)</div>
            <div className="timeline-semana">
              {stats.semanas.map(s => (
                <div key={s.label} className="semana-bar-wrap">
                  <div className="semana-val">{s.val}</div>
                  <div
                    className={`semana-bar ${s.activa ? '' : 'inactive'}`}
                    style={{height: `${(s.val / stats.maxSemana) * 100}%`}}
                  />
                  <div className="semana-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,paddingTop:10,borderTop:'var(--border)',fontSize:12,color:'var(--gray-400)'}}>
              Humedad media: <strong style={{color:'var(--gray-800)'}}>{stats.humedadMedia ? stats.humedadMedia + '%' : '—'}</strong>
              &nbsp;·&nbsp; Pendientes: <strong style={{color:'var(--amber-700)'}}>{stats.pendientes}</strong>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">Detalle por instalación</div>
          <table className="instalacion-table">
            <thead>
              <tr>
                <th>Instalación</th>
                <th>Albaranes</th>
                <th>Cerrados</th>
                <th>% completado</th>
                <th>Peso neto (t)</th>
              </tr>
            </thead>
            <tbody>
              {stats.porInstalacion.map(([inst, data]) => {
                const pct = data.total > 0 ? Math.round(data.cerrados / data.total * 100) : 0
                return (
                  <tr key={inst}>
                    <td style={{fontWeight:500}}>{inst}</td>
                    <td>{data.total}</td>
                    <td>{data.cerrados}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:6,background:'var(--gray-100)',borderRadius:99,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${pct}%`,background:'var(--green-400)',borderRadius:99}} />
                        </div>
                        <span style={{fontSize:12,fontWeight:500,color:'var(--gray-600)',width:32}}>{pct}%</span>
                      </div>
                    </td>
                    <td>{data.peso > 0 ? (data.peso/1000).toFixed(1) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
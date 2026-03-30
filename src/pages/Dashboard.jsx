import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Filter } from 'lucide-react'
import { Badge, FirmaSteps } from '../components/Badge'
import '../components/shared.css'
import './Dashboard.css'

export default function Dashboard({ albaranes }) {
  const navigate = useNavigate()
  const [filtroInstalacion, setFiltroInstalacion] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const instalaciones = [...new Set(albaranes.map(a => a.instalacion))]
  const pendienteFirma = albaranes.filter(a => a.estado !== 'cerrado').length
  const cerrados = albaranes.filter(a => a.estado === 'cerrado').length
  const conIncidencia = albaranes.filter(a => a.estado === 'humedad_pendiente').length
  const alertas = albaranes.filter(a => a.estado === 'humedad_pendiente')

  const filtrados = albaranes.filter(a => {
    if (filtroInstalacion && a.instalacion !== filtroInstalacion) return false
    if (filtroEstado && a.estado !== filtroEstado) return false
    return true
  })

  return (
    <div className="dashboard">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-sub">Semana 13 · 24–28 marzo 2025</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/nuevo')}>
            <Plus size={15} /> Nuevo albarán
          </button>
        </div>
      </div>

      <div className="dash-content">
        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-label">Albaranes esta semana</div><div className="kpi-val">{albaranes.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Pendientes de firma</div><div className="kpi-val amber">{pendienteFirma}</div></div>
          <div className="kpi-card"><div className="kpi-label">Cerrados</div><div className="kpi-val green">{cerrados}</div></div>
          <div className="kpi-card"><div className="kpi-label">Con incidencia</div><div className="kpi-val red">{conIncidencia}</div></div>
        </div>

        {alertas.map(a => (
          <div key={a.id} className="alerta-bar" onClick={() => navigate(`/albaran/${a.id}`)}>
            <AlertTriangle size={14} />
            <span><strong>{a.id}</strong> · {a.instalacion} · Humedad pendiente de análisis — muestra enviada hace 18h</span>
            <span className="alerta-link">Ver →</span>
          </div>
        ))}

        <div className="table-header">
          <div className="section-label" style={{margin:0}}>Albaranes en curso</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <Filter size={13} color="var(--gray-400)" />
            <select value={filtroInstalacion} onChange={e => setFiltroInstalacion(e.target.value)} style={{width:'auto',fontSize:12,padding:'5px 8px'}}>
              <option value="">Todas las instalaciones</option>
              {instalaciones.map(i => <option key={i}>{i}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{width:'auto',fontSize:12,padding:'5px 8px'}}>
              <option value="">Todos los estados</option>
              <option value="pendiente_campo">Pendiente campo</option>
              <option value="en_transito">En tránsito</option>
              <option value="humedad_pendiente">Humedad pendiente</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
        </div>

        <div className="table-wrap card" style={{padding:0}}>
          <table className="albaran-table">
            <thead>
              <tr>
                <th>Nº albarán</th><th>Fecha</th><th>Astilladora</th><th>Transportista</th>
                <th>Destino</th><th>Especie</th><th>Estado</th><th>Firmas</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(a => (
                <tr key={a.id} onClick={() => navigate(`/albaran/${a.id}`)}>
                  <td className="albaran-id">{a.id}</td>
                  <td>{a.fecha.split('-').reverse().join('/')}</td>
                  <td>{a.astilladora}</td>
                  <td>{a.transportista}</td>
                  <td>{a.instalacion}</td>
                  <td>{a.especie}</td>
                  <td><Badge estado={a.estado} /></td>
                  <td><FirmaSteps firmas={a.firmas} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
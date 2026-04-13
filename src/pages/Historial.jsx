import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Badge, FirmaSteps } from '../components/Badge'
import '../components/shared.css'
import './Historial.css'

export default function Historial({ albaranes }) {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtroInstalacion, setFiltroInstalacion] = useState('')
  const [filtroAstilladora, setFiltroAstilladora] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  const instalaciones = [...new Set(albaranes.map(a => a.instalacion))]
  const astilladoras  = [...new Set(albaranes.map(a => a.astilladora))]

  const filtrados = useMemo(() => albaranes.filter(a => {
    if (busqueda && ![a.id, a.astilladora, a.transportista, a.instalacion, a.especie, a.origen, a.permiso]
      .join(' ').toLowerCase().includes(busqueda.toLowerCase())) return false
    if (filtroInstalacion && a.instalacion !== filtroInstalacion) return false
    if (filtroAstilladora && a.astilladora !== filtroAstilladora) return false
    if (filtroEstado && a.estado !== filtroEstado) return false
    if (filtroFechaDesde && a.fecha < filtroFechaDesde) return false
    if (filtroFechaHasta && a.fecha > filtroFechaHasta) return false
    return true
  }), [albaranes, busqueda, filtroInstalacion, filtroAstilladora, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  const totalPesoNeto = filtrados.reduce((acc, a) => {
    if (a.pesada.entrada && a.pesada.salida) return acc + (a.pesada.entrada - a.pesada.salida)
    return acc
  }, 0)

  const cerrados = filtrados.filter(a => a.estado === 'cerrado').length
  const humedadMedia = filtrados.filter(a => a.pesada.humedad != null)
  const mediaHumedad = humedadMedia.length
    ? (humedadMedia.reduce((acc, a) => acc + a.pesada.humedad, 0) / humedadMedia.length).toFixed(1)
    : '—'

  const exportarExcel = () => {
    const cabeceras = [
      'Fecha', 'Nº Albarán', 'Origen', 'Permiso / Ref.',
      'Instalación destino', 'Proveedor', 'Astilladora', 'Transportista',
      'Matrícula tractora', 'Matrícula remolque', 'Chófer',
      'Especie', 'Tipo biomasa', 'SURE', 'PEFC',
      'Peso bruto (kg)', 'Tara (kg)', 'Peso neto (kg)', 'Peso neto (t)', 'Humedad (%)',
      'Estado', 'Observaciones',
    ]

    const filas = filtrados.map(a => {
      const certs    = a.certificacion ? a.certificacion.split(',') : []
      const pesoNeto = a.pesada.entrada && a.pesada.salida ? a.pesada.entrada - a.pesada.salida : null
      return [
        a.fecha.split('-').reverse().join('/'),
        a.id,
        a.origen            || '',
        a.permiso           || '',
        a.instalacion       || '',
        a.proveedor         || '',
        a.astilladora       || '',
        a.transportista     || '',
        a.matriculaTractora || '',
        a.matriculaRemolque || '',
        a.chofer            || '',
        a.especie           || '',
        a.tipoBiomasa       || '',
        certs.includes('SURE') ? '✓' : '',
        certs.includes('PEFC') ? '✓' : '',
        a.pesada.entrada != null ? a.pesada.entrada : '',
        a.pesada.salida  != null ? a.pesada.salida  : '',
        pesoNeto         != null ? pesoNeto          : '',
        pesoNeto         != null ? Number((pesoNeto / 1000).toFixed(3)) : '',
        a.pesada.humedad != null ? a.pesada.humedad  : '',
        a.estado        || '',
        a.observaciones || '',
      ]
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([cabeceras, ...filas])

    ws['!cols'] = [
      {wch:12}, // Fecha
      {wch:12}, // Nº Albarán
      {wch:32}, // Origen
      {wch:18}, // Permiso / Ref.
      {wch:26}, // Instalación destino
      {wch:22}, // Proveedor
      {wch:22}, // Astilladora
      {wch:22}, // Transportista
      {wch:16}, // Matrícula tractora
      {wch:16}, // Matrícula remolque
      {wch:16}, // Chófer
      {wch:14}, // Especie
      {wch:18}, // Tipo biomasa
      {wch:7},  // SURE
      {wch:7},  // PEFC
      {wch:15}, // Peso bruto (kg)
      {wch:12}, // Tara (kg)
      {wch:15}, // Peso neto (kg)
      {wch:14}, // Peso neto (t)
      {wch:12}, // Humedad (%)
      {wch:20}, // Estado
      {wch:34}, // Observaciones
    ]

    // Auto-filtro en todas las columnas
    const lastCol = XLSX.utils.encode_col(cabeceras.length - 1)
    const lastRow = filtrados.length + 1
    ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` }

    // Congelar primera fila
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }

    XLSX.utils.book_append_sheet(wb, ws, 'Albaranes')
    XLSX.writeFile(wb, `comsa_albaranes_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroInstalacion(''); setFiltroAstilladora('')
    setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta('')
  }

  return (
    <div className="historial-page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div className="page-title">Historial de albaranes</div>
            <div className="page-sub">{filtrados.length} registros encontrados</div>
          </div>
          <button className="btn btn-primary" onClick={exportarExcel}>
            <FileSpreadsheet size={15} /> Exportar Excel
          </button>
        </div>
      </div>

      <div className="historial-content">
        <div className="resumen-bar">
          <div className="resumen-chip">
            <div className="label">Total albaranes</div>
            <div className="val">{filtrados.length}</div>
            <div className="sub">en selección actual</div>
          </div>
          <div className="resumen-chip">
            <div className="label">Cerrados</div>
            <div className="val" style={{color:'var(--green-400)'}}>{cerrados}</div>
            <div className="sub">de {filtrados.length} totales</div>
          </div>
          <div className="resumen-chip">
            <div className="label">Peso neto total</div>
            <div className="val">{totalPesoNeto > 0 ? (totalPesoNeto / 1000).toFixed(1) + ' t' : '—'}</div>
            <div className="sub">con pesada registrada</div>
          </div>
          <div className="resumen-chip">
            <div className="label">Humedad media</div>
            <div className="val">{mediaHumedad}{mediaHumedad !== '—' ? '%' : ''}</div>
            <div className="sub">{humedadMedia.length} muestras</div>
          </div>
          <div className="resumen-chip">
            <div className="label">Pendientes</div>
            <div className="val" style={{color:'var(--amber-400)'}}>{filtrados.length - cerrados}</div>
            <div className="sub">sin cerrar</div>
          </div>
        </div>

        <div className="filtros-bar">
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <Search size={13} style={{position:'absolute',left:8,color:'var(--gray-400)'}} />
            <input
              type="text"
              placeholder="Buscar por ID, astilladora, destino..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{paddingLeft:28}}
            />
          </div>
          <select value={filtroInstalacion} onChange={e => setFiltroInstalacion(e.target.value)}>
            <option value="">Todas las instalaciones</option>
            {instalaciones.map(i => <option key={i}>{i}</option>)}
          </select>
          <select value={filtroAstilladora} onChange={e => setFiltroAstilladora(e.target.value)}>
            <option value="">Todas las astilladoras</option>
            {astilladoras.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente_campo">Pendiente campo</option>
            <option value="en_transito">En tránsito</option>
            <option value="humedad_pendiente">Humedad pendiente</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} title="Desde" />
          <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} title="Hasta" />
          {(busqueda || filtroInstalacion || filtroAstilladora || filtroEstado || filtroFechaDesde || filtroFechaHasta) && (
            <button className="btn btn-ghost" onClick={limpiarFiltros} style={{fontSize:12}}>Limpiar filtros ×</button>
          )}
        </div>

        <div className="card" style={{padding:0}}>
          <table className="historial-table">
            <thead>
              <tr>
                <th>Nº albarán</th>
                <th>Fecha</th>
                <th>Astilladora</th>
                <th>Transportista</th>
                <th>Destino</th>
                <th>Especie</th>
                <th>Peso neto</th>
                <th>Humedad</th>
                <th>Estado</th>
                <th>Firmas</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={10} className="empty-state">No hay albaranes con los filtros seleccionados</td></tr>
              ) : filtrados.map(a => (
                <tr key={a.id} onClick={() => navigate(`/albaran/${a.id}`)}>
                  <td className="albaran-id">{a.id}</td>
                  <td>{a.fecha.split('-').reverse().join('/')}</td>
                  <td>{a.astilladora}</td>
                  <td>{a.transportista}</td>
                  <td>{a.instalacion}</td>
                  <td>{a.especie}</td>
                  <td>{a.pesada.entrada && a.pesada.salida
                    ? ((a.pesada.entrada - a.pesada.salida) / 1000).toFixed(1) + ' t'
                    : <span style={{color:'var(--gray-300)'}}>—</span>}
                  </td>
                  <td>{a.pesada.humedad != null
                    ? `${a.pesada.humedad}%`
                    : <span style={{color:'var(--gray-300)'}}>—</span>}
                  </td>
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
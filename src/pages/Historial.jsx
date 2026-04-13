import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search, FileSpreadsheet } from 'lucide-react'
import ExcelJS from 'exceljs'
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

  const exportarExcel = async () => {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Comsa Service'
    const ws = wb.addWorksheet('Albaranes', {
      views: [{ state: 'frozen', ySplit: 1 }], // cabecera congelada
    })

    // ── Columnas (ancho + clave) ──────────────────────────────────────────
    ws.columns = [
      { key: 'fecha',       header: 'Fecha',              width: 13 },
      { key: 'id',          header: 'Nº Albarán',         width: 13 },
      { key: 'origen',      header: 'Origen',             width: 32 },
      { key: 'permiso',     header: 'Permiso / Ref.',     width: 20 },
      { key: 'instalacion', header: 'Instalación destino',width: 26 },
      { key: 'proveedor',   header: 'Proveedor',          width: 22 },
      { key: 'astilladora', header: 'Astilladora',        width: 22 },
      { key: 'transportista',header:'Transportista',      width: 22 },
      { key: 'tractora',    header: 'Matrícula tractora', width: 17 },
      { key: 'remolque',    header: 'Matrícula remolque', width: 17 },
      { key: 'chofer',      header: 'Chófer',             width: 16 },
      { key: 'especie',     header: 'Especie',            width: 14 },
      { key: 'biomasa',     header: 'Tipo biomasa',       width: 18 },
      { key: 'sure',        header: 'SURE',               width: 7  },
      { key: 'pefc',        header: 'PEFC',               width: 7  },
      { key: 'bruto',       header: 'Peso bruto (kg)',    width: 16 },
      { key: 'tara',        header: 'Tara (kg)',          width: 13 },
      { key: 'neto_kg',     header: 'Peso neto (kg)',     width: 16 },
      { key: 'neto_t',      header: 'Peso neto (t)',      width: 14 },
      { key: 'humedad',     header: 'Humedad (%)',        width: 13 },
      { key: 'estado',      header: 'Estado',             width: 22 },
      { key: 'obs',         header: 'Observaciones',      width: 34 },
    ]

    // ── Estilo cabecera ───────────────────────────────────────────────────
    const headerRow = ws.getRow(1)
    headerRow.height = 22
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } }
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF0F6E56' } },
      }
    })

    // ── Auto-filtro ───────────────────────────────────────────────────────
    ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } }

    // ── Filas de datos ────────────────────────────────────────────────────
    filtrados.forEach((a, i) => {
      const certs    = a.certificacion ? a.certificacion.split(',') : []
      const pesoNeto = a.pesada.entrada && a.pesada.salida ? a.pesada.entrada - a.pesada.salida : null
      const esPar    = i % 2 === 0

      const row = ws.addRow({
        fecha:        a.fecha.split('-').reverse().join('/'),
        id:           a.id,
        origen:       a.origen            || '',
        permiso:      a.permiso           || '',
        instalacion:  a.instalacion       || '',
        proveedor:    a.proveedor         || '',
        astilladora:  a.astilladora       || '',
        transportista:a.transportista     || '',
        tractora:     a.matriculaTractora || '',
        remolque:     a.matriculaRemolque || '',
        chofer:       a.chofer            || '',
        especie:      a.especie           || '',
        biomasa:      a.tipoBiomasa       || '',
        sure:         certs.includes('SURE') ? '✓' : '',
        pefc:         certs.includes('PEFC') ? '✓' : '',
        bruto:        a.pesada.entrada    ?? '',
        tara:         a.pesada.salida     ?? '',
        neto_kg:      pesoNeto            ?? '',
        neto_t:       pesoNeto != null ? Number((pesoNeto / 1000).toFixed(3)) : '',
        humedad:      a.pesada.humedad    ?? '',
        estado:       a.estado            || '',
        obs:          a.observaciones     || '',
      })

      row.height = 18

      // Color alterno de filas
      const bgColor = esPar ? 'FFFFFFFF' : 'FFF4FAF7'
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.font = { size: 10, name: 'Calibri' }
        cell.alignment = { vertical: 'middle' }
        // Borde inferior suave
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } }
      })

      // Columnas SURE y PEFC: centrado y verde si tiene
      ;['sure', 'pefc'].forEach(key => {
        const col  = ws.columns.findIndex(c => c.key === key) + 1
        const cell = row.getCell(col)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (cell.value === '✓') {
          cell.font = { size: 12, bold: true, color: { argb: 'FF1D9E75' }, name: 'Calibri' }
        }
      })

      // Columnas numéricas: alineadas a la derecha
      ;['bruto','tara','neto_kg','neto_t','humedad'].forEach(key => {
        const col  = ws.columns.findIndex(c => c.key === key) + 1
        const cell = row.getCell(col)
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      })
    })

    // ── Descargar ─────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const link   = document.createElement('a')
    link.href     = url
    link.download = `comsa_albaranes_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
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
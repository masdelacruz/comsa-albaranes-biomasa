import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Search, FileSpreadsheet, CheckSquare, Upload, Trash2, Square, X } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Badge, FirmaSteps } from '../components/Badge'
import { generarPDF } from '../utils/generarPDF'
import { api } from '../lib/api'
import '../components/shared.css'
import './Historial.css'

const TIPOS_DOC = ['Autodeclaración','Acuerdo de cesión','Contrato prestación servicios','Permiso de corta','Certificado SURE','Permiso de obra']

export default function Historial({ albaranes, usuario, refetch, borrarAlbaran }) {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [filtroInstalacion, setFiltroInstalacion] = useState('')
  const [filtroAstilladora, setFiltroAstilladora] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')

  // ── Selección masiva ──────────────────────────────────────────────
  const [seleccionando,   setSeleccionando]   = useState(false)
  const [seleccionados,   setSeleccionados]   = useState(new Set())
  const [modalAdjuntar,   setModalAdjuntar]   = useState(false)
  const [docTipo,         setDocTipo]         = useState('')
  const [docFichero,      setDocFichero]      = useState(null)
  const [adjuntando,      setAdjuntando]      = useState(false)
  const [descargando,     setDescargando]     = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminando,      setEliminando]      = useState(false)
  const [confirmBorrarFila, setConfirmBorrarFila] = useState(null)  // id del albaran a borrar individualmente
  const [pagina,          setPagina]          = useState(1)
  const POR_PAGINA = 25

  const esSuperadmin = usuario?.nivel === 'superadmin'

  const toggleSeleccion   = (id) => setSeleccionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const seleccionarTodos  = () => setSeleccionados(new Set(filtrados.map(a => a.id)))
  const deseleccionarTodos= () => setSeleccionados(new Set())
  const cancelarSeleccion = () => { setSeleccionando(false); setSeleccionados(new Set()) }

  const subirDocumento = async (albaranId, docNombre, fichero) => {
    const fd = new FormData()
    fd.append('file', fichero)
    fd.append('docNombre', docNombre)
    await api.upload(`/storage/upload/${albaranId}/doc`, fd)
  }

  const handleAdjuntarDoc = async () => {
    if (!docTipo || !docFichero) return
    setAdjuntando(true)
    try {
      for (const id of seleccionados) {
        await subirDocumento(id, docTipo, docFichero)
      }
      setModalAdjuntar(false); setDocTipo(''); setDocFichero(null)
      cancelarSeleccion()
      if (refetch) await refetch()
    } finally { setAdjuntando(false) }
  }

  const handleDescargarPDFs = async () => {
    setDescargando(true)
    for (const id of seleccionados) {
      const a = albaranes.find(x => x.id === id)
      if (a) await generarPDF(a)
    }
    setDescargando(false)
    cancelarSeleccion()
  }

  const handleEliminar = async () => {
    setEliminando(true)
    try {
      for (const id of seleccionados) {
        await api.delete(`/albaranes/${id}`)
      }
      setConfirmEliminar(false)
      cancelarSeleccion()
      if (refetch) await refetch()
    } finally { setEliminando(false) }
  }

  const instalaciones = [...new Set(albaranes.map(a => a.instalacion).filter(Boolean))]
  const astilladoras  = [...new Set(albaranes.map(a => a.astilladora).filter(Boolean))]

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

  // Resetear página al cambiar filtros
  useEffect(() => { setPagina(1) }, [busqueda, filtroInstalacion, filtroAstilladora, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const paginados    = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

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
    const ws = wb.addWorksheet('Albaranes', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [
      { key: 'fecha',       header: 'Fecha',              width: 13 },
      { key: 'id',          header: 'Nº Albarán',         width: 13 },
      { key: 'origen',      header: 'Origen',             width: 32 },
      { key: 'permiso',     header: 'Permiso / Ref.',     width: 20 },
      { key: 'instalacion', header: 'Instalación',        width: 26 },
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
    const headerRow = ws.getRow(1)
    headerRow.height = 22
    headerRow.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } }
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF0F6E56' } } }
    })
    ws.autoFilter = { from: 'A1', to: { row: 1, column: ws.columns.length } }
    filtrados.forEach((a, i) => {
      const certs    = Array.isArray(a.certificacion) ? a.certificacion : (a.certificacion ? a.certificacion.split(',') : [])
      const pesoNeto = a.pesada.entrada && a.pesada.salida ? a.pesada.entrada - a.pesada.salida : null
      const esPar    = i % 2 === 0
      const row = ws.addRow({
        fecha: a.fecha?.slice(0,10).split('-').reverse().join('/'),
        id: a.id, origen: a.origen||'', permiso: a.permiso||'',
        instalacion: a.instalacion||'', proveedor: a.proveedor||'',
        astilladora: a.astilladora||'', transportista: a.transportista||'',
        tractora: a.matriculaTractora||'', remolque: a.matriculaRemolque||'',
        chofer: a.chofer||'', especie: a.especie||'', biomasa: a.tipoBiomasa||'',
        sure: certs.includes('SURE') ? '✓' : '',
        pefc: certs.includes('PEFC') ? '✓' : '',
        bruto: a.pesada.entrada??'', tara: a.pesada.salida??'',
        neto_kg: pesoNeto??'',
        neto_t: pesoNeto != null ? Number((pesoNeto/1000).toFixed(3)) : '',
        humedad: a.pesada.humedad??'', estado: a.estado||'', obs: a.observaciones||'',
      })
      row.height = 18
      const bgColor = esPar ? 'FFFFFFFF' : 'FFF4FAF7'
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.font = { size: 10, name: 'Calibri' }
        cell.alignment = { vertical: 'middle' }
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD1D5DB' } } }
      })
      ;['sure','pefc'].forEach(key => {
        const col = ws.columns.findIndex(c => c.key === key) + 1
        const cell = row.getCell(col)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (cell.value === '✓') cell.font = { size: 12, bold: true, color: { argb: 'FF1D9E75' }, name: 'Calibri' }
      })
      ;['bruto','tara','neto_kg','neto_t','humedad'].forEach(key => {
        const col = ws.columns.findIndex(c => c.key === key) + 1
        row.getCell(col).alignment = { vertical: 'middle', horizontal: 'right' }
      })
    })
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url    = URL.createObjectURL(blob)
    const link   = document.createElement('a')
    link.href = url; link.download = `comsa_albaranes_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click(); URL.revokeObjectURL(url)
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
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-primary" onClick={exportarExcel}>
              <FileSpreadsheet size={15} /> Exportar Excel
            </button>
          </div>
        </div>
      </div>

      <div className="historial-content">
        <div className="resumen-bar">
          <div className="resumen-chip"><div className="label">Total albaranes</div><div className="val">{filtrados.length}</div><div className="sub">en selección actual</div></div>
          <div className="resumen-chip"><div className="label">Cerrados</div><div className="val" style={{color:'var(--green-400)'}}>{cerrados}</div><div className="sub">de {filtrados.length} totales</div></div>
          <div className="resumen-chip"><div className="label">Peso neto total</div><div className="val">{totalPesoNeto > 0 ? (totalPesoNeto/1000).toFixed(1)+' t' : '—'}</div><div className="sub">con pesada registrada</div></div>
          <div className="resumen-chip"><div className="label">Humedad media</div><div className="val">{mediaHumedad}{mediaHumedad !== '—' ? '%' : ''}</div><div className="sub">{humedadMedia.length} muestras</div></div>
          <div className="resumen-chip"><div className="label">Pendientes</div><div className="val" style={{color:'var(--amber-400)'}}>{filtrados.length - cerrados}</div><div className="sub">sin cerrar</div></div>
        </div>

        <div className="filtros-bar">
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <Search size={13} style={{position:'absolute',left:8,color:'var(--gray-400)'}} />
            <input type="text" placeholder="Buscar por ID, astilladora, destino..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{paddingLeft:28}} />
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
            <option value="pendiente_oficina">Pendiente oficina</option>
            <option value="humedad_pendiente">Humedad pendiente</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} title="Desde" />
          <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} title="Hasta" />
          {(busqueda||filtroInstalacion||filtroAstilladora||filtroEstado||filtroFechaDesde||filtroFechaHasta) && (
            <button className="btn btn-ghost" onClick={limpiarFiltros} style={{fontSize:12}}>Limpiar filtros ×</button>
          )}
        </div>

        {/* Barra de selección — siempre visible debajo de los filtros */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          {!seleccionando ? (
            <button className="btn" style={{fontSize:12}} onClick={() => setSeleccionando(true)}>
              <CheckSquare size={13} /> Seleccionar
            </button>
          ) : (
            <>
              <button className="btn btn-primary" style={{fontSize:12}} onClick={seleccionarTodos}>
                <CheckSquare size={13} /> Todos ({filtrados.length})
              </button>
              <button className="btn" style={{fontSize:12}} onClick={deseleccionarTodos}>
                <Square size={13} /> Ninguno
              </button>
              <button className="btn btn-ghost" style={{fontSize:12,color:'var(--gray-500)'}} onClick={cancelarSeleccion}>
                × Cancelar
              </button>
              {seleccionados.size > 0 && (
                <span style={{fontSize:12,color:'var(--green-600)',fontWeight:600,marginLeft:4}}>
                  {seleccionados.size} seleccionados
                </span>
              )}
            </>
          )}
        </div>

        {/* Acciones masivas — pill flotante al fondo, no desplaza el layout */}

        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
          <table className="historial-table">
            <thead>
              <tr>
                {seleccionando && <th style={{width:36}}></th>}
                <th>Nº albarán</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Astilladora</th>
                <th>Transportista</th>
                <th>Destino</th>
                <th>Especie</th>
                <th>Peso neto</th>
                <th>Humedad</th>
                <th>Estado</th>
                <th>Firmas</th>
                {esSuperadmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={(seleccionando ? 1 : 0) + 11 + (esSuperadmin ? 1 : 0)} className="empty-state">No hay albaranes con los filtros seleccionados</td></tr>
              ) : paginados.map(a => (
                <tr key={a.id} onClick={() => seleccionando ? toggleSeleccion(a.id) : navigate(`/albaran/${a.id}`)}
                  style={{cursor:'pointer', background: seleccionados.has(a.id) ? 'var(--green-50)' : undefined}}>
                  {seleccionando && (
                    <td style={{textAlign:'center',width:36}} onClick={e => { e.stopPropagation(); toggleSeleccion(a.id) }}>
                      <input type="checkbox" checked={seleccionados.has(a.id)} onChange={() => {}} style={{cursor:'pointer',pointerEvents:'none'}} />
                    </td>
                  )}
                  <td className="albaran-id">{a.id}</td>
                  <td>{a.fecha?.slice(0,10).split('-').reverse().join('/')}</td>
                  <td>{a.proveedor}</td>
                  <td>{a.astilladora}</td>
                  <td>{a.transportista}</td>
                  <td>{a.instalacion}</td>
                  <td>{a.especie}</td>
                  <td>{a.pesada.entrada && a.pesada.salida ? ((a.pesada.entrada-a.pesada.salida)/1000).toFixed(1)+' t' : <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                  <td>{a.pesada.humedad != null ? `${a.pesada.humedad}%` : <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                  <td><Badge estado={a.estado} /></td>
                  <td><FirmaSteps firmas={a.firmas} estado={a.estado} /></td>
                  {esSuperadmin && (
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--gray-300)',display:'flex',alignItems:'center'}}
                        onClick={() => setConfirmBorrarFila(a.id)}
                        title="Borrar albarán"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Paginación */}
        {totalPaginas > 1 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 4px',marginTop:8}}>
            <div style={{fontSize:12,color:'var(--gray-500)'}}>
              Mostrando {(pagina-1)*POR_PAGINA+1}–{Math.min(pagina*POR_PAGINA, filtrados.length)} de {filtrados.length}
            </div>
            <div style={{display:'flex',gap:4}}>
              <button className="btn" style={{fontSize:12,padding:'4px 10px'}} disabled={pagina===1} onClick={() => setPagina(1)}>«</button>
              <button className="btn" style={{fontSize:12,padding:'4px 10px'}} disabled={pagina===1} onClick={() => setPagina(p => p-1)}>‹</button>
              {Array.from({length:Math.min(5,totalPaginas)}, (_, i) => {
                const inicio = Math.max(1, Math.min(pagina-2, totalPaginas-4))
                const p = inicio + i
                if (p > totalPaginas) return null
                return (
                  <button key={p} className={`btn${p===pagina?' btn-primary':''}`} style={{fontSize:12,padding:'4px 10px'}} onClick={() => setPagina(p)}>
                    {p}
                  </button>
                )
              })}
              <button className="btn" style={{fontSize:12,padding:'4px 10px'}} disabled={pagina===totalPaginas} onClick={() => setPagina(p => p+1)}>›</button>
              <button className="btn" style={{fontSize:12,padding:'4px 10px'}} disabled={pagina===totalPaginas} onClick={() => setPagina(totalPaginas)}>»</button>
            </div>
          </div>
        )}
      </div>

      {/* Pill flotante de acciones masivas — posición fija, no afecta al layout */}
      {seleccionados.size > 0 && (
        <div style={{position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:6,padding:'10px 16px',background:'var(--gray-900)',borderRadius:999,boxShadow:'0 8px 32px rgba(0,0,0,0.28)',zIndex:200,whiteSpace:'nowrap'}}>
          <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.75)',marginRight:6}}>{seleccionados.size} seleccionados</span>
          <button onClick={() => setModalAdjuntar(true)}
            style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:20,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.1)',color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer'}}>
            <Upload size={13}/> Adjuntar doc
          </button>
          <button onClick={handleDescargarPDFs} disabled={descargando}
            style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:20,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.1)',color:'#fff',fontSize:12,fontWeight:500,cursor:'pointer',opacity:descargando?0.6:1}}>
            <Download size={13}/> {descargando ? 'Descargando...' : 'PDFs'}
          </button>
          {esSuperadmin && (
            <button onClick={() => setConfirmEliminar(true)}
              style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:20,border:'1px solid rgba(231,75,74,0.4)',background:'rgba(231,75,74,0.15)',color:'#ff8080',fontSize:12,fontWeight:500,cursor:'pointer'}}>
              <Trash2 size={13}/> Eliminar
            </button>
          )}
          <button onClick={cancelarSeleccion}
            style={{display:'inline-flex',alignItems:'center',gap:4,padding:'6px 10px',borderRadius:20,border:'1px solid rgba(255,255,255,0.15)',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer',marginLeft:4}}>
            × Cancelar
          </button>
        </div>
      )}

      {/* Modal adjuntar documento */}
      {modalAdjuntar && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:16}}>Adjuntar documento a {seleccionados.size} albaranes</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6}}>Tipo de documento</label>
              <select value={docTipo} onChange={e => setDocTipo(e.target.value)} style={{width:'100%'}}>
                <option value="">Selecciona tipo...</option>
                {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:12,fontWeight:600,color:'var(--gray-600)',display:'block',marginBottom:6}}>Fichero</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDocFichero(e.target.files[0])} />
              {docFichero && <div style={{fontSize:11,color:'var(--gray-500)',marginTop:4}}>{docFichero.name}</div>}
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => { setModalAdjuntar(false); setDocTipo(''); setDocFichero(null) }}>Cancelar</button>
              <button className="btn btn-primary" disabled={!docTipo || !docFichero || adjuntando} onClick={handleAdjuntarDoc}>
                {adjuntando ? 'Adjuntando...' : `Adjuntar a ${seleccionados.size} albaranes`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal borrar fila individual */}
      {confirmBorrarFila && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <Trash2 size={20} color='var(--red-400)' />
              <span style={{fontSize:16,fontWeight:600}}>Borrar albarán</span>
            </div>
            <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:20}}>
              ¿Seguro que quieres borrar el albarán <strong>{confirmBorrarFila}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setConfirmBorrarFila(null)}>Cancelar</button>
              <button
                className="btn"
                style={{background:'var(--red-400)',color:'#fff',borderColor:'var(--red-400)'}}
                onClick={async () => {
                  if (borrarAlbaran) await borrarAlbaran(confirmBorrarFila)
                  setConfirmBorrarFila(null)
                }}
              >
                <Trash2 size={14} /> Borrar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmEliminar && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <Trash2 size={20} color="var(--red-400)" />
              <span style={{fontSize:16,fontWeight:600}}>Eliminar {seleccionados.size} albaranes</span>
            </div>
            <p style={{fontSize:13,color:'var(--gray-600)',marginBottom:20}}>Esta acción no se puede deshacer.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={() => setConfirmEliminar(false)}>Cancelar</button>
              <button className="btn" style={{background:'var(--red-400)',color:'#fff',borderColor:'var(--red-400)'}} disabled={eliminando} onClick={handleEliminar}>
                {eliminando ? 'Eliminando...' : 'Eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

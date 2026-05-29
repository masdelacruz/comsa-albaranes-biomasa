import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Trash2, Search, Filter } from 'lucide-react'
import { Badge, FirmaSteps } from '../components/Badge'
import { labelSemanaActual, isoWeek, isoWeekYear } from '../utils/semana'
import '../components/shared.css'
import './Dashboard.css'

export default function Dashboard({ albaranes, empresas = [], usuario, borrarAlbaran }) {
  const navigate = useNavigate()
  const esSuperadmin = usuario?.nivel === 'superadmin'

  const [busqueda,           setBusqueda]           = useState('')
  const [filtroInstalacion,  setFiltroInstalacion]  = useState('')
  const [filtroAstilladora,  setFiltroAstilladora]  = useState('')
  const [filtroProveedor,    setFiltroProveedor]    = useState('')
  const [filtroTransportista,setFiltroTransportista]= useState('')
  const [filtroEstado,       setFiltroEstado]       = useState('')
  const [filtroFechaDesde,   setFiltroFechaDesde]   = useState('')
  const [filtroFechaHasta,   setFiltroFechaHasta]   = useState('')
  const [soloActivos,        setSoloActivos]        = useState('activos')
  const [confirmBorrar,      setConfirmBorrar]      = useState(null)
  const [pagina,             setPagina]             = useState(1)
  const POR_PAGINA = 25

  const hoy = new Date()
  const semanaActual = isoWeek(hoy)
  const anioActual   = isoWeekYear(hoy)
  const albaranesSemana = albaranes.filter(a => {
    if (!a.fecha) return false
    const d = new Date(a.fecha)
    return isoWeek(d) === semanaActual && isoWeekYear(d) === anioActual
  })

  const totalActivos   = albaranes.filter(a => a.estado !== 'cerrado').length
  const pendienteFirma = albaranes.filter(a => a.estado === 'pendiente_campo' || a.estado === 'pendiente_oficina').length
  const cerrados       = albaranes.filter(a => a.estado === 'cerrado').length
  const conIncidencia  = albaranes.filter(a => a.estado === 'humedad_pendiente').length
  const alertas        = albaranes.filter(a => a.estado === 'humedad_pendiente')

  const empresasByTipo = (tipo) => empresas.filter(e => e.tipo === tipo).map(e => e.nombre)
  const instalaciones   = [...new Set([...empresasByTipo('instalacion'),   ...albaranes.map(a => a.instalacion)  ].filter(Boolean))].sort()
  const astilladoras    = [...new Set([...empresasByTipo('astilladora'),   ...albaranes.map(a => a.astilladora)  ].filter(Boolean))].sort()
  const proveedores     = [...new Set([...empresasByTipo('proveedor'),     ...albaranes.map(a => a.proveedor)    ].filter(Boolean))].sort()
  const transportistas  = [...new Set([...empresasByTipo('transportista'), ...albaranes.map(a => a.transportista)].filter(Boolean))].sort()

  const filtrados = useMemo(() => albaranes.filter(a => {
    if (soloActivos === 'activos'  && a.estado === 'cerrado')  return false
    if (soloActivos === 'cerrados' && a.estado !== 'cerrado')  return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const hay = [a.id, a.proveedor, a.astilladora, a.transportista, a.instalacion, a.especie, a.origen, a.permiso]
        .join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filtroInstalacion   && a.instalacion   !== filtroInstalacion)   return false
    if (filtroAstilladora   && a.astilladora   !== filtroAstilladora)   return false
    if (filtroProveedor     && a.proveedor     !== filtroProveedor)     return false
    if (filtroTransportista && a.transportista !== filtroTransportista) return false
    if (filtroEstado        && a.estado        !== filtroEstado)        return false
    if (filtroFechaDesde    && a.fecha         <  filtroFechaDesde)     return false
    if (filtroFechaHasta    && a.fecha         >  filtroFechaHasta)     return false
    return true
  }), [albaranes, soloActivos, busqueda, filtroInstalacion, filtroAstilladora, filtroProveedor, filtroTransportista, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  useEffect(() => { setPagina(1) }, [soloActivos, busqueda, filtroInstalacion, filtroAstilladora, filtroProveedor, filtroTransportista, filtroEstado, filtroFechaDesde, filtroFechaHasta])

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const paginados    = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const hayFiltros = busqueda || filtroInstalacion || filtroAstilladora || filtroProveedor || filtroTransportista || filtroEstado || filtroFechaDesde || filtroFechaHasta
  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroInstalacion(''); setFiltroAstilladora('')
    setFiltroProveedor(''); setFiltroTransportista('')
    setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta('')
  }

  return (
    <>
    <div className="dashboard">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-sub">{labelSemanaActual()}</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/nuevo')}>
            <Plus size={15} /> Nuevo albarán
          </button>
        </div>
      </div>

      <div className="dash-content">
        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-label">Albaranes esta semana</div><div className="kpi-val">{albaranesSemana.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Pendientes de firma</div><div className="kpi-val amber">{pendienteFirma}</div></div>
          <div className="kpi-card"><div className="kpi-label">Cerrados</div><div className="kpi-val green">{cerrados}</div></div>
          <div className="kpi-card"><div className="kpi-label">Con incidencia</div><div className="kpi-val red">{conIncidencia}</div></div>
        </div>

        {/* Alertas humedad */}
        {alertas.map(a => (
          <div key={a.id} className="alerta-bar" onClick={() => navigate(`/albaran/${a.id}`)}>
            <AlertTriangle size={14} />
            <span><strong>{a.id}</strong> · {a.instalacion} · Humedad pendiente de análisis</span>
            <span className="alerta-link">Ver →</span>
          </div>
        ))}

        {/* Cabecera tabla */}
        <div className="table-header">
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div className="section-label" style={{margin:0}}>
              {{ activos:'Albaranes activos', cerrados:'Albaranes cerrados', todos:'Todos los albaranes' }[soloActivos]}
            </div>
            <div style={{display:'flex',gap:2,background:'var(--gray-100)',borderRadius:6,padding:2}}>
              {[
                { label:`Activos · ${totalActivos}`,      val:'activos'  },
                { label:`Cerrados · ${cerrados}`,         val:'cerrados' },
                { label:`Todos · ${albaranes.length}`,    val:'todos'    },
              ].map(({ label, val }) => (
                <button key={val}
                  onClick={() => { setSoloActivos(val); if (val === 'activos') setFiltroEstado('') }}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:4,border:'none',cursor:'pointer',
                    background: soloActivos === val ? '#fff' : 'transparent',
                    color: soloActivos === val ? 'var(--gray-800)' : 'var(--gray-400)',
                    fontWeight: soloActivos === val ? 600 : 400,
                    boxShadow: soloActivos === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition:'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filtros-bar">
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <Search size={12} style={{position:'absolute',left:7,color:'var(--gray-400)',pointerEvents:'none'}} />
            <input type="text" placeholder="Buscar ID, empresa, especie..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{paddingLeft:24,fontSize:12}}
            />
          </div>
          <Filter size={13} color="var(--gray-400)" />
          <select value={filtroProveedor} onChange={e => setFiltroProveedor(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={filtroAstilladora} onChange={e => setFiltroAstilladora(e.target.value)}>
            <option value="">Todas las astilladoras</option>
            {astilladoras.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={filtroTransportista} onChange={e => setFiltroTransportista(e.target.value)}>
            <option value="">Todos los transportistas</option>
            {transportistas.map(t => <option key={t}>{t}</option>)}
          </select>
          <select value={filtroInstalacion} onChange={e => setFiltroInstalacion(e.target.value)}>
            <option value="">Todas las instalaciones</option>
            {instalaciones.map(i => <option key={i}>{i}</option>)}
          </select>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente_campo">Pendiente campo</option>
            <option value="pendiente_oficina">Pendiente oficina</option>
            <option value="humedad_pendiente">Humedad pendiente</option>
            {soloActivos === 'todos' && <option value="cerrado">Cerrado</option>}
          </select>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:11,color:'var(--gray-400)',whiteSpace:'nowrap'}}>Desde</span>
            <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:11,color:'var(--gray-400)',whiteSpace:'nowrap'}}>Hasta</span>
            <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
          </div>
          {hayFiltros && (
            <button className="btn btn-ghost" onClick={limpiarFiltros} style={{fontSize:11}}>× Limpiar</button>
          )}
        </div>

        {/* Tabla */}
        <div className="card" style={{padding:0,overflow:'clip'}}>
          <div className="table-wrap">
            <table className="albaran-table">
              <thead>
                <tr>
                  <th>Nº albarán</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Astilladora</th>
                  <th>Transportista</th>
                  <th>Instalación</th>
                  <th>Especie</th>
                  <th>Peso neto</th>
                  <th>Humedad</th>
                  <th>Estado</th>
                  <th>Firmas</th>
                  {esSuperadmin && <th style={{width:36,padding:'11px 4px'}}></th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={11 + (esSuperadmin ? 1 : 0)} className="empty-state">No hay albaranes con los filtros seleccionados</td></tr>
                ) : paginados.map(a => (
                  <tr key={a.id} onClick={() => navigate(`/albaran/${a.id}`)}>
                    <td className="albaran-id">{a.id}</td>
                    <td>{a.fecha?.slice(0,10).split('-').reverse().join('/')}</td>
                    <td>{a.proveedor}</td>
                    <td>{a.astilladora}</td>
                    <td>{a.transportista}</td>
                    <td>{a.instalacion}</td>
                    <td>{a.especie}</td>
                    <td>{a.pesada?.entrada && a.pesada?.salida ? ((a.pesada.entrada-a.pesada.salida)/1000).toFixed(1)+' t' : <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                    <td>{a.pesada?.humedad != null ? `${a.pesada.humedad}%` : <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                    <td><Badge estado={a.estado} /></td>
                    <td><FirmaSteps firmas={a.firmas} estado={a.estado} /></td>
                    {esSuperadmin && (
                      <td style={{width:36,padding:'4px',textAlign:'center'}} onClick={e => e.stopPropagation()}>
                        <button
                          style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--gray-300)',display:'inline-flex',alignItems:'center'}}
                          onClick={() => setConfirmBorrar(a.id)}
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
              {Array.from({length:Math.min(5,totalPaginas)}, (_,i) => {
                const inicio = Math.max(1, Math.min(pagina-2, totalPaginas-4))
                const p = inicio + i
                if (p > totalPaginas) return null
                return (
                  <button key={p} className={`btn${p===pagina?' btn-primary':''}`} style={{fontSize:12,padding:'4px 10px'}} onClick={() => setPagina(p)}>{p}</button>
                )
              })}
              <button className="btn" style={{fontSize:12,padding:'4px 10px'}} disabled={pagina===totalPaginas} onClick={() => setPagina(p => p+1)}>›</button>
              <button className="btn" style={{fontSize:12,padding:'4px 10px'}} disabled={pagina===totalPaginas} onClick={() => setPagina(totalPaginas)}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Modal borrar */}
    {confirmBorrar && (
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}>
        <div style={{background:'#fff',borderRadius:'var(--radius-xl)',padding:28,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
            <Trash2 size={20} color='var(--red-400)' />
            <span style={{fontSize:16,fontWeight:600}}>Borrar albarán</span>
          </div>
          <p style={{fontSize:14,color:'var(--gray-600)',marginBottom:20}}>
            ¿Seguro que quieres borrar el albarán <strong>{confirmBorrar}</strong>? Esta acción no se puede deshacer.
          </p>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button className="btn" onClick={() => setConfirmBorrar(null)}>Cancelar</button>
            <button className="btn" style={{background:'var(--red-400)',color:'#fff',borderColor:'var(--red-400)'}}
              onClick={async () => { await borrarAlbaran(confirmBorrar); setConfirmBorrar(null) }}>
              <Trash2 size={14} /> Borrar definitivamente
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

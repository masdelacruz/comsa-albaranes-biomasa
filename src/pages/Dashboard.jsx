import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Trash2, Search, Filter, Package, CalendarClock, PenLine, CheckCircle2, Calendar, ChevronRight } from 'lucide-react'
import { Badge, FirmaSteps } from '../components/Badge'
import { labelSemanaActual, isoWeek, isoWeekYear, lunesDeSemana } from '../utils/semana'
import '../components/shared.css'
import './Dashboard.css'

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
  const [porPagina,          setPorPagina]          = useState(25)

  const hoy = new Date()
  const semanaActual = isoWeek(hoy)
  const anioActual   = isoWeekYear(hoy)
  const albaranesSemana = albaranes.filter(a => {
    if (!a.fecha) return false
    const d = new Date(a.fecha)
    return isoWeek(d) === semanaActual && isoWeekYear(d) === anioActual
  })

  const ESTADOS_TERMINAL  = ['cerrado', 'cancelado']
  const ESTADOS_RECHAZADO = ['rechazado_campo_astilladora', 'rechazado_campo_instalacion', 'cancelado']
  const totalActivos   = albaranes.filter(a => !ESTADOS_TERMINAL.includes(a.estado) && !ESTADOS_RECHAZADO.includes(a.estado)).length
  const totalRechazados = albaranes.filter(a => ESTADOS_RECHAZADO.includes(a.estado)).length
  const programados    = albaranes.filter(a => a.estado === 'programado').length
  const albaranesPendientesFirma = albaranes.filter(a => a.estado === 'pendiente_campo' || a.estado === 'pendiente_oficina')
  const cerrados       = albaranes.filter(a => a.estado === 'cerrado').length
  const conIncidencia  = albaranes.filter(a => a.estado === 'humedad_pendiente').length
  const alertas        = albaranes.filter(a => a.estado === 'humedad_pendiente')

  // Actividad de la semana: nº de albaranes por día, lunes a domingo
  const lunes = lunesDeSemana(hoy)
  const diasActividad = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fechaLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    return {
      clave,
      dia: DIAS_CORTOS[i],
      fechaLabel,
      count: albaranes.filter(a => a.fecha?.slice(0, 10) === clave).length,
    }
  })
  const maxActividad = Math.max(3, ...diasActividad.map(d => d.count))

  const empresasByTipo = (tipo) => empresas.filter(e => e.tipo === tipo).map(e => e.nombre)
  const instalaciones   = [...new Set([...empresasByTipo('instalacion'),   ...albaranes.map(a => a.instalacion)  ].filter(Boolean))].sort()
  const astilladoras    = [...new Set([...empresasByTipo('astilladora'),   ...albaranes.map(a => a.astilladora)  ].filter(Boolean))].sort()
  const proveedores     = [...new Set([...empresasByTipo('proveedor'),     ...albaranes.map(a => a.proveedor)    ].filter(Boolean))].sort()
  const transportistas  = [...new Set([...empresasByTipo('transportista'), ...albaranes.map(a => a.transportista)].filter(Boolean))].sort()

  const filtrados = useMemo(() => albaranes.filter(a => {
    if (soloActivos === 'activos'    && (ESTADOS_TERMINAL.includes(a.estado) || ESTADOS_RECHAZADO.includes(a.estado))) return false
    if (soloActivos === 'cerrados'   && a.estado !== 'cerrado')                return false
    if (soloActivos === 'rechazados' && !ESTADOS_RECHAZADO.includes(a.estado)) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const hay = [a.id, a.proveedor, a.astilladora, a.transportista, a.instalacion, a.especie, a.estella, a.origen, a.permiso]
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPagina(1) }, [soloActivos, busqueda, filtroInstalacion, filtroAstilladora, filtroProveedor, filtroTransportista, filtroEstado, filtroFechaDesde, filtroFechaHasta, porPagina])

  const totalPaginas = Math.ceil(filtrados.length / porPagina)
  const paginados    = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina)

  const hayFiltros = busqueda || filtroInstalacion || filtroAstilladora || filtroProveedor || filtroTransportista || filtroEstado || filtroFechaDesde || filtroFechaHasta
  const TAB_ADJETIVO = { activos: 'activos', cerrados: 'cerrados', rechazados: 'rechazados' }
  const mensajeVacio = hayFiltros
    ? 'No hay albaranes con los filtros seleccionados'
    : TAB_ADJETIVO[soloActivos]
      ? `No hay albaranes ${TAB_ADJETIVO[soloActivos]} actualmente`
      : 'No hay albaranes actualmente'
  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroInstalacion(''); setFiltroAstilladora('')
    setFiltroProveedor(''); setFiltroTransportista('')
    setFiltroEstado(''); setFiltroFechaDesde(''); setFiltroFechaHasta('')
  }

  const kpis = [
    { key: 'semana',   label: 'Albaranes esta semana', value: albaranesSemana.length, icon: Package,       tone: 'green' },
    { key: 'prog',     label: 'Programados',           value: programados,            icon: CalendarClock, tone: 'blue', onClick: programados > 0 ? () => setFiltroEstado('programado') : undefined },
    { key: 'firma',    label: 'Pendientes de firma',   value: albaranesPendientesFirma.length, icon: PenLine, tone: 'amber' },
    { key: 'cerrados', label: 'Cerrados',              value: cerrados,               icon: CheckCircle2,  tone: 'green' },
    { key: 'inc',      label: 'Con incidencia',        value: conIncidencia,          icon: AlertTriangle, tone: 'red' },
  ]

  const TABS = [
    { label: 'Activos',    count: totalActivos,    val: 'activos'    },
    { label: 'Cerrados',   count: cerrados,         val: 'cerrados'   },
    { label: 'Rechazados', count: totalRechazados,  val: 'rechazados' },
    { label: 'Todos',      count: albaranes.length, val: 'todos'      },
  ]

  return (
    <>
    <div className="dashboard">
      <div className="page-header">
        <div className="dash-header-row">
          <div>
            <div className="page-title">Dashboard</div>
            <div className="page-sub">{labelSemanaActual()}</div>
          </div>
          <button className="btn btn-primary dash-cta" onClick={() => navigate('/nuevo')}>
            <Plus size={16} /> Nuevo albarán
          </button>
        </div>
      </div>

      <div className="dash-content">
        {/* KPIs */}
        <div className="stat-grid">
          {kpis.map(k => {
            const Icon = k.icon
            return (
              <div key={k.key} className={`stat-card stat-${k.tone}${k.onClick ? ' stat-clickable' : ''}`} onClick={k.onClick}>
                <div className="stat-top">
                  <span className="stat-label">{k.label}</span>
                  <span className="stat-icon"><Icon size={15} /></span>
                </div>
                <div className="stat-val">{k.value}</div>
              </div>
            )
          })}
        </div>

        {/* Alertas humedad */}
        {alertas.map(a => (
          <div key={a.id} className="alerta-bar" onClick={() => navigate(`/albaran/${a.id}`)}>
            <AlertTriangle size={14} />
            <span><strong>{a.id}</strong> · {a.instalacion} · Humedad pendiente de análisis</span>
            <span className="alerta-link">Ver →</span>
          </div>
        ))}

        {/* Actividad de la semana + Requieren atención */}
        <div className="dash-insights">
          <div className="dash-activity-card">
            <div className="dash-activity-head">
              <div>
                <div className="dash-activity-title">Actividad de la semana</div>
                <div className="dash-activity-sub">Albaranes creados por día</div>
              </div>
              <div className="dash-activity-select">
                <Calendar size={13} /> Esta semana
              </div>
            </div>

            <div className="dash-act-plot">
              {[maxActividad, Math.round(maxActividad * 2 / 3), Math.round(maxActividad / 3), 0].map((v, i) => (
                <div key={i} className="dash-act-gridline" style={{ bottom: `${(v / maxActividad) * 100}%` }}>
                  <span className="dash-act-gridline-label">{v}</span>
                </div>
              ))}
              <div className="dash-act-bars">
                {diasActividad.map(d => (
                  <div key={d.clave} className="dash-act-col">
                    {d.count > 0 && <div className="dash-act-val">{d.count}</div>}
                    <div className={`dash-act-bar${d.count === 0 ? ' vacio' : ''}`} style={{ height: `${(d.count / maxActividad) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="dash-act-daylabels">
              {diasActividad.map(d => (
                <div key={d.clave} className="dash-act-daylabel">{d.dia} {d.fechaLabel}</div>
              ))}
            </div>
          </div>

          <div className="dash-atencion-card">
            <div className="dash-atencion-head">
              <div>
                <div className="dash-atencion-title-row">
                  <span className="dash-atencion-title">Requieren atención</span>
                  {albaranesPendientesFirma.length > 0 && <span className="dash-atencion-count">{albaranesPendientesFirma.length}</span>}
                </div>
                <div className="dash-atencion-sub">Pendientes de firma</div>
              </div>
            </div>

            {albaranesPendientesFirma.length === 0 ? (
              <div className="dash-atencion-empty">
                <CheckCircle2 size={22} color="var(--green-400)" />
                <span>Todo al día</span>
              </div>
            ) : (
              <div className="dash-atencion-list">
                {albaranesPendientesFirma.slice(0, 3).map(a => (
                  <div key={a.id} className="dash-atencion-item" onClick={() => navigate(`/albaran/${a.id}`)}>
                    <div>
                      <div className="dash-atencion-item-id">{a.id}</div>
                      <div className="dash-atencion-item-empresa">{a.proveedor || a.instalacion}</div>
                      <div className="dash-atencion-item-motivo"><PenLine size={11} /> Pendiente de firma</div>
                    </div>
                    <div className="dash-atencion-item-right">
                      <Badge estado={a.estado} />
                      <button className="btn dash-atencion-ver" onClick={e => { e.stopPropagation(); navigate(`/albaran/${a.id}`) }}>
                        Ver albarán <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {albaranesPendientesFirma.length > 0 && (
              <button className="dash-atencion-vertodos" onClick={() => document.querySelector('.dash-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Ver todos los pendientes <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Bloque principal: título + tabs + filtros + tabla, unificados */}
        <div className="dash-main">
          <div className="dash-main-head">
            <div className="dash-main-title">
              {{ activos:'Albaranes activos', cerrados:'Albaranes cerrados', rechazados:'Rechazados y anulados', todos:'Todos los albaranes' }[soloActivos]}
            </div>
            <div className="dash-tabs">
              {TABS.map(({ label, count, val }) => (
                <button key={val}
                  className={`dash-tab${soloActivos === val ? ' active' : ''}`}
                  onClick={() => { setSoloActivos(val); if (val === 'activos') setFiltroEstado('') }}
                >
                  {label} <span className="dash-tab-count">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filtros */}
          <div className="filters-bar dash-filtros-wrap">
            <div className="search-field">
              <Search size={14} className="search-field-icon" />
              <input type="text" className="search-field-input" placeholder="Buscar ID, empresa, especie..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
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
              <option value="programado">Programado</option>
              <option value="pendiente_campo">Pendiente campo</option>
              <option value="pendiente_oficina">Pendiente oficina</option>
              <option value="humedad_pendiente">Humedad pendiente</option>
              <option value="rechazado_campo_astilladora">No gestionado · Astilladora</option>
              <option value="rechazado_campo_instalacion">No gestionado · Instalación</option>
              <option value="cancelado">Anulado</option>
              {soloActivos === 'todos' && <option value="cerrado">Cerrado</option>}
            </select>
            <div className="date-range">
              <div className="date-range-field">
                <span>Desde</span>
                <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} />
              </div>
              <div className="date-range-sep" />
              <div className="date-range-field">
                <span>Hasta</span>
                <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} />
              </div>
            </div>
            {hayFiltros && (
              <button className="btn btn-ghost" onClick={limpiarFiltros} style={{fontSize:11}}>× Limpiar</button>
            )}
          </div>

          {/* Tabla */}
          <div className="table-wrap">
            <table className="data-table albaran-table">
              <thead>
                <tr>
                  <th>Nº albarán</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Astilladora</th>
                  <th>Transportista</th>
                  <th>Instalación</th>
                  <th>Especie</th>
                  <th>Estella</th>
                  <th>Peso neto</th>
                  <th>Humedad</th>
                  <th>Estado</th>
                  <th>Firmas</th>
                  {esSuperadmin && <th style={{width:36,padding:'11px 4px'}}></th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr><td colSpan={11 + (esSuperadmin ? 1 : 0)} className="empty-state">{mensajeVacio}</td></tr>
                ) : paginados.map(a => (
                  <tr key={a.id} onClick={() => navigate(`/albaran/${a.id}`)}>
                    <td className="row-id">{a.id}</td>
                    <td>{a.fecha?.slice(0,10).split('-').reverse().join('/')}</td>
                    <td>{a.proveedor}</td>
                    <td>{a.astilladora}</td>
                    <td>{a.transportista}</td>
                    <td>{a.instalacion}</td>
                    <td>{a.especie}</td>
                    <td>{a.estella}</td>
                    <td>{a.pesada?.entrada && a.pesada?.salida ? ((a.pesada.entrada-a.pesada.salida)/1000).toFixed(1)+' t' : <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                    <td>{a.pesada?.humedad != null ? `${a.pesada.humedad}%` : <span style={{color:'var(--gray-300)'}}>—</span>}</td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <Badge estado={a.estado} />
                      {a.solicitaRevision && <span title="Solicitud de revisión desde campo" style={{marginLeft:6,color:'#d97706',fontSize:13,verticalAlign:'middle'}}>⚠</span>}
                    </td>
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

          {/* Paginación — pie de la misma tarjeta, no un bloque aparte */}
          {filtrados.length > 0 && (
            <div className="list-pagination">
              <div className="list-pagination-info">
                {(() => {
                  const desde = (pagina-1)*porPagina+1
                  const hasta = Math.min(pagina*porPagina, filtrados.length)
                  const plural = filtrados.length !== 1 ? 'es' : ''
                  return desde === hasta
                    ? `Mostrando ${desde} de ${filtrados.length} albarán${plural}`
                    : `Mostrando ${desde}–${hasta} de ${filtrados.length} albaranes`
                })()}
              </div>
              <div className="list-pagination-pages">
                <div className="dash-page-size">
                  <span>Filas por página:</span>
                  <select value={porPagina} onChange={e => setPorPagina(Number(e.target.value))}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <button className="btn" disabled={pagina===1} onClick={() => setPagina(1)}>«</button>
                <button className="btn" disabled={pagina===1} onClick={() => setPagina(p => p-1)}>‹</button>
                {Array.from({length:Math.min(5,totalPaginas)}, (_,i) => {
                  const inicio = Math.max(1, Math.min(pagina-2, totalPaginas-4))
                  const p = inicio + i
                  if (p > totalPaginas) return null
                  return (
                    <button key={p} className={`btn${p===pagina?' btn-primary':''}`} onClick={() => setPagina(p)}>{p}</button>
                  )
                })}
                <button className="btn" disabled={pagina===totalPaginas} onClick={() => setPagina(p => p+1)}>›</button>
                <button className="btn" disabled={pagina===totalPaginas} onClick={() => setPagina(totalPaginas)}>»</button>
              </div>
            </div>
          )}
        </div>
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

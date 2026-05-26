import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Filter, Trash2, Search } from 'lucide-react'
import { Badge, FirmaSteps } from '../components/Badge'
import { labelSemanaActual, isoWeek, isoWeekYear } from '../utils/semana'
import '../components/shared.css'
import './Dashboard.css'

export default function Dashboard({ albaranes, usuario, borrarAlbaran }) {
  const navigate = useNavigate()
  const [busqueda,          setBusqueda]          = useState('')
  const [filtroInstalacion, setFiltroInstalacion] = useState('')
  const [filtroEstado,      setFiltroEstado]      = useState('')
  const [soloActivos,       setSoloActivos]       = useState(true)
  const [confirmBorrar,     setConfirmBorrar]     = useState(null)
  const [pagina, setPagina] = useState(1)
  const POR_PAGINA = 25
  const esSuperadmin = usuario?.nivel === 'superadmin'

  const hoy = new Date()
  const semanaActual = isoWeek(hoy)
  const anioActual   = isoWeekYear(hoy)
  const albaranesSemana = albaranes.filter(a => {
    if (!a.fecha) return false
    const d = new Date(a.fecha)
    return isoWeek(d) === semanaActual && isoWeekYear(d) === anioActual
  })

  const instalaciones  = [...new Set(albaranes.map(a => a.instalacion).filter(Boolean))]
  const totalActivos   = albaranes.filter(a => a.estado !== 'cerrado').length
  const pendienteFirma = albaranes.filter(a => a.estado !== 'cerrado').length
  const cerrados       = albaranes.filter(a => a.estado === 'cerrado').length
  const conIncidencia  = albaranes.filter(a => a.estado === 'humedad_pendiente').length
  const alertas        = albaranes.filter(a => a.estado === 'humedad_pendiente')

  const filtrados = albaranes.filter(a => {
    if (soloActivos && a.estado === 'cerrado') return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const hay = [a.id, a.proveedor, a.astilladora, a.transportista, a.instalacion, a.especie, a.origen]
        .join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filtroInstalacion && a.instalacion !== filtroInstalacion) return false
    if (filtroEstado && a.estado !== filtroEstado) return false
    return true
  })

  const hayFiltros = busqueda || filtroInstalacion || filtroEstado
  const limpiarFiltros = () => { setBusqueda(''); setFiltroInstalacion(''); setFiltroEstado('') }

  useEffect(() => { setPagina(1) }, [filtroInstalacion, filtroEstado, busqueda, soloActivos])

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const paginados    = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

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
        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-label">Albaranes esta semana</div><div className="kpi-val">{albaranesSemana.length}</div></div>
          <div className="kpi-card"><div className="kpi-label">Pendientes de firma</div><div className="kpi-val amber">{pendienteFirma}</div></div>
          <div className="kpi-card"><div className="kpi-label">Cerrados</div><div className="kpi-val green">{cerrados}</div></div>
          <div className="kpi-card"><div className="kpi-label">Con incidencia</div><div className="kpi-val red">{conIncidencia}</div></div>
        </div>

        {alertas.map(a => (
          <div key={a.id} className="alerta-bar" onClick={() => navigate(`/albaran/${a.id}`)}>
            <AlertTriangle size={14} />
            <span><strong>{a.id}</strong> · {a.instalacion} · Humedad pendiente de análisis</span>
            <span className="alerta-link">Ver →</span>
          </div>
        ))}

        <div className="table-header">
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <div className="section-label" style={{margin:0}}>
              {soloActivos ? 'Albaranes activos' : 'Todos los albaranes'}
            </div>
            {/* Toggle activos / todos */}
            <div style={{display:'flex',gap:2,background:'var(--gray-100)',borderRadius:6,padding:2}}>
              {[
                { label: `Activos · ${totalActivos}`, val: true  },
                { label: `Todos · ${albaranes.length}`, val: false },
              ].map(({ label, val }) => (
                <button key={String(val)}
                  onClick={() => { setSoloActivos(val); if (val) setFiltroEstado('') }}
                  style={{fontSize:11,padding:'3px 10px',borderRadius:4,border:'none',cursor:'pointer',
                    background: soloActivos === val ? '#fff' : 'transparent',
                    color: soloActivos === val ? 'var(--gray-800)' : 'var(--gray-400)',
                    fontWeight: soloActivos === val ? 600 : 400,
                    boxShadow: soloActivos === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            {/* Búsqueda */}
            <div style={{position:'relative',display:'flex',alignItems:'center'}}>
              <Search size={12} style={{position:'absolute',left:7,color:'var(--gray-400)',pointerEvents:'none'}} />
              <input
                type="text" placeholder="Buscar ID, empresa, especie..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{paddingLeft:24,fontSize:12,padding:'5px 8px 5px 24px',width:190}}
              />
            </div>
            <Filter size={13} color="var(--gray-400)" />
            <select value={filtroInstalacion} onChange={e => setFiltroInstalacion(e.target.value)} style={{width:'auto',fontSize:12,padding:'5px 8px'}}>
              <option value="">Todas las instalaciones</option>
              {instalaciones.map(i => <option key={i}>{i}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{width:'auto',fontSize:12,padding:'5px 8px'}}>
              <option value="">Todos los estados</option>
              <option value="pendiente_campo">Pendiente campo</option>
              <option value="pendiente_oficina">Pendiente oficina</option>
              <option value="humedad_pendiente">Humedad pendiente</option>
              {!soloActivos && <option value="cerrado">Cerrado</option>}
            </select>
            {hayFiltros && (
              <button className="btn btn-ghost" onClick={limpiarFiltros} style={{fontSize:11}}>× Limpiar</button>
            )}
          </div>
        </div>

        <div className="card" style={{padding:0, overflow:'clip'}}>
          <div className="table-wrap">
          <table className="albaran-table">
            <thead>
              <tr>
                <th>Nº albarán</th><th>Fecha</th><th>Proveedor</th><th>Astilladora</th><th>Transportista</th>
                <th>Instalación</th><th>Especie</th><th>Estado</th><th>Firmas</th>
                {esSuperadmin && <th style={{width:36,padding:'11px 4px'}}></th>}
              </tr>
            </thead>
            <tbody>
              {paginados.map(a => (
                <tr key={a.id} onClick={() => navigate(`/albaran/${a.id}`)}>
                  <td className="albaran-id">{a.id}</td>
                  <td>{a.fecha?.slice(0,10).split('-').reverse().join('/')}</td>
                  <td>{a.proveedor}</td>
                  <td>{a.astilladora}</td>
                  <td>{a.transportista}</td>
                  <td>{a.instalacion}</td>
                  <td>{a.especie}</td>
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
            <button
              className="btn"
              style={{background:'var(--red-400)',color:'#fff',borderColor:'var(--red-400)'}}
              onClick={async () => { await borrarAlbaran(confirmBorrar); setConfirmBorrar(null) }}
            >
              <Trash2 size={14} /> Borrar definitivamente
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
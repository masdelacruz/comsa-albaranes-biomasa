import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'

const ACCION_LABEL = {
  crear:          'Creado',
  editar:         'Editado',
  borrar:         'Eliminado',
  reabrir:        'Reabierto',
  anular:         'Anulado',
  editar_cerrado: 'Editado (cerrado)',
}
const ACCION_BADGE = {
  crear:          'badge-green',
  editar:         'badge-blue',
  borrar:         'badge-red',
  reabrir:        'badge-amber',
  anular:         'badge-orange',
  editar_cerrado: 'badge-purple',
}
const ENTIDAD_LABEL = {
  albaran:       'Albarán',
  usuario:       'Usuario',
  proveedor:     'Proveedor',
  elemento:      'Elemento',
  logo:          'Logo',
  firma_empresa: 'Firma de empresa',
}

const POR_PAGINA = 50

export default function Auditoria() {
  const [registros, setRegistros] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [hayMas,    setHayMas]    = useState(true)
  const [filtroAccion,  setFiltroAccion]  = useState('')
  const [filtroEntidad, setFiltroEntidad] = useState('')

  const cargar = useCallback(async (offset, reset) => {
    const params = new URLSearchParams({ limit: String(POR_PAGINA), offset: String(offset) })
    if (filtroAccion)  params.set('accion',  filtroAccion)
    if (filtroEntidad) params.set('entidad', filtroEntidad)
    const data = await api.get(`/auditoria?${params.toString()}`)
    setHayMas((data || []).length === POR_PAGINA)
    setRegistros(prev => reset ? (data || []) : [...prev, ...(data || [])])
  }, [filtroAccion, filtroEntidad])

  useEffect(() => {
    setLoading(true)
    cargar(0, true).finally(() => setLoading(false))
  }, [cargar])

  const cargarMas = async () => {
    setCargandoMas(true)
    try { await cargar(registros.length, false) } finally { setCargandoMas(false) }
  }

  return (
    <div className="auditoria-page">
      <div className="page-header">
        <div className="page-title">Auditoría</div>
        <div className="page-sub">Registro de acciones administrativas — solo visible para superadmin</div>
      </div>

      <div style={{ padding: '0 28px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 14, borderBottom: 'var(--border)' }}>
            <div className="filters-bar">
              <select value={filtroEntidad} onChange={e => setFiltroEntidad(e.target.value)}>
                <option value="">Todas las entidades</option>
                {Object.entries(ENTIDAD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)}>
                <option value="">Todas las acciones</option>
                {Object.entries(ACCION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="empty-state">Cargando...</td></tr>
                ) : registros.length === 0 ? (
                  <tr><td colSpan={5} className="empty-state">
                    <ShieldAlert size={20} style={{ marginBottom: 6, opacity: 0.4 }} /><br />
                    Sin registros de auditoría
                  </td></tr>
                ) : registros.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--gray-500)', fontSize: 12 }}>{r.ts}</td>
                    <td style={{ fontWeight: 500 }}>{r.usuario_nombre}</td>
                    <td><span className={`badge ${ACCION_BADGE[r.accion] || 'badge-gray'}`}>{ACCION_LABEL[r.accion] || r.accion}</span></td>
                    <td>{ENTIDAD_LABEL[r.entidad] || r.entidad}{r.entidad_id ? <span style={{ color: 'var(--gray-400)', fontSize: 11 }}> · {r.entidad_id}</span> : null}</td>
                    <td style={{ whiteSpace: 'normal', color: 'var(--gray-600)' }}>{r.detalle || <span style={{ color: 'var(--gray-300)' }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && hayMas && (
            <div className="list-pagination" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={cargarMas} disabled={cargandoMas}>
                {cargandoMas ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

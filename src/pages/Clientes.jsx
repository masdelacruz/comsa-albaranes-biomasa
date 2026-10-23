import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Copy, Check, RefreshCw, Search } from 'lucide-react'
import { api } from '../lib/api'
import SelectField from '../components/SelectField'
import { SECCIONES_CLIENTES, TIPOS_CLIENTE, slugify, panelUrl } from '../utils/clientes'
import '../components/shared.css'
import './Clientes.css'

// Cuadrícula de todos los clientes con panel (astilladoras, instalaciones
// y proveedores; la vista por tipo está en Configuración). Cada tarjeta abre la ficha del
// cliente; los botones de la derecha gestionan su enlace único y permanente
// al panel externo — solo cambia si se regenera el código (por ejemplo, tras
// detectar una anomalía) y el enlace anterior deja de funcionar.
const SECCION_POR_TIPO = Object.fromEntries(SECCIONES_CLIENTES.map(s => [s.tipo, s]))

const ordenTipo = t => SECCIONES_CLIENTES.findIndex(s => s.tipo === t)

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })

// Criterios de orden; el nombre desempata siempre para que el orden sea estable.
const ORDENES = {
  'Alfabético (A–Z)':   porNombre,
  'Alfabético (Z–A)':   (a, b) => porNombre(b, a),
  'Más albaranes':      (a, b) => b.n - a.n || porNombre(a, b),
  'Menos albaranes':    (a, b) => a.n - b.n || porNombre(a, b),
  'Actividad reciente': (a, b) => (b.ultimo || '').localeCompare(a.ultimo || '') || porNombre(a, b),
  // Por el tipo principal, en el orden de SECCIONES_CLIENTES
  'Tipo de cliente':    (a, b) => ordenTipo(a.tipo) - ordenTipo(b.tipo) || porNombre(a, b),
}
const ORDEN_DEFECTO = 'Alfabético (A–Z)'
const ORDEN_KEY = 'clientes.orden'

const fmtFecha = f => new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Clientes({ albaranes = [], usuario }) {
  const navigate = useNavigate()
  // Regenerar el enlace del panel (revoca el actual) es solo del superadmin;
  // el resto puede abrirlo y copiarlo.
  const puedeRegenerar = usuario?.nivel === 'superadmin'
  const [clientes,      setClientes]      = useState([])
  const [logos,         setLogos]         = useState({})
  const [loading,       setLoading]       = useState(true)
  const [busqueda,      setBusqueda]      = useState('')
  const [copiadoId,     setCopiadoId]     = useState(null)
  const [regenerandoId, setRegenerandoId] = useState(null)
  const [filtroTipo,    setFiltroTipo]    = useState('')
  const [orden,         setOrden]         = useState(() => {
    try { const o = localStorage.getItem(ORDEN_KEY); return ORDENES[o] ? o : ORDEN_DEFECTO } catch { return ORDEN_DEFECTO }
  })

  const cambiarOrden = (o) => {
    const v = ORDENES[o] ? o : ORDEN_DEFECTO
    setOrden(v)
    try { localStorage.setItem(ORDEN_KEY, v) } catch {}
  }

  const fetchClientes = async () => {
    try {
      const data = await api.get('/empresas')
      setClientes((data || []).filter(p => TIPOS_CLIENTE.has(p.tipo)))
    } catch {}
    setLoading(false)
  }

  const fetchLogos = async () => {
    try {
      const map = await api.get('/storage/logos')
      setLogos(map || {})
    } catch {}
  }

  useEffect(() => { fetchClientes(); fetchLogos() }, [])

  const handleCopiar = (p) => {
    navigator.clipboard.writeText(panelUrl(p))
    setCopiadoId(p.id)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  const handleRegenerar = async (p) => {
    if (!window.confirm(`El enlace del panel actual de "${p.nombre}" dejará de funcionar. ¿Generar uno nuevo?`)) return
    setRegenerandoId(p.id)
    try {
      await api.post(`/empresas/${p.id}/regenerar-codigo-acceso`, {})
      await fetchClientes()
    } catch {}
    setRegenerandoId(null)
  }

  // Una empresa dada de alta con varios tipos (p. ej. proveedor e instalación)
  // sale una sola vez: manda el registro del primer tipo de SECCIONES_CLIENTES,
  // cuenta como activa si lo es en alguno y suma los albaranes de todos sus roles.
  const unicos = Object.values(clientes.reduce((acc, p) => {
    const k = p.nombre.trim().toLowerCase()
    ;(acc[k] ||= []).push(p)
    return acc
  }, {})).map(grupo => {
    const orden = t => SECCIONES_CLIENTES.findIndex(sec => sec.tipo === t)
    const [principal] = [...grupo].sort((a, b) => orden(a.tipo) - orden(b.tipo))
    const tipos = grupo.map(g => g.tipo)
    const suyos = albaranes.filter(a => a.estado !== 'cancelado' && tipos.some(t => a[t] === principal.nombre))
    const ultimo = suyos.reduce((max, a) => (a.fecha && a.fecha > max ? a.fecha : max), '')
    return { ...principal, activo: grupo.some(g => g.activo), tipos, n: suyos.length, ultimo }
  })

  const q = busqueda.trim().toLowerCase()
  const visibles = unicos.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q)) && (!filtroTipo || p.tipos.includes(filtroTipo)))
  const lista = visibles.sort(ORDENES[orden])
  const conteoTipo = t => unicos.filter(p => p.tipos.includes(t)).length

  const tarjeta = (p) => {
    const logoUrl = logos[`empresa_${slugify(p.nombre)}`]
    const { icon: Icon, color } = SECCION_POR_TIPO[p.tipo]
    // Tipos en el orden de SECCIONES_CLIENTES (el principal primero)
    const tipos = SECCIONES_CLIENTES.filter(s => p.tipos.includes(s.tipo))
    return (
      <div key={p.id} className={`cli-tile ${p.activo ? '' : 'inactivo'}`} style={{ '--tone': color }}
        onClick={() => navigate(`/clientes/${p.id}`)}>
        <div className="cli-cabeza">
          <div className="cli-logo">
            {logoUrl
              ? <img src={logoUrl} alt="" />
              : <Icon size={28} color={color} strokeWidth={1.6} />}
          </div>
        </div>
        <div className="cli-cuerpo">
          <div className="cli-nombre" title={p.nombre}>{p.nombre}</div>
          <div className="cli-tipos-tile">
            {tipos.map(s => <span key={s.tipo} style={{ color: s.color }}>{s.singular}</span>)}
            {!p.activo && <span className="cli-inactivo">Inactivo</span>}
          </div>
        </div>
        <div className="cli-pie">
          <div className="cli-meta">
            {orden === 'Actividad reciente'
              ? (p.ultimo ? <>Último <strong>{fmtFecha(p.ultimo)}</strong></> : 'Sin albaranes')
              : <><strong>{p.n}</strong> {p.n === 1 ? 'albarán' : 'albaranes'}</>}
          </div>
          <div className="cli-acciones" onClick={e => e.stopPropagation()}>
            <a className="cli-accion" href={panelUrl(p)} target="_blank" rel="noreferrer" title="Abrir panel">
              <ExternalLink size={13} />
            </a>
            <button type="button" className={`cli-accion${copiadoId === p.id ? ' hecho' : ''}`}
              onClick={() => handleCopiar(p)} title="Copiar enlace">
              {copiadoId === p.id ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {puedeRegenerar && (
              <button type="button" className="cli-accion"
                disabled={regenerandoId === p.id}
                onClick={() => handleRegenerar(p)} title="Regenerar código (revoca el enlace actual)">
                <RefreshCw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const pestanas = [
    { tipo: '', titulo: 'Todos', n: unicos.length },
    ...SECCIONES_CLIENTES.map(s => ({ tipo: s.tipo, titulo: s.titulo, n: conteoTipo(s.tipo) })),
  ]

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Clientes</div>
        <div className="page-sub">Astilladoras, instalaciones y proveedores · pulsa en un cliente para ver su ficha</div>
      </div>

      <div className="page-body">
        <div className="cli-toolbar">
          <div className="cli-search">
            <Search size={14} className="cli-search-icon" />
            <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="cli-tipos">
            {pestanas.map(s => (
              <button key={s.tipo || 'todos'} type="button"
                className={`cli-tipo${filtroTipo === s.tipo ? ' activo' : ''}`}
                onClick={() => setFiltroTipo(s.tipo)}>
                {s.titulo} <span className="cli-tipo-n">{s.n}</span>
              </button>
            ))}
          </div>
          <div className="cli-orden">
            <span className="cli-orden-label">Ordenar</span>
            <SelectField value={orden} onChange={cambiarOrden} options={Object.keys(ORDENES)} />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</div>
        ) : (
          <div className="cli-grid">
            {lista.length === 0 ? (
              <div className="cli-vacio">
                {q || filtroTipo ? 'Ningún cliente coincide con el filtro' : 'Sin clientes registrados'}
              </div>
            ) : lista.map(tarjeta)}
          </div>
        )}
      </div>
    </div>
  )
}

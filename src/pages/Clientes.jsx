import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Copy, Check, RefreshCw, Search } from 'lucide-react'
import { api } from '../lib/api'
import { SECCIONES_CLIENTES, TIPOS_CLIENTE, slugify, panelUrl } from '../utils/clientes'
import '../components/shared.css'
import './Clientes.css'

// Cuadrícula de astilladoras, instalaciones y proveedores. Cada tarjeta abre la ficha del
// cliente; los botones de la derecha gestionan su enlace único y permanente
// al panel externo — solo cambia si se regenera el código (por ejemplo, tras
// detectar una anomalía) y el enlace anterior deja de funcionar.
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

  const numAlbaranes = (p) => albaranes.filter(a => a[p.tipo] === p.nombre && a.estado !== 'cancelado').length

  const q = busqueda.trim().toLowerCase()
  const filtrar = (lista) => q ? lista.filter(p => p.nombre.toLowerCase().includes(q)) : lista

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Clientes</div>
        <div className="page-sub">Astilladoras, instalaciones y proveedores · pulsa en un cliente para ver su ficha</div>
      </div>

      <div className="page-body">
        <div className="cli-search">
          <Search size={14} className="cli-search-icon" />
          <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</div>
        ) : (
          SECCIONES_CLIENTES.map(({ tipo, titulo, icon: Icon, color }) => {
            const lista = filtrar(clientes.filter(p => p.tipo === tipo))
              .sort((a, b) => (b.activo - a.activo) || a.nombre.localeCompare(b.nombre))
            return (
              <div key={tipo} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Icon size={16} color={color} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-700)' }}>{titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>({lista.length})</div>
                </div>
                <div className="cli-grid">
                  {lista.length === 0 ? (
                    <div className="cli-vacio">
                      Sin {titulo.toLowerCase()} registradas
                    </div>
                  ) : lista.map(p => {
                    const logoUrl = logos[`empresa_${slugify(p.nombre)}`]
                    const n = numAlbaranes(p)
                    return (
                    <div key={p.id} className={`cli-tile ${p.activo ? '' : 'inactivo'}`} onClick={() => navigate(`/clientes/${p.id}`)}>
                      <div className="cli-logo" style={{
                        background: logoUrl ? '#fff' : `${color}1a`,
                        border: logoUrl ? 'var(--border)' : 'none',
                      }}>
                        {logoUrl
                          ? <img src={logoUrl} alt="" />
                          : <Icon size={20} color={color} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cli-nombre" title={p.nombre}>{p.nombre}</div>
                        <div className="cli-meta">
                          {!p.activo && <span className="cli-tag-inactivo">Inactivo</span>}
                          <span>{n} {n === 1 ? 'albarán' : 'albaranes'}</span>
                          {p.contacto && <span>· {p.contacto}{(p.contactos?.length || 0) > 1 ? ` +${p.contactos.length - 1}` : ''}</span>}
                        </div>
                      </div>
                      <div className="cli-acciones" onClick={e => e.stopPropagation()}>
                        <a className="btn btn-ghost" style={{ padding: '5px 7px', fontSize: 11, color: 'var(--gray-500)' }}
                          href={panelUrl(p)} target="_blank" rel="noreferrer" title="Abrir panel">
                          <ExternalLink size={12} />
                        </a>
                        <button className="btn btn-ghost"
                          style={{ padding: '5px 7px', fontSize: 11, color: copiadoId === p.id ? 'var(--green-600)' : 'var(--gray-500)' }}
                          onClick={() => handleCopiar(p)} title="Copiar enlace">
                          {copiadoId === p.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        {puedeRegenerar && (
                          <button className="btn btn-ghost" style={{ padding: '5px 7px', fontSize: 11, color: 'var(--gray-500)' }}
                            disabled={regenerandoId === p.id}
                            onClick={() => handleRegenerar(p)} title="Regenerar código (revoca el enlace actual)">
                            <RefreshCw size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { ExternalLink, Copy, Check, RefreshCw, Factory, Building2 } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'

const SECCIONES = [
  { tipo: 'astilladora', titulo: 'Astilladoras', icon: Factory,   color: '#1D9E75' },
  { tipo: 'instalacion', titulo: 'Instalaciones', icon: Building2, color: '#f5a623' },
]

// Enlace único y permanente del panel externo de cada empresa. Solo cambia
// si se regenera el código (por ejemplo, tras detectar una anomalía) — el
// enlace anterior deja de funcionar en ese momento y muestra un aviso.
export default function PortalesExternos() {
  const [proveedores, setProveedores] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [busqueda,    setBusqueda]    = useState('')
  const [copiadoId,        setCopiadoId]        = useState(null)
  const [regenerandoId,    setRegenerandoId]    = useState(null)

  const fetchProveedores = async () => {
    try {
      const data = await api.get('/empresas?activo=true')
      setProveedores(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchProveedores() }, [])

  const panelUrl = (p) => {
    const base = p.tipo === 'astilladora'
      ? `/campo/astilladora/${p.nombre.replace(/\s+/g, '-')}`
      : `/campo/instalacion/${p.nombre.replace(/\s+/g, '-')}`
    return `${window.location.origin}${base}?c=${encodeURIComponent(p.acceso_codigo || '')}`
  }

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
      await fetchProveedores()
    } catch {}
    setRegenerandoId(null)
  }

  const q = busqueda.trim().toLowerCase()
  const filtrar = (lista) => q ? lista.filter(p => p.nombre.toLowerCase().includes(q)) : lista

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Portales externos</div>
        <div className="page-sub">Enlace único y permanente al panel de cada astilladora e instalación</div>
      </div>

      <div style={{ padding: '0 28px 28px' }}>
        <input
          type="text"
          placeholder="Buscar empresa..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: '100%', maxWidth: 320, marginBottom: 20, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'var(--border)', fontSize: 13 }}
        />

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</div>
        ) : (
          SECCIONES.map(({ tipo, titulo, icon: Icon, color }) => {
            const lista = filtrar(proveedores.filter(p => p.tipo === tipo)).sort((a, b) => a.nombre.localeCompare(b.nombre))
            return (
              <div key={tipo} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Icon size={16} color={color} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-700)' }}>{titulo}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>({lista.length})</div>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {lista.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                      Sin {titulo.toLowerCase()} registradas
                    </div>
                  ) : lista.map((p, i) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                      borderBottom: i === lista.length - 1 ? 'none' : 'var(--border)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-800)' }}>{p.nombre}</div>
                        <code style={{ fontSize: 11, color: 'var(--gray-400)', wordBreak: 'break-all' }}>{panelUrl(p)}</code>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <a className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 11 }}
                          href={panelUrl(p)} target="_blank" rel="noreferrer" title="Abrir panel">
                          <ExternalLink size={12} />
                        </a>
                        <button className="btn btn-ghost"
                          style={{ padding: '5px 9px', fontSize: 11, color: copiadoId === p.id ? 'var(--green-600)' : 'var(--gray-500)' }}
                          onClick={() => handleCopiar(p)} title="Copiar enlace">
                          {copiadoId === p.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <button className="btn btn-ghost" style={{ padding: '5px 9px', fontSize: 11, color: 'var(--gray-500)' }}
                          disabled={regenerandoId === p.id}
                          onClick={() => handleRegenerar(p)} title="Regenerar código (revoca el enlace actual)">
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

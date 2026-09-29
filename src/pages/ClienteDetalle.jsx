import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, User, Phone, Mail, Clock, StickyNote, ExternalLink, Copy, Check,
  RefreshCw, Link2, Users, Truck, FileText, ChevronRight,
} from 'lucide-react'
import { api } from '../lib/api'
import { Badge } from '../components/Badge'
import { SECCIONES_CLIENTES, slugify, panelUrl } from '../utils/clientes'
import '../components/shared.css'
import './Clientes.css'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const EN_CURSO = new Set(['programado', 'pendiente_campo', 'pendiente_oficina', 'humedad_pendiente'])

const netoKg = a => (a.pesada?.entrada && a.pesada?.salida ? Number(a.pesada.entrada) - Number(a.pesada.salida) : null)
const fmtFecha = f => f ? f.slice(0, 10).split('-').reverse().join('/') : '—'

// Ficha de un cliente (astilladora o instalación): datos de contacto, enlace
// del panel externo y su actividad a partir de los albaranes. La edición se
// hace en Configuración, que sigue siendo el único sitio donde se modifican.
export default function ClienteDetalle({ albaranes = [] }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cliente,     setCliente]     = useState(null)
  const [logoUrl,     setLogoUrl]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [copiado,     setCopiado]     = useState(false)
  const [regenerando, setRegenerando] = useState(false)

  const fetchCliente = async () => {
    try {
      const data = await api.get('/empresas')
      const c = (data || []).find(p => String(p.id) === String(id) && (p.tipo === 'astilladora' || p.tipo === 'instalacion'))
      setCliente(c || null)
      if (c) {
        try {
          const map = await api.get('/storage/logos')
          setLogoUrl(map?.[`empresa_${slugify(c.nombre)}`] || null)
        } catch {}
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchCliente() }, [id])

  const stats = useMemo(() => {
    if (!cliente) return null
    const propios = albaranes
      .filter(a => a[cliente.tipo] === cliente.nombre)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    const validos = propios.filter(a => a.estado !== 'cancelado')
    const pesoKg  = validos.reduce((s, a) => s + (netoKg(a) || 0), 0)
    const humedades = validos.map(a => a.pesada?.humedad).filter(h => h != null && h !== '').map(Number)
    const humedadMedia = humedades.length ? humedades.reduce((s, h) => s + h, 0) / humedades.length : null

    // Últimos 6 meses (incluido el actual), para el gráfico de actividad
    const hoy = new Date()
    const meses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const delMes = validos.filter(a => a.fecha?.startsWith(key))
      return { key, label: MESES[d.getMonth()], n: delMes.length, kg: delMes.reduce((s, a) => s + (netoKg(a) || 0), 0) }
    })

    // Con quién trabaja: una astilladora abastece instalaciones; una
    // instalación recibe de proveedores.
    const campoRel = cliente.tipo === 'astilladora' ? 'instalacion' : 'proveedor'
    const rel = {}
    validos.forEach(a => { if (a[campoRel]) rel[a[campoRel]] = (rel[a[campoRel]] || 0) + 1 })
    const relaciones = Object.entries(rel).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return {
      propios, total: validos.length,
      enCurso: propios.filter(a => EN_CURSO.has(a.estado)).length,
      cerrados: propios.filter(a => a.estado === 'cerrado').length,
      pesoKg, humedadMedia, meses, relaciones,
      ultimo: validos[0]?.fecha || null,
    }
  }, [albaranes, cliente])

  const handleCopiar = () => {
    navigator.clipboard.writeText(panelUrl(cliente))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const handleRegenerar = async () => {
    if (!window.confirm(`El enlace del panel actual de "${cliente.nombre}" dejará de funcionar. ¿Generar uno nuevo?`)) return
    setRegenerando(true)
    try {
      await api.post(`/empresas/${cliente.id}/regenerar-codigo-acceso`, {})
      await fetchCliente()
    } catch {}
    setRegenerando(false)
  }

  const volver = (
    <button className="btn btn-ghost cd-volver" onClick={() => navigate('/clientes')}>
      <ArrowLeft size={14} /> Clientes
    </button>
  )

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</div>
  if (!cliente) return (
    <div className="cd-page">
      {volver}
      <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>Cliente no encontrado</div>
    </div>
  )

  const seccion = SECCIONES_CLIENTES.find(s => s.tipo === cliente.tipo)
  const { icon: Icon, color, singular } = seccion
  const maxMes = Math.max(1, ...stats.meses.map(m => m.n))
  const maxRel = Math.max(1, ...stats.relaciones.map(r => r[1]))
  const trabajadores = cliente.trabajadores || []
  const maquinas = cliente.maquinas || []

  const contacto = [
    { icon: User,  label: 'Persona de contacto', valor: cliente.contacto },
    { icon: Phone, label: 'Teléfono', valor: cliente.telefono, href: cliente.telefono && `tel:${cliente.telefono.replace(/\s+/g, '')}` },
    { icon: Mail,  label: 'Email', valor: cliente.email, href: cliente.email && `mailto:${cliente.email}` },
    { icon: Clock, label: 'Horario', valor: cliente.horario },
  ]

  return (
    <div className="cd-page">
      {volver}

      {/* ── Cabecera ── */}
      <div className="cd-hero card" style={{ '--cd-color': color }}>
        <div className="cd-hero-logo" style={{ background: logoUrl ? '#fff' : `${color}1a` }}>
          {logoUrl ? <img src={logoUrl} alt="" /> : <Icon size={40} color={color} />}
        </div>
        <div className="cd-hero-info">
          <div className="cd-hero-tags">
            <span className="cd-tipo" style={{ color, background: `${color}1a` }}><Icon size={12} /> {singular}</span>
            <span className={`cd-estado ${cliente.activo ? 'si' : 'no'}`}>
              <span className="cd-dot" />{cliente.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <h1 className="cd-nombre">{cliente.nombre}</h1>
          <div className="cd-hero-sub">
            {stats.ultimo ? <>Último albarán el <b>{fmtFecha(stats.ultimo)}</b></> : 'Todavía sin albaranes'}
          </div>
        </div>
        <button className="btn btn-primary cd-editar"
          onClick={() => navigate(`/configuracion?tab=${cliente.tipo}&editar=${cliente.id}`)}>
          <Pencil size={14} /> Editar
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="cd-kpis">
        <div className="cd-kpi card">
          <div className="cd-kpi-label">Albaranes</div>
          <div className="cd-kpi-val">{stats.total}</div>
          <div className="cd-kpi-sub">{stats.cerrados} cerrados</div>
        </div>
        <div className="cd-kpi card">
          <div className="cd-kpi-label">En curso</div>
          <div className="cd-kpi-val" style={{ color: stats.enCurso ? 'var(--blue-700)' : undefined }}>{stats.enCurso}</div>
          <div className="cd-kpi-sub">pendientes de cerrar</div>
        </div>
        <div className="cd-kpi card">
          <div className="cd-kpi-label">Biomasa</div>
          <div className="cd-kpi-val">{stats.pesoKg > 0 ? (stats.pesoKg / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}<span className="cd-kpi-unit">{stats.pesoKg > 0 ? ' t' : ''}</span></div>
          <div className="cd-kpi-sub">peso neto total</div>
        </div>
        <div className="cd-kpi card">
          <div className="cd-kpi-label">Humedad media</div>
          <div className="cd-kpi-val">{stats.humedadMedia != null ? stats.humedadMedia.toLocaleString('es-ES', { maximumFractionDigits: 1 }) : '—'}<span className="cd-kpi-unit">{stats.humedadMedia != null ? ' %' : ''}</span></div>
          <div className="cd-kpi-sub">de los albaranes medidos</div>
        </div>
      </div>

      <div className="cd-grid">
        {/* ── Columna izquierda ── */}
        <div className="cd-col">
          <div className="card">
            <div className="section-label">Contacto</div>
            <div className="cd-contacto">
              {contacto.map(({ icon: I, label, valor, href }) => (
                <div key={label} className="cd-contacto-item">
                  <div className="cd-contacto-icon"><I size={15} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cd-contacto-label">{label}</div>
                    {valor
                      ? href ? <a className="cd-contacto-val link" href={href}>{valor}</a> : <div className="cd-contacto-val">{valor}</div>
                      : <div className="cd-contacto-val vacio">Sin indicar</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={12} /> Panel del cliente</div>
            <div className="cd-portal-url" title={panelUrl(cliente)}>{panelUrl(cliente)}</div>
            <div className="cd-portal-acciones">
              <a className="btn" href={panelUrl(cliente)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Abrir</a>
              <button className="btn" onClick={handleCopiar} style={{ color: copiado ? 'var(--green-600)' : undefined }}>
                {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? 'Copiado' : 'Copiar enlace'}
              </button>
              <button className="btn btn-ghost" onClick={handleRegenerar} disabled={regenerando} title="El enlace actual dejará de funcionar">
                <RefreshCw size={13} /> Regenerar
              </button>
            </div>
          </div>

          {cliente.tipo === 'astilladora' && (
            <div className="card">
              <div className="section-label">Equipo</div>
              <div className="cd-sublabel"><Users size={13} /> Trabajadores <span>({trabajadores.length})</span></div>
              {trabajadores.length ? (
                <div className="cd-chips">
                  {trabajadores.map(t => (
                    <span key={t} className="cd-chip">
                      <span className="cd-avatar" style={{ background: `${color}1a`, color }}>{t.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span>
                      {t}
                    </span>
                  ))}
                </div>
              ) : <div className="cd-vacio">Sin trabajadores registrados</div>}

              <div className="cd-sublabel" style={{ marginTop: 16 }}><Truck size={13} /> Máquinas <span>({maquinas.length})</span></div>
              {maquinas.length ? (
                <div className="cd-maquinas">
                  {maquinas.map((m, i) => (
                    <div key={i} className="cd-maquina">
                      <span>{m.nombre || 'Máquina'}</span>
                      <span className="cd-matricula">{m.matricula}</span>
                    </div>
                  ))}
                </div>
              ) : <div className="cd-vacio">Sin máquinas registradas</div>}
            </div>
          )}

          {cliente.notas && (
            <div className="card cd-notas">
              <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><StickyNote size={12} /> Notas internas</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--gray-800)', lineHeight: 1.5 }}>{cliente.notas}</div>
            </div>
          )}
        </div>

        {/* ── Columna derecha ── */}
        <div className="cd-col">
          <div className="card">
            <div className="section-label">Actividad · últimos 6 meses</div>
            <div className="cd-barras">
              {stats.meses.map(m => (
                <div key={m.key} className="cd-barra-col" title={`${m.n} albaranes${m.kg ? ` · ${(m.kg / 1000).toFixed(1)} t` : ''}`}>
                  <div className="cd-barra-n">{m.n || ''}</div>
                  <div className="cd-barra-track">
                    <div className="cd-barra" style={{ height: `${(m.n / maxMes) * 100}%`, background: color }} />
                  </div>
                  <div className="cd-barra-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-label">{cliente.tipo === 'astilladora' ? 'Instalaciones que abastece' : 'Proveedores que le suministran'}</div>
            {stats.relaciones.length ? (
              <div className="cd-rel">
                {stats.relaciones.map(([nombre, n]) => (
                  <div key={nombre} className="cd-rel-item">
                    <div className="cd-rel-top"><span>{nombre}</span><b>{n}</b></div>
                    <div className="cd-rel-track"><div style={{ width: `${(n / maxRel) * 100}%`, background: color }} /></div>
                  </div>
                ))}
              </div>
            ) : <div className="cd-vacio">Sin datos todavía</div>}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="section-label" style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} /> Últimos albaranes
            </div>
            {stats.propios.length ? stats.propios.slice(0, 8).map(a => {
              const kg = netoKg(a)
              const otro = cliente.tipo === 'astilladora' ? a.instalacion : a.proveedor
              return (
                <div key={a.id} className="cd-alb" onClick={() => navigate(`/albaran/${a.id}`)}>
                  <div className="cd-alb-fecha">{fmtFecha(a.fecha)}</div>
                  <div className="cd-alb-info">
                    <div className="cd-alb-id">{a.id}</div>
                    <div className="cd-alb-otro">{otro || '—'}</div>
                  </div>
                  <div className="cd-alb-peso">{kg ? `${(kg / 1000).toFixed(1)} t` : ''}</div>
                  <Badge estado={a.estado} />
                  <ChevronRight size={14} className="cli-chevron" />
                </div>
              )
            }) : <div className="cd-vacio" style={{ padding: '12px 20px 18px' }}>Sin albaranes</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

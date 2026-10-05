import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Pencil, UserRound, Phone, Mail, Clock, StickyNote, ExternalLink, Copy, Check, RefreshCw,
  Link2, UsersRound, Truck, FileText, ChevronRight, Ellipsis, ArrowUpRight, Hourglass,
  Weight, Droplets, Info, Network, Inbox, Settings, ChartColumn, Send, PhoneCall,
} from 'lucide-react'
import { api } from '../lib/api'
import { Badge } from '../components/Badge'
import EmpresaModal from '../components/EmpresaModal'
import { SECCIONES_CLIENTES, slugify, panelUrl } from '../utils/clientes'
import '../components/shared.css'
import './Clientes.css'
import './ClienteDetalle.css'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const EN_CURSO = new Set(['programado', 'pendiente_campo', 'pendiente_oficina', 'humedad_pendiente'])
const PERIODOS = [6, 12]

const netoKg = a => (a.pesada?.entrada && a.pesada?.salida ? Number(a.pesada.entrada) - Number(a.pesada.salida) : null)
const fmtFecha = f => f ? f.slice(0, 10).split('-').reverse().join('/') : '—'
const fmtNum = (n, dec = 1) => n.toLocaleString('es-ES', { maximumFractionDigits: dec })
const iniciales = s => s.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()

// Estado vacío reutilizable: icono suave centrado + mensaje amable.
function Vacio({ icon: I, titulo, texto, compacto }) {
  return (
    <div className={`cd-empty ${compacto ? 'compacto' : ''}`}>
      <div className="cd-empty-icon"><I size={compacto ? 16 : 20} /></div>
      <div className="cd-empty-titulo">{titulo}</div>
      {texto && <div className="cd-empty-texto">{texto}</div>}
    </div>
  )
}

function CardHead({ icon: I, titulo, extra, children }) {
  return (
    <div className="cd-card-head">
      <div className="cd-card-title">
        <span className="cd-card-title-icon"><I size={14} /></span>
        {titulo}
        {extra != null && <span className="cd-card-count">{extra}</span>}
      </div>
      {children}
    </div>
  )
}

// Ficha de un cliente (astilladora o instalación): datos de contacto, enlace
// del panel externo y su actividad a partir de los albaranes. La edición se
// hace en Configuración, que sigue siendo el único sitio donde se modifican.
export default function ClienteDetalle({ albaranes = [], usuario }) {
  const { id } = useParams()
  const puedeGestionar = usuario?.nivel !== 'basico'
  // Regenerar el enlace del panel (revoca el actual) es solo del superadmin.
  const puedeRegenerar = usuario?.nivel === 'superadmin'
  const navigate = useNavigate()
  const [cliente,     setCliente]     = useState(null)
  const [logos,       setLogos]       = useState({})
  const [editando,    setEditando]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [copiado,     setCopiado]     = useState(null)
  const [regenerando, setRegenerando] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [periodo,     setPeriodo]     = useState(6)
  const menuRef   = useRef(null)
  const refActividad = useRef(null)
  const refAlbaranes = useRef(null)

  const fetchCliente = async () => {
    try {
      const data = await api.get('/empresas')
      const c = (data || []).find(p => String(p.id) === String(id) && (p.tipo === 'astilladora' || p.tipo === 'instalacion'))
      setCliente(c || null)
      if (c) {
        try {
          const map = await api.get('/storage/logos')
          setLogos(map || {})
        } catch {}
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchCliente() }, [id])

  useEffect(() => {
    if (!menuAbierto) return
    const cerrar = e => { if (!menuRef.current?.contains(e.target)) setMenuAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuAbierto])

  const stats = useMemo(() => {
    if (!cliente) return null
    const propios = albaranes
      .filter(a => a[cliente.tipo] === cliente.nombre)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
    const validos = propios.filter(a => a.estado !== 'cancelado')
    const pesoKg  = validos.reduce((s, a) => s + (netoKg(a) || 0), 0)
    const humedades = validos.map(a => a.pesada?.humedad).filter(h => h != null && h !== '').map(Number)
    const humedadMedia = humedades.length ? humedades.reduce((s, h) => s + h, 0) / humedades.length : null

    // Con quién trabaja: una astilladora abastece instalaciones; una
    // instalación recibe de proveedores.
    const campoRel = cliente.tipo === 'astilladora' ? 'instalacion' : 'proveedor'
    const rel = {}
    validos.forEach(a => { if (a[campoRel]) rel[a[campoRel]] = (rel[a[campoRel]] || 0) + 1 })
    const relaciones = Object.entries(rel).sort((a, b) => b[1] - a[1]).slice(0, 6)

    return {
      propios, validos, total: validos.length,
      enCurso: propios.filter(a => EN_CURSO.has(a.estado)).length,
      cerrados: propios.filter(a => a.estado === 'cerrado').length,
      pesoKg, humedadMedia, humedadesMedidas: humedades.length, relaciones,
      ultimo: validos[0]?.fecha || null,
    }
  }, [albaranes, cliente])

  // Serie mensual del periodo elegido (incluido el mes actual)
  const meses = useMemo(() => {
    if (!stats) return []
    const hoy = new Date()
    return Array.from({ length: periodo }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - (periodo - 1) + i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const delMes = stats.validos.filter(a => a.fecha?.startsWith(key))
      return { key, label: MESES[d.getMonth()], anio: d.getFullYear(), n: delMes.length, kg: delMes.reduce((s, a) => s + (netoKg(a) || 0), 0) }
    })
  }, [stats, periodo])

  const copiar = (texto, clave) => {
    navigator.clipboard.writeText(texto)
    setCopiado(clave)
    setTimeout(() => setCopiado(c => (c === clave ? null : c)), 2000)
  }

  const handleRegenerar = async () => {
    setMenuAbierto(false)
    if (!window.confirm(`El enlace del panel actual de "${cliente.nombre}" dejará de funcionar. ¿Generar uno nuevo?`)) return
    setRegenerando(true)
    try {
      await api.post(`/empresas/${cliente.id}/regenerar-codigo-acceso`, {})
      await fetchCliente()
    } catch {}
    setRegenerando(false)
  }

  const irA = ref => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>Cargando...</div>
  if (!cliente) return (
    <div className="cd-page">
      <div className="cd-breadcrumb"><button onClick={() => navigate('/clientes')}>Clientes</button></div>
      <div className="cd-card"><Vacio icon={Inbox} titulo="Cliente no encontrado" texto="Puede que se haya eliminado o que el enlace no sea correcto." /></div>
    </div>
  )

  const { icon: Icon, color, singular, titulo: tituloSeccion } = SECCIONES_CLIENTES.find(s => s.tipo === cliente.tipo)
  const esAstilladora = cliente.tipo === 'astilladora'
  const logoUrl = logos[`empresa_${slugify(cliente.nombre)}`]
  const url = panelUrl(cliente)
  const trabajadores = cliente.trabajadores || []
  const maquinas = cliente.maquinas || []
  const maxMes = Math.max(1, ...meses.map(m => m.n))
  const totalPeriodo = meses.reduce((s, m) => s + m.n, 0)
  const kgPeriodo = meses.reduce((s, m) => s + m.kg, 0)
  const maxRel = Math.max(1, ...stats.relaciones.map(r => r[1]))
  const [destacado, ...resto] = stats.propios
  const telHref = cliente.telefono && `tel:${cliente.telefono.replace(/\s+/g, '')}`

  const datosContacto = [
    { icon: UserRound, label: 'Persona de contacto', valor: cliente.contacto },
    { icon: Phone,     label: 'Teléfono', valor: cliente.telefono, href: telHref },
    { icon: Mail,      label: 'Email', valor: cliente.email, href: cliente.email && `mailto:${cliente.email}` },
    { icon: Clock,     label: 'Horario', valor: cliente.horario },
  ]

  const kpis = [
    { icon: FileText,  label: 'Albaranes',     valor: stats.total, sub: `${stats.cerrados} ${stats.cerrados === 1 ? 'cerrado' : 'cerrados'}`, ref: refAlbaranes, tono: 'green' },
    { icon: Hourglass, label: 'En curso',      valor: stats.enCurso, sub: 'pendientes de cerrar', ref: refAlbaranes, tono: stats.enCurso ? 'blue' : 'gray' },
    { icon: Weight,    label: 'Biomasa',       valor: stats.pesoKg > 0 ? fmtNum(stats.pesoKg / 1000) : '—', unidad: stats.pesoKg > 0 ? 't' : '', sub: 'peso neto total', ref: refActividad, tono: 'amber' },
    { icon: Droplets,  label: 'Humedad media', valor: stats.humedadMedia != null ? fmtNum(stats.humedadMedia) : '—', unidad: stats.humedadMedia != null ? '%' : '', sub: stats.humedadesMedidas ? `de ${stats.humedadesMedidas} albaranes medidos` : 'sin mediciones todavía', ref: refActividad, tono: 'teal' },
  ]

  const relTitulo = esAstilladora ? 'Instalaciones que abastece' : 'Proveedores que le suministran'

  return (
    <div className="cd-page" style={{ '--cd-color': color }}>
      <div className="cd-breadcrumb">
        <button onClick={() => navigate('/clientes')}>Clientes</button>
        <ChevronRight size={13} />
        <span>{tituloSeccion}</span>
        <ChevronRight size={13} />
        <span className="actual">{cliente.nombre}</span>
      </div>

      {/* ══ Cabecera ══ */}
      <section className="cd-hero">
        <svg className="cd-hero-deco" viewBox="0 0 600 260" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <path key={i} d={`M ${620 - i * 38} -20 C ${520 - i * 30} ${60 + i * 6}, ${600 - i * 42} ${170 - i * 4}, ${470 - i * 36} 290`}
              fill="none" stroke="currentColor" strokeWidth="1" opacity={0.5 - i * 0.05} />
          ))}
          <circle cx="545" cy="70" r="120" fill="currentColor" opacity="0.05" />
        </svg>

        <div className="cd-hero-main">
          <div className="cd-hero-logo" style={{ background: logoUrl ? '#fff' : `${color}14` }}>
            {logoUrl ? <img src={logoUrl} alt="" /> : <Icon size={42} color={color} strokeWidth={1.6} />}
          </div>
          <div className="cd-hero-info">
            <div className="cd-hero-tags">
              <span className="cd-pill" style={{ color, background: `${color}14`, borderColor: `${color}33` }}><Icon size={12} /> {singular}</span>
              <span className={`cd-pill cd-pill-estado ${cliente.activo ? 'si' : 'no'}`}><span className="cd-dot" />{cliente.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            <h1 className="cd-nombre">{cliente.nombre}</h1>
            <div className="cd-hero-sub">
              {stats.ultimo
                ? <>Último albarán el <b>{fmtFecha(stats.ultimo)}</b> · {stats.total} {stats.total === 1 ? 'albarán registrado' : 'albaranes registrados'}</>
                : stats.propios.length ? `Sin albaranes activos · ${stats.propios.length} ${stats.propios.length === 1 ? 'anulado' : 'anulados'}` : 'Todavía sin albaranes registrados'}
            </div>
          </div>

          <div className="cd-hero-acciones">
            <a className="cd-btn" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir panel</a>
            <button className={`cd-btn ${copiado === 'url' ? 'ok' : ''}`} onClick={() => copiar(url, 'url')}>
              {copiado === 'url' ? <Check size={14} /> : <Copy size={14} />} {copiado === 'url' ? 'Copiado' : 'Copiar enlace'}
            </button>
            {puedeRegenerar && (
              <button className="cd-btn cd-btn-icon" onClick={handleRegenerar} disabled={regenerando} title="Regenerar enlace (el actual deja de funcionar)">
                <RefreshCw size={14} className={regenerando ? 'cd-girando' : ''} />
              </button>
            )}
            {(puedeGestionar || cliente.telefono || cliente.email) && (
            <div className="cd-menu-wrap" ref={menuRef}>
              <button className={`cd-btn cd-btn-icon ${menuAbierto ? 'activo' : ''}`} onClick={() => setMenuAbierto(v => !v)} title="Más opciones">
                <Ellipsis size={16} />
              </button>
              {menuAbierto && (
                <div className="cd-menu">
                  {cliente.telefono && <a href={telHref} onClick={() => setMenuAbierto(false)}><PhoneCall size={14} /> Llamar</a>}
                  {cliente.email && <a href={`mailto:${cliente.email}`} onClick={() => setMenuAbierto(false)}><Send size={14} /> Enviar email</a>}
                  {cliente.telefono && <button onClick={() => { copiar(cliente.telefono, 'tel'); setMenuAbierto(false) }}><Copy size={14} /> Copiar teléfono</button>}
                  {cliente.email && <button onClick={() => { copiar(cliente.email, 'email'); setMenuAbierto(false) }}><Copy size={14} /> Copiar email</button>}
                  {puedeGestionar && (
                    <>
                      {(cliente.telefono || cliente.email) && <div className="cd-menu-sep" />}
                      <button onClick={() => navigate(`/configuracion?tab=${cliente.tipo}`)}><Settings size={14} /> Ver en Configuración</button>
                      {puedeRegenerar && <button className="peligro" onClick={handleRegenerar}><RefreshCw size={14} /> Regenerar enlace</button>}
                    </>
                  )}
                </div>
              )}
            </div>
            )}
            {puedeGestionar && (
              <button className="cd-btn cd-btn-primary" onClick={() => setEditando(true)}>
                <Pencil size={14} /> Editar
              </button>
            )}
          </div>
        </div>

        <div className="cd-hero-strip">
          {datosContacto.map(({ icon: I, label, valor, href }) => (
            <div key={label} className="cd-strip-item">
              <span className="cd-strip-icon"><I size={15} /></span>
              <div className="cd-strip-txt">
                <div className="cd-strip-label">{label}</div>
                {valor
                  ? href ? <a href={href} className="cd-strip-val link">{valor}</a> : <div className="cd-strip-val">{valor}</div>
                  : <div className="cd-strip-val vacio">Sin indicar</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ KPIs ══ */}
      <section className="cd-kpis">
        {kpis.map(k => (
          <button key={k.label} className={`cd-kpi tono-${k.tono}`} onClick={() => irA(k.ref)}>
            <div className="cd-kpi-top">
              <span className="cd-kpi-icon"><k.icon size={18} /></span>
              <ArrowUpRight size={16} className="cd-kpi-arrow" />
            </div>
            <div className="cd-kpi-label">{k.label}</div>
            <div className="cd-kpi-val">{k.valor}{k.unidad && <span className="cd-kpi-unit">{k.unidad}</span>}</div>
            <div className="cd-kpi-sub">{k.sub}</div>
          </button>
        ))}
      </section>

      {/* ══ Contenido ══ */}
      <section className="cd-grid">
        {/* Contacto */}
        <div className="cd-card cd-a-contacto">
          <CardHead icon={UserRound} titulo="Contacto" />
          <div className="cd-contacto-list">
            {datosContacto.map(({ icon: I, label, valor, href }) => (
              <div key={label} className="cd-contacto-row">
                <span className="cd-contacto-icon"><I size={15} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cd-contacto-label">{label}</div>
                  {valor
                    ? href ? <a className="cd-contacto-val link" href={href}>{valor}</a> : <div className="cd-contacto-val">{valor}</div>
                    : <div className="cd-contacto-val vacio">Sin indicar</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="cd-notas">
            <div className="cd-notas-head"><StickyNote size={13} /> Notas internas</div>
            {cliente.notas
              ? <div className="cd-notas-txt">{cliente.notas}</div>
              : <div className="cd-notas-txt vacio">Sin notas para este cliente</div>}
          </div>
        </div>

        {/* Actividad */}
        <div className="cd-card cd-a-actividad" ref={refActividad}>
          <CardHead icon={ChartColumn} titulo="Actividad">
            <div className="cd-segmented">
              {PERIODOS.map(p => (
                <button key={p} className={periodo === p ? 'on' : ''} onClick={() => setPeriodo(p)}>{p} meses</button>
              ))}
            </div>
          </CardHead>
          <div className="cd-act-resumen">
            <div><span className="cd-act-num">{totalPeriodo}</span><span className="cd-act-lbl">{totalPeriodo === 1 ? 'albarán' : 'albaranes'}</span></div>
            <div className="cd-act-sep" />
            <div><span className="cd-act-num">{kgPeriodo > 0 ? fmtNum(kgPeriodo / 1000) : '—'}</span><span className="cd-act-lbl">{kgPeriodo > 0 ? 't de biomasa' : 'sin pesadas'}</span></div>
            <div className="cd-act-periodo">Últimos {periodo} meses</div>
          </div>
          <div className={`cd-chart ${totalPeriodo === 0 ? 'vacio' : ''}`}>
            <div className="cd-chart-grid"><span /><span /><span /><span /></div>
            <div className="cd-chart-bars">
              {meses.map((m, i) => (
                <div key={m.key} className="cd-chart-col" title={`${m.label} ${m.anio}: ${m.n} ${m.n === 1 ? 'albarán' : 'albaranes'}${m.kg ? ` · ${fmtNum(m.kg / 1000)} t` : ''}`}>
                  <div className="cd-chart-track">
                    {m.n > 0 && <div className="cd-chart-n">{m.n}</div>}
                    <div className={`cd-chart-bar ${i === meses.length - 1 ? 'actual' : ''}`} style={{ height: m.n ? `${Math.max(6, (m.n / maxMes) * 100)}%` : 0 }} />
                  </div>
                  <div className="cd-chart-label">{m.label}{(i === 0 || m.label === 'Ene') && <span>{String(m.anio).slice(2)}</span>}</div>
                </div>
              ))}
            </div>
            {totalPeriodo === 0 && (
              <div className="cd-chart-empty">
                <ChartColumn size={18} />
                <div>Sin actividad en este periodo</div>
                <span>Los albaranes aparecerán aquí mes a mes</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel del cliente */}
        <div className="cd-card cd-a-panel">
          <CardHead icon={Link2} titulo="Panel del cliente" />
          <div className="cd-panel-desc">Acceso directo y permanente a su vista de albaranes, sin usuario ni contraseña.</div>
          <div className="cd-url">
            <Link2 size={14} className="cd-url-icon" />
            <span title={url}>{url.replace(/^https?:\/\//, '')}</span>
            <button onClick={() => copiar(url, 'url')} title="Copiar">{copiado === 'url' ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
          <div className={`cd-panel-acciones ${puedeRegenerar ? "" : "dos"}`}>
            <a className="cd-btn" href={url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir</a>
            <button className={`cd-btn ${copiado === 'url' ? 'ok' : ''}`} onClick={() => copiar(url, 'url')}>
              {copiado === 'url' ? <Check size={14} /> : <Copy size={14} />} {copiado === 'url' ? 'Copiado' : 'Copiar'}
            </button>
            {puedeRegenerar && <button className="cd-btn" onClick={handleRegenerar} disabled={regenerando}><RefreshCw size={14} className={regenerando ? 'cd-girando' : ''} /> Regenerar</button>}
          </div>
          <div className="cd-nota-info">
            <Info size={14} />
            <div>Puedes compartir este enlace con el cliente.{puedeRegenerar && " Si lo regeneras, el anterior dejará de funcionar al momento."}</div>
          </div>
        </div>

        {/* Equipo (solo astilladoras) */}
        {esAstilladora && (
          <div className="cd-card cd-a-equipo">
            <CardHead icon={UsersRound} titulo="Equipo" />
            <div className="cd-sub">
              <div className="cd-sub-head"><UsersRound size={13} /> Trabajadores <span>{trabajadores.length}</span></div>
              {trabajadores.length ? (
                <div className="cd-personas">
                  {trabajadores.map(t => (
                    <div key={t} className="cd-persona">
                      <span className="cd-avatar">{iniciales(t)}</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              ) : <Vacio compacto icon={UsersRound} titulo="Sin trabajadores registrados" />}
            </div>
            <div className="cd-sub">
              <div className="cd-sub-head"><Truck size={13} /> Máquinas <span>{maquinas.length}</span></div>
              {maquinas.length ? (
                <div className="cd-maquinas">
                  {maquinas.map((m, i) => (
                    <div key={i} className="cd-maquina">
                      <span className="cd-maquina-icon"><Truck size={14} /></span>
                      <span className="cd-maquina-nombre">{m.nombre || 'Máquina'}</span>
                      <span className="cd-matricula">{m.matricula}</span>
                    </div>
                  ))}
                </div>
              ) : <Vacio compacto icon={Truck} titulo="Sin máquinas registradas" />}
            </div>
          </div>
        )}

        {/* Relaciones */}
        <div className={`cd-card ${esAstilladora ? 'cd-a-rel' : 'cd-a-rel-ancho'}`}>
          <CardHead icon={Network} titulo={relTitulo} extra={stats.relaciones.length || null} />
          {stats.relaciones.length ? (
            <div className="cd-rel">
              {stats.relaciones.map(([nombre, n], i) => (
                <div key={nombre} className="cd-rel-item">
                  <span className="cd-rel-rank">{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cd-rel-top"><span>{nombre}</span><b>{n} {n === 1 ? 'albarán' : 'albaranes'}</b></div>
                    <div className="cd-rel-track"><div style={{ width: `${(n / maxRel) * 100}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Vacio icon={Network} titulo="Sin datos todavía"
              texto={esAstilladora
                ? 'Cuando esta astilladora tenga albaranes, verás aquí las instalaciones a las que abastece.'
                : 'Cuando esta instalación reciba albaranes, verás aquí sus proveedores.'} />
          )}
        </div>

        {/* Últimos albaranes */}
        <div className={`cd-card cd-a-alb ${esAstilladora ? '' : 'ancho'}`} ref={refAlbaranes}>
          <CardHead icon={FileText} titulo="Últimos albaranes" extra={stats.propios.length || null} />
          {destacado ? (
            <>
              <button className="cd-alb-destacado" onClick={() => navigate(`/albaran/${destacado.id}`)}>
                <div className="cd-alb-dest-top">
                  <span className="cd-alb-dest-tag">Más reciente</span>
                  <Badge estado={destacado.estado} />
                </div>
                <div className="cd-alb-dest-id">{destacado.id}</div>
                <div className="cd-alb-dest-meta">
                  <span><Clock size={12} /> {fmtFecha(destacado.fecha)}</span>
                  <span><Icon size={12} /> {(esAstilladora ? destacado.instalacion : destacado.proveedor) || '—'}</span>
                  {netoKg(destacado) ? <span><Weight size={12} /> {fmtNum(netoKg(destacado) / 1000)} t</span> : null}
                </div>
                <ArrowUpRight size={16} className="cd-alb-dest-arrow" />
              </button>
              {resto.slice(0, 5).map(a => (
                <button key={a.id} className="cd-alb" onClick={() => navigate(`/albaran/${a.id}`)}>
                  <div className="cd-alb-info">
                    <div className="cd-alb-id">{a.id}</div>
                    <div className="cd-alb-otro">{fmtFecha(a.fecha)} · {(esAstilladora ? a.instalacion : a.proveedor) || '—'}</div>
                  </div>
                  <Badge estado={a.estado} />
                  <ChevronRight size={14} className="cli-chevron" />
                </button>
              ))}
            </>
          ) : <Vacio icon={FileText} titulo="Sin albaranes" texto="Todavía no hay albaranes asociados a este cliente." />}
        </div>
      </section>

      {editando && puedeGestionar && (
        <EmpresaModal
          empresa={cliente}
          logos={logos}
          onLogoChange={(lid, u) => setLogos(l => { const n = { ...l }; if (u) n[lid] = u; else delete n[lid]; return n })}
          onClose={() => setEditando(false)}
          onSaved={fetchCliente}
        />
      )}
    </div>
  )
}

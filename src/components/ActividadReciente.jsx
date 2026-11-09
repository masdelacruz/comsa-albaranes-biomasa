import { useMemo, useState } from 'react'
import { Activity, Check, AlertTriangle } from 'lucide-react'
import FilterSelect from './FilterSelect'

// Flujo de la última actividad: a la izquierda, cada albarán como una pista
// en el tiempo (agrupados por cliente) con un punto por suceso; a la derecha,
// los sucesos uno a uno, lo más reciente arriba. Pasar el ratón por un punto
// enseña qué pasó; pulsarlo abre el albarán.

// Tipos de suceso, en el orden del proceso. Colores validados para daltonismo
// (paleta categórica de referencia); "cerrado" e "incidencia" llevan además
// icono propio para no depender solo del color.
export const TIPOS = {
  alta:       { label: 'Alta',        color: '#2a78d6' },
  campo:      { label: 'A campo',     color: '#eda100' },
  cliente:    { label: 'Cliente',     color: '#1baf7a' },
  oficina:    { label: 'Oficina',     color: '#6250d6' },
  cerrado:    { label: 'Cerrado',     color: '#008300' },
  incidencia: { label: 'Incidencia',  color: '#d03b3b' },
  otro:       { label: 'Cambios',     color: '#b4b1aa' },
}

export function clasificar(texto = '') {
  const t = texto.toLowerCase()
  if (/⚠|rechaz|anulad|revisión/.test(t)) return 'incidencia'
  if (/cerrado/.test(t)) return 'cerrado'
  if (/creado|duplicado/.test(t)) return 'alta'
  if (/firm[óo]|complet[óo] su parte|origen indicado|desde su panel/.test(t)) return /^oficina/.test(t) ? 'oficina' : 'cliente'
  if (/campo|compartido|notific|enlace/.test(t)) return 'campo'
  if (/humedad|oficina|firmas externas/.test(t)) return 'oficina'
  return 'otro'
}

const ESTADO = {
  programado: 'Programado', pendiente_campo: 'En campo', pendiente_oficina: 'Firma de oficina',
  humedad_pendiente: 'Humedad pendiente', cerrado: 'Cerrado', anulado: 'Anulado',
}

// Instante real del suceso: `at` (ISO, de la BD); si no viene, el texto
// "9/11/2026, 10:32:15" con el que se registró.
function instante(ev) {
  if (ev.at) { const d = new Date(ev.at); if (!isNaN(d)) return d }
  const m = String(ev.ts || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (!m) return null
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
}

const limpiar = (texto = '') => texto.replace(/\s*·\s*IP:\s*[^\s·]+/g, '').trim()
const hora = d => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const inicioDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function etiquetaDiaRel(d) {
  const dif = Math.round((inicioDia(new Date()) - inicioDia(d)) / 86400000)
  const corta = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return dif === 0 ? 'Hoy' : dif === 1 ? 'Ayer' : corta.charAt(0).toUpperCase() + corta.slice(1)
}

const RANGOS = [
  { key: 'hoy', label: 'Hoy' },
  { key: '48h', label: '48 h' },
  { key: '7d',  label: '7 días' },
]

const MAX_PISTAS = 10
const PASO_FEED  = 25

export default function ActividadReciente({ albaranes, onAbrir }) {
  const [rango, setRango]       = useState('48h')
  const [clientes, setClientes] = useState([])
  const [todasPistas, setTodasPistas] = useState(false)
  const [nFeed, setNFeed]       = useState(PASO_FEED)

  const todos = useMemo(() => albaranes.flatMap(a =>
    (a.actividad || []).map((ev, i) => {
      const t = instante(ev)
      return t && {
        key: `${a.id}-${i}`, a, t, actor: ev.actor, texto: limpiar(ev.texto),
        tipo: clasificar(ev.texto), cliente: a.proveedor || a.instalacion || 'Sin cliente',
      }
    }).filter(Boolean)
  ), [albaranes])

  const ahora = new Date()
  const desde = rango === 'hoy' ? inicioDia(ahora)
    : rango === '48h' ? new Date(ahora - 48 * 3600000)
    : new Date(inicioDia(ahora) - 6 * 86400000)
  const span = ahora - desde

  const opcionesCliente = useMemo(() => [...new Set(todos.map(e => e.cliente))].sort((x, y) => x.localeCompare(y, 'es')), [todos])

  const eventos = todos
    .filter(e => e.t >= desde && e.t <= ahora && (!clientes.length || clientes.includes(e.cliente)))
    .sort((x, y) => y.t - x.t)

  // Pistas: un albarán por fila, agrupados por cliente; primero el cliente con
  // actividad más reciente y, dentro, el albarán movido más recientemente.
  const porAlbaran = new Map()
  for (const e of eventos) {
    if (!porAlbaran.has(e.a.id)) porAlbaran.set(e.a.id, { a: e.a, cliente: e.cliente, ultimo: e.t, eventos: [] })
    porAlbaran.get(e.a.id).eventos.push(e)
  }
  const pistasOrdenadas = [...porAlbaran.values()]
  const visibles = todasPistas ? pistasOrdenadas : pistasOrdenadas.slice(0, MAX_PISTAS)
  const grupos = []
  for (const p of visibles) {
    let g = grupos.find(x => x.cliente === p.cliente)
    if (!g) grupos.push(g = { cliente: p.cliente, pistas: [] })
    g.pistas.push(p)
  }

  const pos = t => `${Math.max(0, Math.min(100, ((t - desde) / span) * 100))}%`

  // Marcas del eje: inicio de cada día del rango; hoy, además, cada 3 horas
  const marcas = []
  if (rango === 'hoy') {
    for (let h = 0; h <= ahora.getHours(); h += 3) marcas.push({ t: new Date(desde.getTime() + h * 3600000), label: `${String(h).padStart(2, '0')}:00`, dia: h === 0 })
  } else {
    for (let d = inicioDia(new Date(desde.getTime() + 86400000 - 1)); d <= ahora; d = new Date(d.getTime() + 86400000)) {
      marcas.push({ t: d, label: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }), dia: true })
      if (rango === '48h') {
        const mediodia = new Date(d.getTime() + 12 * 3600000)
        if (mediodia > desde && mediodia < ahora) marcas.push({ t: mediodia, label: '12:00' })
      }
    }
  }

  // Feed agrupado por día
  const feed = eventos.slice(0, nFeed)
  const dias = []
  for (const e of feed) {
    const k = inicioDia(e.t).getTime()
    let d = dias.find(x => x.k === k)
    if (!d) dias.push(d = { k, label: etiquetaDiaRel(e.t), items: [] })
    d.items.push(e)
  }

  const resumen = `${eventos.length} ${eventos.length === 1 ? 'suceso' : 'sucesos'} · ${porAlbaran.size} ${porAlbaran.size === 1 ? 'albarán' : 'albaranes'}`

  return (
    <section className="dash-panel act" aria-label="Actividad reciente">
      <div className="dash-sec-cab act-cab">
        <span className="dash-sec-titulo"><Activity size={15} strokeWidth={1.8} /> Actividad reciente</span>
        <div className="act-filtros">
          <span className="dash-sec-sub">{resumen}</span>
          <FilterSelect label="Cliente" value={clientes} onChange={setClientes} options={opcionesCliente} />
          <div className="act-rangos" role="group" aria-label="Periodo">
            {RANGOS.map(r => (
              <button key={r.key} type="button" className={rango === r.key ? 'activo' : ''} aria-pressed={rango === r.key}
                onClick={() => setRango(r.key)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>

      {eventos.length === 0 ? (
        <div className="act-vacio">Sin actividad en este periodo{clientes.length ? ' para los clientes elegidos' : ''}.</div>
      ) : (
        <div className="act-cuerpo">
          {/* ── Flujo: una pista por albarán ── */}
          <div className="act-flujo">
            <div className="act-leyenda" aria-label="Leyenda">
              {Object.entries(TIPOS).map(([k, t]) => (
                <span key={k} className="act-ley"><Punto tipo={k} />{t.label}</span>
              ))}
            </div>

            <div className="act-tabla">
              <div className="act-fila act-eje" aria-hidden="true">
                <span className="act-lbl" />
                <span className="act-pista">
                  {marcas.map(m => (
                    <span key={m.t.getTime()} className={`act-marca${m.dia ? ' dia' : ''}`} style={{ left: pos(m.t) }}>{m.label}</span>
                  ))}
                  <span className="act-marca ahora" style={{ left: '100%' }}>ahora</span>
                </span>
                <span className="act-estado" />
              </div>

              {grupos.map(g => (
                <div key={g.cliente} className="act-grupo">
                  <div className="act-cliente">{g.cliente}</div>
                  {g.pistas.map(p => {
                    const ord = [...p.eventos].sort((x, y) => x.t - y.t)
                    const ini = ord[0].t, fin = ord[ord.length - 1].t
                    return (
                      <div key={p.a.id} className="act-fila">
                        <button type="button" className="act-lbl" onClick={() => onAbrir(p.a)} title="Abrir albarán">
                          <span className="act-id">{p.a.id}</span>
                          {p.a.instalacion && <span className="act-inst">{p.a.instalacion}</span>}
                        </button>
                        <span className="act-pista">
                          {marcas.map(m => <span key={m.t.getTime()} className={`act-grid${m.dia ? ' dia' : ''}`} style={{ left: pos(m.t) }} />)}
                          <span className="act-tramo" style={{ left: pos(ini), width: `calc(${pos(fin)} - ${pos(ini)})` }} />
                          {ord.map(e => {
                            const lado = (e.t - desde) / span > 0.6 ? 'izq' : 'der'
                            return (
                              <button key={e.key} type="button" className="act-evento" style={{ left: pos(e.t) }}
                                onClick={() => onAbrir(p.a)} aria-label={`${hora(e.t)} · ${e.texto}`}>
                                <Punto tipo={e.tipo} />
                                <span className={`act-tip ${lado}`} role="tooltip">
                                  <span className="act-tip-cab"><Punto tipo={e.tipo} /> {TIPOS[e.tipo].label} · {etiquetaDiaRel(e.t)} {hora(e.t)}</span>
                                  <span className="act-tip-txt">{e.texto}</span>
                                  <span className="act-tip-actor">{e.actor}</span>
                                </span>
                              </button>
                            )
                          })}
                        </span>
                        <span className={`act-estado ${p.a.estado}`}>{ESTADO[p.a.estado] || p.a.estado}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {pistasOrdenadas.length > MAX_PISTAS && (
              <button type="button" className="act-mas" onClick={() => setTodasPistas(v => !v)}>
                {todasPistas ? 'Ver menos' : `Ver los ${pistasOrdenadas.length} albaranes`}
              </button>
            )}
          </div>

          {/* ── Sucesos uno a uno ── */}
          <div className="act-feed">
            {dias.map(d => (
              <div key={d.k} className="act-dia">
                <div className="act-dia-cab">{d.label}</div>
                <ol className="act-lista">
                  {d.items.map(e => (
                    <li key={e.key} className={`act-item t-${e.tipo}`}>
                      <span className="act-item-hora">{hora(e.t)}</span>
                      <span className="act-item-linea"><Punto tipo={e.tipo} /></span>
                      <button type="button" className="act-item-cuerpo" onClick={() => onAbrir(e.a)} title="Abrir albarán">
                        <span className="act-item-cab"><span className="act-id">{e.a.id}</span> · {e.cliente}</span>
                        <span className="act-item-txt">{e.texto}</span>
                        <span className="act-item-actor">{e.actor}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {eventos.length > nFeed && (
              <button type="button" className="act-mas" onClick={() => setNFeed(n => n + PASO_FEED)}>
                Ver más ({eventos.length - nFeed})
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function Punto({ tipo }) {
  const c = TIPOS[tipo]?.color || TIPOS.otro.color
  if (tipo === 'cerrado') return <span className="act-punto icono" style={{ background: c }}><Check size={8} strokeWidth={3.5} /></span>
  if (tipo === 'incidencia') return <span className="act-punto icono" style={{ background: c }}><AlertTriangle size={7} strokeWidth={3} /></span>
  return <span className={`act-punto${tipo === 'otro' ? ' menor' : ''}`} style={{ background: c }} />
}

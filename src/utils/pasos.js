// Paso de campo pendiente de cada albarán y avisos al cliente.
//
// Un albarán en campo espera siempre a un cliente: el primer paso externo sin
// firmar (proveedor, astilladora o instalación). La oficina puede dejar
// constancia de que le ha avisado ("Notificado"); es solo informativo y al
// completarse el paso, el siguiente empieza sin notificar.

const ORDEN_PASOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']

export const ROL_CLIENTE = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }

export function pasoPendiente(a) {
  if (a?.estado !== 'pendiente_campo') return null
  const rol = ORDEN_PASOS.find(r => a.firmas?.[r] && !a.firmas[r].firmado)
  if (!rol) return null
  return { rol, actor: a.firmas[rol].actor || a[rol] || '', notificado: a.firmas[rol].notificado || null }
}

export const panelDeRol = (a, rol) =>
  ({ astilladora: a.panelAstilladoraUrl, instalacion: a.panelInstalacionUrl, proveedor: a.panelProveedorUrl })[rol] || null

// Albaranes en campo agrupados por el cliente al que le toca gestionarlos.
// Primero el cliente con el pendiente más antiguo.
export function pendientesPorCliente(albaranes) {
  const grupos = new Map()
  for (const a of albaranes) {
    const paso = pasoPendiente(a)
    if (!paso?.actor) continue
    const clave = `${paso.rol}|${paso.actor.toLowerCase()}`
    if (!grupos.has(clave)) grupos.set(clave, { clave, rol: paso.rol, nombre: paso.actor, albaranes: [], panelUrl: null })
    const g = grupos.get(clave)
    g.albaranes.push({ ...a, paso })
    g.panelUrl ||= panelDeRol(a, paso.rol)
  }
  return [...grupos.values()].map(g => {
    g.albaranes.sort((x, y) => `${x.fecha || ''} ${x.hora || ''}`.localeCompare(`${y.fecha || ''} ${y.hora || ''}`))
    g.sinNotificar = g.albaranes.filter(a => !a.paso.notificado)
    g.ultimoAviso = g.albaranes.map(a => a.paso.notificado).filter(Boolean)
      .sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)))[0] || null
    return g
  }).sort((x, y) => (x.albaranes[0]?.fecha || '').localeCompare(y.albaranes[0]?.fecha || ''))
}

// ── Seguimiento por día ─────────────────────────────────────────────
// Para cada cliente con algo pendiente: por cada día con trabajo suyo, cuántos
// albaranes le han llegado y cuántos ha gestionado ya ("7 de 8"). Solo cuentan
// los que ya le han llegado (no los que siguen en un paso anterior).
const ROLES_CON_PASO = ['proveedor', 'astilladora', 'instalacion']

export function estadoPasoCliente(a, rol) {
  const f = a.firmas?.[rol]
  if (!f) return null
  if (f.firmado) return 'gestionado'
  if (a.estado === `rechazado_campo_${rol}`) return 'rechazado'
  if (pasoPendiente(a)?.rol === rol) return 'pendiente'
  return null   // aún no le toca, planificado, anulado o cerrado sin su firma
}

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function seguimientoPorCliente(albaranes) {
  const hoy = hoyISO()
  const clientes = new Map()
  for (const a of albaranes) {
    for (const rol of ROLES_CON_PASO) {
      const estado = estadoPasoCliente(a, rol)
      if (!estado) continue
      const actor = a.firmas[rol].actor || a[rol]
      if (!actor) continue
      const clave = `${rol}|${actor.toLowerCase()}`
      if (!clientes.has(clave)) clientes.set(clave, { clave, rol, nombre: actor, dias: new Map() })
      const dia = (a.fecha || '').slice(0, 10) || 'sin-fecha'
      const c = clientes.get(clave)
      if (!c.dias.has(dia)) c.dias.set(dia, [])
      c.dias.get(dia).push({ a, estado, firma: a.firmas[rol] })
    }
  }
  const resultado = new Map()
  for (const c of clientes.values()) {
    // Se muestran los días con algo pendiente y, para que quede constancia, el de hoy
    const dias = [...c.dias.entries()]
      .filter(([dia, items]) => dia === hoy || items.some(i => i.estado === 'pendiente'))
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([dia, items]) => {
        items.sort((x, y) => `${x.a.hora || ''}${x.a.id}`.localeCompare(`${y.a.hora || ''}${y.a.id}`))
        const cuenta = e => items.filter(i => i.estado === e).length
        return { dia, items, total: items.length, gestionados: cuenta('gestionado'), pendientes: cuenta('pendiente'), rechazados: cuenta('rechazado') }
      })
    if (dias.some(d => d.pendientes)) resultado.set(c.clave, dias)
  }
  return resultado
}

// "Hoy · jue 06/11", "Ayer · mié 05/11", "lun 03/11"
export function etiquetaDia(dia) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return 'Sin fecha'
  const [y, m, d] = dia.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  const corta = fecha.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '')
  const dif = Math.round((new Date(new Date().toDateString()) - fecha) / 86400000)
  return dif === 0 ? `Hoy · ${corta}` : dif === 1 ? `Ayer · ${corta}` : dif === -1 ? `Mañana · ${corta}` : corta
}

const fechaCorta = f => f ? f.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—'
const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`

const QUE_TIENE = {
  astilladora:   k => `${n(k, 'albarán pendiente', 'albaranes pendientes')} de confirmar`,
  instalacion:   k => `${n(k, 'camión', 'camiones')} de camino ${k === 1 ? 'pendiente' : 'pendientes'} de confirmar la recepción`,
  proveedor:     k => `${n(k, 'suministro', 'suministros')} en ${k === 1 ? 'el' : 'los'} que falta adjuntar tu albarán`,
  transportista: k => `${n(k, 'albarán pendiente', 'albaranes pendientes')} de confirmar`,
}

const lineaAlbaran = (rol, a, fmt, conFecha = true) => {
  const id = fmt === 'wa' ? `*${a.id}*` : a.id
  const hora = a.hora ? String(a.hora).slice(0, 5) : ''
  const fecha = conFecha ? `${fechaCorta(a.fecha)}${hora ? ' ' + hora : ''}` : hora
  const resto = rol === 'instalacion'
    ? [a.transportista, [a.matriculaTractora, a.matriculaRemolque].filter(Boolean).join(' · ')]
    : [[a.especie, a.tipoBiomasa].filter(Boolean).join(' '), a.instalacion && `destino ${a.instalacion}`]
  return `• ${[id, fecha, ...resto].filter(Boolean).join(' · ')}`
}

// Lista de albaranes; si hay varios días, agrupada bajo el título de cada día
function listaPorDias(rol, albaranes, fmt) {
  const dias = [...new Set(albaranes.map(a => (a.fecha || '').slice(0, 10)))].sort()
  if (dias.length <= 1) return albaranes.map(a => lineaAlbaran(rol, a, fmt)).join('\n')
  return dias.map(dia => {
    const [y, m, d] = dia.split('-').map(Number)
    const titulo = dia
      ? new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' }).replace(',', '')
      : 'Sin fecha'
    const cab = titulo.charAt(0).toUpperCase() + titulo.slice(1)
    const lineas = albaranes.filter(a => (a.fecha || '').slice(0, 10) === dia).map(a => lineaAlbaran(rol, a, fmt, false))
    return `${fmt === 'wa' ? `_${cab}_` : cab}\n${lineas.join('\n')}`
  }).join('\n\n')
}

// Mensaje para avisar a un cliente de lo que tiene pendiente en su panel.
// fmt 'wa' usa negritas de WhatsApp; 'email' es texto plano.
export function mensajeCliente({ rol, nombre, albaranes, panelUrl, fmt = 'wa' }) {
  const lista = listaPorDias(rol, albaranes, fmt)
  const acceso = panelUrl
    ? `Accede a tu panel de Comsa Service (es siempre el mismo enlace: guárdalo y no lo compartas fuera de tu empresa):\n${panelUrl}`
    : 'Puedes gestionarlos desde tu panel de Comsa Service.'
  return `Hola${nombre ? ' ' + nombre : ''},\n\n` +
    `Tienes ${(QUE_TIENE[rol] || QUE_TIENE.astilladora)(albaranes.length)}:\n\n${lista}\n\n${acceso}` +
    (fmt === 'email' ? '\n\nGracias por tu colaboración.\n\nComsa Service — Gestión de Albaranes de Biomasa' : '')
}

export const asuntoCliente = (rol, k) =>
  `${rol === 'instalacion' ? n(k, 'camión', 'camiones') + ' en camino' : n(k, 'albarán pendiente', 'albaranes pendientes')} en tu panel · Comsa Service`

const MEDIO = { whatsapp: 'por WhatsApp', email: 'por email' }

// "Compartido por WhatsApp · hace 2 h · por Marc" (o "el 21/10")
export function textoCompartido(nt, { conQuien = false } = {}) {
  if (!nt) return ''
  const d = new Date(nt.fecha)
  const min = Math.round((Date.now() - d.getTime()) / 60000)
  const cuando = min < 1 ? 'ahora' : min < 60 ? `hace ${min} min` : min < 12 * 60 ? `hace ${Math.round(min / 60)} h`
    : `el ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`
  return [`Compartido${MEDIO[nt.medio] ? ' ' + MEDIO[nt.medio] : ''}`, cuando, conQuien && nt.por ? `por ${nt.por}` : null]
    .filter(Boolean).join(' · ')
}

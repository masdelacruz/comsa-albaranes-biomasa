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
// Primero los clientes con algo sin notificar y, dentro, los más antiguos.
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
  }).sort((x, y) => (y.sinNotificar.length > 0) - (x.sinNotificar.length > 0)
    || (x.albaranes[0]?.fecha || '').localeCompare(y.albaranes[0]?.fecha || ''))
}

const fechaCorta = f => f ? f.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—'
const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`

const QUE_TIENE = {
  astilladora:   k => `${n(k, 'albarán pendiente', 'albaranes pendientes')} de confirmar`,
  instalacion:   k => `${n(k, 'camión', 'camiones')} de camino ${k === 1 ? 'pendiente' : 'pendientes'} de confirmar la recepción`,
  proveedor:     k => `${n(k, 'suministro', 'suministros')} en ${k === 1 ? 'el' : 'los'} que falta adjuntar tu albarán`,
  transportista: k => `${n(k, 'albarán pendiente', 'albaranes pendientes')} de confirmar`,
}

const lineaAlbaran = (rol, a, fmt) => {
  const id = fmt === 'wa' ? `*${a.id}*` : a.id
  const fecha = `${fechaCorta(a.fecha)}${a.hora ? ' ' + String(a.hora).slice(0, 5) : ''}`
  const resto = rol === 'instalacion'
    ? [a.transportista, [a.matriculaTractora, a.matriculaRemolque].filter(Boolean).join(' · ')]
    : [[a.especie, a.tipoBiomasa].filter(Boolean).join(' '), a.instalacion && `destino ${a.instalacion}`]
  return `• ${[id, fecha, ...resto].filter(Boolean).join(' · ')}`
}

// Mensaje para avisar a un cliente de lo que tiene pendiente en su panel.
// fmt 'wa' usa negritas de WhatsApp; 'email' es texto plano.
export function mensajeCliente({ rol, nombre, albaranes, panelUrl, fmt = 'wa' }) {
  const lista = albaranes.map(a => lineaAlbaran(rol, a, fmt)).join('\n')
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

// "Notificado por WhatsApp · hace 2 h" (o "hoy 10:32", "el 21/10")
export function textoNotificado(nt, { conQuien = false } = {}) {
  if (!nt) return ''
  const d = new Date(nt.fecha)
  const min = Math.round((Date.now() - d.getTime()) / 60000)
  const cuando = min < 1 ? 'ahora' : min < 60 ? `hace ${min} min` : min < 12 * 60 ? `hace ${Math.round(min / 60)} h`
    : `el ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`
  return [`Notificado${MEDIO[nt.medio] ? ' ' + MEDIO[nt.medio] : ''}`, cuando, conQuien && nt.por ? `por ${nt.por}` : null]
    .filter(Boolean).join(' · ')
}

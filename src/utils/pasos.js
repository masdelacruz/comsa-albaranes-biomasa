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

const n = (k, uno, varios) => `${k} ${k === 1 ? uno : varios}`

const QUE_TIENE = {
  astilladora:   k => `${n(k, 'albarán pendiente', 'albaranes pendientes')} de confirmar`,
  instalacion:   k => `${n(k, 'camión', 'camiones')} de camino ${k === 1 ? 'pendiente' : 'pendientes'} de confirmar la recepción`,
  proveedor:     k => `${n(k, 'suministro', 'suministros')} en ${k === 1 ? 'el' : 'los'} que falta adjuntar tu albarán`,
  transportista: k => `${n(k, 'albarán pendiente', 'albaranes pendientes')} de confirmar`,
}

// ── Ficha de carga en los mensajes ──────────────────────────────────
// Los albaranes que coinciden en todo lo que se escribe en el albarán (origen,
// destino, proveedor, permiso, material, transportista, astilladora) van en un
// mismo bloque; si algo cambia, bloque aparte. Cada bloque:
//   LUNES 09/11/2026 · 20:00
//   AP7 Hospitalet de l'Infant → Termosolar Borges
//   (albaranes del bloque con hora y matrícula)
//   Mapas de origen y destino
//   Datos para el albarán (transportista, proveedor, material, permiso…)
const CAMPOS_FICHA = [
  ['transportista', 'Transportista'],
  ['proveedor',     'Proveedor'],
  ['tipoBiomasa',   'Tipo de biomasa'],
  ['estella',       'Estella'],
  ['especie',       'Especie'],
  ['astilladora',   'Astilladora'],
  ['permiso',       'Permiso'],
  ['origen',        'Origen'],
  ['instalacion',   'Destino'],
]
const CLAVE_GRUPO = [...CAMPOS_FICHA.map(([k]) => k), 'mapsOrigen', 'mapsDestino']

const diaLargo = f => {
  if (!f) return 'Sin fecha'
  const [y, m, d] = f.slice(0, 10).split('-').map(Number)
  const t = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(',', '')
  return t.toUpperCase()
}
const diaCorto = f => {
  if (!f) return ''
  const [y, m, d] = f.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', '')
}
const horaDe = a => (a.hora ? String(a.hora).slice(0, 5) : '')
const limpio = v => String(v ?? '').trim()

function agruparPorFicha(albaranes) {
  const grupos = new Map()
  const orden = [...albaranes].sort((x, y) => `${x.fecha || ''} ${horaDe(x)} ${x.id}`.localeCompare(`${y.fecha || ''} ${horaDe(y)} ${y.id}`))
  for (const a of orden) {
    const clave = CLAVE_GRUPO.map(k => limpio(a[k]).toLowerCase()).join('|')
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(a)
  }
  return [...grupos.values()]
}

// fmt 'wa' usa negritas de WhatsApp; 'email' es texto plano
export function fichaAlbaranes(albaranes, fmt = 'wa') {
  const b = t => (fmt === 'wa' ? `*${t}*` : t)
  const separador = fmt === 'wa' ? '\n\n——————————\n\n' : '\n\n----------------------------------------\n\n'
  return agruparPorFicha(albaranes).map(grupo => {
    const p = grupo[0]
    const mismoDia = grupo.every(a => (a.fecha || '') === (p.fecha || ''))
    const mismaHora = mismoDia && grupo.every(a => horaDe(a) === horaDe(p))
    const ruta = [limpio(p.origen) || 'Origen por confirmar', limpio(p.instalacion) || 'destino por confirmar'].join(' → ')
    const obsComun = grupo.every(a => limpio(a.observaciones) === limpio(p.observaciones)) ? limpio(p.observaciones) : null

    const lineas = []
    // Cabecera: fecha (y hora) si es común, y la ruta
    if (mismoDia) lineas.push(b(`${diaLargo(p.fecha)}${mismaHora && horaDe(p) ? ' · ' + horaDe(p) : ''}`))
    lineas.push(b(ruta))
    // Albaranes del bloque: id, (día) hora, matrícula, conductor y observaciones propias
    for (const a of grupo) {
      const matricula = [a.matriculaTractora, a.matriculaRemolque].filter(Boolean).join(' / ')
      const cuando = mismoDia ? (mismaHora ? '' : horaDe(a)) : [diaCorto(a.fecha), horaDe(a)].filter(Boolean).join(' ')
      const partes = [`Albarán ${a.id}`, cuando, matricula, a.chofer && `conductor ${a.chofer}`,
        !obsComun && limpio(a.observaciones) && `obs.: ${limpio(a.observaciones)}`]
      lineas.push(`${grupo.length > 1 ? '• ' : ''}${partes.filter(Boolean).join(' · ')}`)
    }
    // Mapas
    const mapas = [
      limpio(p.mapsOrigen) && `${fmt === 'wa' ? '📍 ' : ''}${b('Origen:')} ${limpio(p.mapsOrigen)}`,
      limpio(p.mapsDestino) && `${fmt === 'wa' ? '🏁 ' : ''}${b('Destino:')} ${limpio(p.mapsDestino)}`,
    ].filter(Boolean)
    if (mapas.length) lineas.push('', ...mapas)
    // Datos que hay que poner en el albarán
    const datos = CAMPOS_FICHA.map(([k, etiqueta]) => limpio(p[k]) && `- ${etiqueta}: ${limpio(p[k])}`).filter(Boolean)
    if (obsComun) datos.push(`- Observaciones: ${obsComun}`)
    if (datos.length) lineas.push('', b('Datos para el albarán'), ...datos)
    return lineas.join('\n')
  }).join(separador)
}

// Mensaje para avisar a un cliente de lo que tiene pendiente en su panel.
// fmt 'wa' usa negritas de WhatsApp; 'email' es texto plano.
export function mensajeCliente({ rol, nombre, albaranes, panelUrl, fmt = 'wa' }) {
  const lista = fichaAlbaranes(albaranes, fmt)
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

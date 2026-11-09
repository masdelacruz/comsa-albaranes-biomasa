// Trayecto estimado entre los enlaces de mapa de origen y destino de un
// albarán, para dar a la instalación una hora de llegada aproximada.
//
// · Coordenadas: se leen del propio enlace (Google Maps / OSM). Los enlaces
//   cortos (maps.app.goo.gl) se resuelven siguiendo la redirección, solo para
//   una lista cerrada de dominios de mapas, por HTTPS y con tiempo límite
//   (evita usar el servidor para pedir URLs arbitrarias — SSRF). Si el enlace
//   solo trae un nombre de lugar, se geocodifica con Nominatim (OSM).
// · Ruta: OSRM (OpenStreetMap). A los servicios externos solo viajan
//   coordenadas o el nombre del lugar; ningún dato del albarán ni personal.
// · Un camión va más lento que un turismo: se aplica un factor a la duración.
// · Todo queda en caché en memoria para no repetir consultas.

const FACTOR_CAMION = 1.25
const TIMEOUT_MS = 6000
const TTL_MS = 7 * 24 * 3600 * 1000
const MAX_CACHE = 2000

const HOSTS_CORTOS = new Set(['maps.app.goo.gl', 'goo.gl'])
const esHostMapas = h => /(^|\.)google\.[a-z.]+$/.test(h) || HOSTS_CORTOS.has(h) || /(^|\.)openstreetmap\.org$/.test(h)

const cache = new Map()
function deCache(k) {
  const e = cache.get(k)
  if (!e) return undefined
  if (Date.now() - e.t > TTL_MS) { cache.delete(k); return undefined }
  return e.v
}
function aCache(k, v) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value)
  cache.set(k, { t: Date.now(), v })
  return v
}

async function pedir(url, opts = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': 'comsa-albaranes/1.0 (llegada estimada)', ...(opts.headers || {}) } })
  } finally { clearTimeout(timer) }
}

const valido = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)

function coordsDeTexto(texto) {
  const s = decodeURIComponent(String(texto || '')).replace(/\+/g, ' ')
  const patrones = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,                                    // pin del lugar
    /[?&](?:q|query|ll|destination|daddr|center|mlat)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,                                                  // centro del mapa
    /#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/,                                        // OSM
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,                                      // "41.5, 1.2"
  ]
  for (const p of patrones) {
    const m = s.match(p)
    if (m && valido(+m[1], +m[2])) return { lat: +m[1], lng: +m[2] }
  }
  return null
}

function lugarDeTexto(url) {
  try {
    const u = new URL(url)
    const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination')
    if (q) return q
    const m = u.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/)
    return m ? decodeURIComponent(m[1]).replace(/\+/g, ' ') : null
  } catch { return null }
}

async function geocodificar(lugar) {
  const k = `geo:${lugar.toLowerCase()}`
  const c = deCache(k); if (c !== undefined) return c
  try {
    const r = await pedir(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q=${encodeURIComponent(lugar)}`)
    const j = await r.json()
    const res = j?.[0] && valido(+j[0].lat, +j[0].lon) ? { lat: +j[0].lat, lng: +j[0].lon } : null
    return aCache(k, res)
  } catch { return null }
}

async function coordsDeEnlace(enlace) {
  if (!enlace) return null
  const directo = coordsDeTexto(enlace)
  if (directo) return directo
  const k = `url:${enlace}`
  const c = deCache(k); if (c !== undefined) return c

  let url = String(enlace).trim()
  for (let salto = 0; salto < 4; salto++) {
    let u
    try { u = new URL(url) } catch { return aCache(k, null) }
    if (u.protocol !== 'https:' || !esHostMapas(u.hostname)) break
    const enUrl = coordsDeTexto(url)
    if (enUrl) return aCache(k, enUrl)
    if (!HOSTS_CORTOS.has(u.hostname)) break
    try {
      const r = await pedir(url, { redirect: 'manual' })
      const loc = r.headers.get('location')
      if (!loc) break
      url = new URL(loc, url).toString()
    } catch { break }
  }
  const final = coordsDeTexto(url)
  if (final) return aCache(k, final)
  const lugar = lugarDeTexto(url)
  return aCache(k, lugar ? await geocodificar(lugar) : null)
}

function haversineKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// → { distanciaKm, minutos, aproximada } o null si no se puede calcular
async function trayectoEstimado(mapsOrigen, mapsDestino) {
  const [o, d] = await Promise.all([coordsDeEnlace(mapsOrigen), coordsDeEnlace(mapsDestino)])
  if (!o || !d) return null
  const k = `ruta:${o.lat.toFixed(5)},${o.lng.toFixed(5)};${d.lat.toFixed(5)},${d.lng.toFixed(5)}`
  const c = deCache(k); if (c !== undefined) return c
  try {
    const r = await pedir(`https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=false`)
    const j = await r.json()
    const ruta = j?.code === 'Ok' && j.routes?.[0]
    if (ruta) {
      return aCache(k, {
        distanciaKm: Math.round(ruta.distance / 1000),
        minutos: Math.round((ruta.duration / 60) * FACTOR_CAMION),
        aproximada: false,
      })
    }
  } catch { /* sin servicio de rutas: estimación en línea recta */ }
  // Sin ruta: distancia en línea recta × 1,3 a 60 km/h de media (no se cachea
  // para reintentar la ruta real en la siguiente consulta)
  const km = haversineKm(o, d) * 1.3
  return { distanciaKm: Math.round(km), minutos: Math.round(km / 60 * 60), aproximada: true }
}

module.exports = { trayectoEstimado, coordsDeEnlace, coordsDeTexto }

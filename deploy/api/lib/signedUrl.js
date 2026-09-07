const crypto = require('crypto')

const SECRET = process.env.JWT_SECRET
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h — cubre una sesión de oficina/campo sin refrescar la página

// El bucket es privado; nadie puede leer un objeto de MinIO sin pasar por
// aquí. Firmamos el path con HMAC-SHA256 en vez de usar presignedGetObject
// de MinIO porque el propio MinIO no está expuesto a internet (solo la API
// lo alcanza dentro de la red docker) — la URL firmada apunta siempre a
// nuestra propia API, que hace de proxy autorizado hacia el objeto.
function signPath(path, ttlMs = DEFAULT_TTL_MS) {
  if (!path) return null
  const clean = toPath(path)
  const exp = Date.now() + ttlMs
  const sig = crypto.createHmac('sha256', SECRET).update(`${clean}:${exp}`).digest('hex')
  return `${process.env.APP_URL}/api/storage/file/${clean}?exp=${exp}&sig=${sig}`
}

function verifySignedPath(path, exp, sig) {
  if (!path || !exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || Date.now() > expNum) return false
  const expected = crypto.createHmac('sha256', SECRET).update(`${path}:${expNum}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(String(sig), 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Compatibilidad con datos antiguos: antes de esta entrega se guardaba la
// URL pública completa en BD. Si nos llega eso, nos quedamos solo con el path.
function toPath(urlOrPath) {
  if (!urlOrPath) return urlOrPath
  const marker = '/api/storage/file/'
  const idx = urlOrPath.indexOf(marker)
  if (idx === -1) return urlOrPath
  return urlOrPath.slice(idx + marker.length).split('?')[0]
}

module.exports = { signPath, verifySignedPath, toPath }

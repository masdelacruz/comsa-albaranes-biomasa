const jwt    = require('jsonwebtoken')
const crypto = require('crypto')
const pool   = require('../db')

const SECRET = process.env.JWT_SECRET

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Intenta autenticar por sesión de oficina (JWT). Si hay cabecera Authorization
// pero no es válida, no corta la petición aquí: puede que quien llama sea un
// actor de campo con una sesión de oficina caducada en el mismo navegador —
// se deja caer al siguiente paso (token de campo).
async function tryAuth(req) {
  const header = req.headers.authorization || ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!bearer) return false
  try {
    const claims = jwt.verify(bearer, SECRET)
    const { rows } = await pool.query(
      `SELECT id, nombre, email, rol, nivel, activo, COALESCE(token_version, 1) AS token_version
       FROM usuarios WHERE id=$1`,
      [claims.id]
    )
    const user = rows[0]
    if (!user || !user.activo) return false
    if (claims.ver !== user.token_version) return false
    req.user = user
    return true
  } catch {
    return false
  }
}

// Autoriza una acción pública de campo: o bien el llamante tiene sesión de
// oficina válida (req.user queda poblado), o bien presenta el token de
// enlace de campo del albarán concreto (query ?t= o body.token).
// El id del albarán se lee de req.params.id o req.params.albaranId.
function requireAuthOrCampoToken() {
  return async function (req, res, next) {
    if (await tryAuth(req)) return next()

    const id = req.params.id || req.params.albaranId
    const token = req.query.t || req.body?.token
    if (!id || !token) return res.status(401).json({ error: 'Enlace no válido' })

    const { rows } = await pool.query('SELECT campo_token FROM albaranes WHERE id=$1', [id])
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
    if (!constantTimeEqual(rows[0].campo_token, String(token))) {
      return res.status(403).json({ error: 'Enlace no válido o revocado' })
    }
    next()
  }
}

// Autoriza el panel público de una empresa (instalación/astilladora): o bien
// sesión de oficina válida, o bien el código de acceso propio de esa empresa
// (query ?c=). El nombre viaja en la URL desde siempre (no es secreto); lo
// que ahora hace falta además es el código para poder leer su cola de
// entregas — adivinar el nombre ya no basta.
function requireAuthOrEmpresaCodigo(tipoFijo) {
  return async function (req, res, next) {
    if (await tryAuth(req)) return next()

    const tipo   = tipoFijo || req.params.tipo
    const nombre = decodeURIComponent(req.params.nombre).replace(/-/g, ' ')
    const codigo = req.query.c
    if (!codigo) return res.status(401).json({ error: 'Falta el código de acceso' })

    const { rows } = await pool.query(
      'SELECT acceso_codigo FROM proveedores WHERE tipo=$1 AND nombre=$2',
      [tipo, nombre]
    )
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
    if (!constantTimeEqual(rows[0].acceso_codigo, String(codigo))) {
      return res.status(403).json({ error: 'Código de acceso incorrecto' })
    }
    next()
  }
}

module.exports = { requireAuthOrCampoToken, requireAuthOrEmpresaCodigo }

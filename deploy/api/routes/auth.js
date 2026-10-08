const router  = require('express').Router()
const bcrypt  = require('bcrypt')
const jwt     = require('jsonwebtoken')
const pool    = require('../db')
const { registrarAuditoria } = require('../lib/auditoria')
const sso     = require('./auth-microsoft')

// Con AZURE_AD_ENFORCE=true, las cuentas de los dominios corporativos
// (AZURE_AD_ALLOWED_DOMAINS) solo pueden entrar con Microsoft, así se les
// aplican MFA y acceso condicional. Las de otros dominios (cuenta de
// emergencia, externos) siguen pudiendo usar contraseña.
const SSO_OBLIGATORIO = sso.enabled && process.env.AZURE_AD_ENFORCE === 'true'
const exigeSso = email => SSO_OBLIGATORIO && sso.DOMINIOS.some(d => email.endsWith(`@${d}`))

const SECRET  = process.env.JWT_SECRET
const EXPIRY  = '8h'

function passwordPolicy(password) {
  if (typeof password !== 'string' || password.length < 12)
    return 'La contraseña debe tener al menos 12 caracteres'
  if (Buffer.byteLength(password, 'utf8') > 72)
    return 'La contraseña no puede superar 72 bytes'
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))
    return 'La contraseña debe incluir mayúsculas, minúsculas, números y símbolos'
  return null
}

// ── Rate limit en login: máx 10 intentos / 15 min por IP ─────────
// req.ip ya es la IP real del cliente (trust proxy = 1, la añade Apache);
// leer X-Forwarded-For a mano permitiría falsearla y saltarse el límite.
const _loginAttempts = new Map()
function loginRateLimit(req, res, next) {
  const ip  = req.ip || 'unknown'
  const now = Date.now()
  if (_loginAttempts.size > 10000) {
    for (const [k, v] of _loginAttempts) if (!v.some(t => now - t < 15 * 60 * 1000)) _loginAttempts.delete(k)
  }
  const prev = (_loginAttempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000)
  if (prev.length >= 10) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' })
  }
  prev.push(now)
  _loginAttempts.set(ip, prev)
  next()
}

// ── Middleware: verifica JWT ──────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    const claims = jwt.verify(token, SECRET, { algorithms: ['HS256'] })
    const { rows } = await pool.query(
      `SELECT id, nombre, email, rol, nivel, activo, acceso_biomasa, acceso_trabajo,
              COALESCE(token_version, 1) AS token_version
       FROM usuarios WHERE id=$1`,
      [claims.id]
    )
    const user = rows[0]
    if (!user || !user.activo) return res.status(403).json({ error: 'cuenta_bloqueada' })
    if (claims.ver !== user.token_version) return res.status(401).json({ error: 'Sesión revocada' })
    // Si el SSO pasa a ser obligatorio, las sesiones abiertas antes con
    // contraseña en cuentas corporativas dejan de valer.
    if (claims.amr !== 'azure_ad' && exigeSso(String(user.email || '').toLowerCase()))
      return res.status(401).json({ error: 'usar_microsoft' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// ── Middleware: nivel 'usuario' o 'superadmin' (bloquea 'basico') ──
function requireConfigAccess(req, res, next) {
  if (req.user?.nivel === 'basico')
    return res.status(403).json({ error: 'Sin acceso a Configuración' })
  next()
}

// ── Middleware: solo 'superadmin' ──
function requireSuperadmin(req, res, next) {
  if (req.user?.nivel !== 'superadmin')
    return res.status(403).json({ error: 'Solo superadmin' })
  next()
}

// ── POST /auth/login ──────────────────────────────────────────────
router.post('/login', loginRateLimit, async (req, res) => {
  const { email: emailRaw, password } = req.body
  if (typeof emailRaw !== 'string' || typeof password !== 'string' || !emailRaw || !password)
    return res.status(400).json({ error: 'Faltan campos' })
  const email = emailRaw.trim().toLowerCase()
  const fallo = (motivo, u = null) => registrarAuditoria({
    usuario: u || { nombre: 'Anónimo' }, accion: 'login_fallido', entidad: 'sesion', entidadId: u?.id,
    detalle: `Contraseña · ${motivo} · ${email.slice(0, 120)} · IP ${req.ip}`,
  })

  if (exigeSso(email)) {
    fallo('intento con contraseña en cuenta que debe usar Microsoft')
    return res.status(403).json({ error: 'usar_microsoft' })
  }

  const { rows } = await pool.query(
    'SELECT * FROM usuarios WHERE email = $1', [email]
  )
  const user = rows[0]
  if (!user) { fallo('usuario inexistente'); return res.status(401).json({ error: 'Email o contraseña incorrectos' }) }
  if (!user.activo) { fallo('cuenta desactivada', user); return res.status(403).json({ error: 'cuenta_bloqueada' }) }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) { fallo('contraseña incorrecta', user); return res.status(401).json({ error: 'Email o contraseña incorrectos' }) }

  _loginAttempts.delete(req.ip || 'unknown')
  registrarAuditoria({
    usuario: user, accion: 'login', entidad: 'sesion', entidadId: user.id,
    detalle: `Contraseña · ${email} · IP ${req.ip}`,
  })

  const token = jwt.sign(
    { id: user.id, ver: user.token_version || 1 },
    SECRET,
    { expiresIn: EXPIRY }
  )

  res.json({
    token,
    user: {
      id: user.id, nombre: user.nombre, email: user.email,
      rol: user.rol, nivel: user.nivel, activo: user.activo,
      notificaciones: user.notificaciones || {},
      acceso_biomasa: user.acceso_biomasa, acceso_trabajo: user.acceso_trabajo,
    },
  })
})

// ── GET /auth/me ──────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, email, rol, nivel, activo, notificaciones, acceso_biomasa, acceso_trabajo FROM usuarios WHERE id = $1',
    [req.user.id]
  )
  const user = rows[0]
  if (!user)        return res.status(404).json({ error: 'Usuario no encontrado' })
  if (!user.activo) return res.status(403).json({ error: 'cuenta_bloqueada' })
  res.json({ user: { ...user, notificaciones: user.notificaciones || {} } })
})

module.exports = router
module.exports.requireAuth = requireAuth
module.exports.requireConfigAccess = requireConfigAccess
module.exports.requireSuperadmin = requireSuperadmin
module.exports.passwordPolicy = passwordPolicy
module.exports.ssoObligatorio = () => SSO_OBLIGATORIO

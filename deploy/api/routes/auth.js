const router  = require('express').Router()
const bcrypt  = require('bcrypt')
const jwt     = require('jsonwebtoken')
const pool    = require('../db')

const SECRET  = process.env.JWT_SECRET
const EXPIRY  = '8h'

// ── Middleware: verifica JWT ──────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// ── POST /auth/login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' })

  const { rows } = await pool.query(
    'SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase()]
  )
  const user = rows[0]
  if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' })
  if (!user.activo) return res.status(403).json({ error: 'cuenta_bloqueada' })

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' })

  const token = jwt.sign(
    { id: user.id, email: user.email, nivel: user.nivel, nombre: user.nombre },
    SECRET,
    { expiresIn: EXPIRY }
  )

  res.json({
    token,
    user: {
      id: user.id, nombre: user.nombre, email: user.email,
      rol: user.rol, nivel: user.nivel, activo: user.activo,
      notificaciones: user.notificaciones || {},
    },
  })
})

// ── GET /auth/me ──────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, email, rol, nivel, activo, notificaciones FROM usuarios WHERE id = $1',
    [req.user.id]
  )
  const user = rows[0]
  if (!user)        return res.status(404).json({ error: 'Usuario no encontrado' })
  if (!user.activo) return res.status(403).json({ error: 'cuenta_bloqueada' })
  res.json({ user: { ...user, notificaciones: user.notificaciones || {} } })
})

module.exports = router
module.exports.requireAuth = requireAuth

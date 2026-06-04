const router = require('express').Router()
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const pool   = require('../db')
const { requireAuth } = require('./auth')

const SALT_ROUNDS = 12

function requireSuperadmin(req, res, next) {
  if (req.user?.nivel !== 'superadmin')
    return res.status(403).json({ error: 'Solo superadmin' })
  next()
}

const SELECT_COLS = 'id, nombre, email, rol, nivel, activo, notificaciones'

// ── GET /usuarios ─────────────────────────────────────────────────
router.get('/', requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM usuarios ORDER BY nombre`
  )
  res.json(rows)
})

// ── PATCH /usuarios/me/notificaciones  (cualquier usuario) ───────
router.patch('/me/notificaciones', requireAuth, async (req, res) => {
  const { notificaciones } = req.body
  if (!notificaciones || typeof notificaciones !== 'object')
    return res.status(400).json({ error: 'Datos inválidos' })

  await pool.query(
    'UPDATE usuarios SET notificaciones=$1 WHERE id=$2',
    [JSON.stringify(notificaciones), req.user.id]
  )
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM usuarios WHERE id=$1`, [req.user.id]
  )
  res.json(rows[0])
})

// ── POST /usuarios  (solo superadmin) ────────────────────────────
router.post('/', requireAuth, requireSuperadmin, async (req, res) => {
  const { nombre, email, rol, nivel, password } = req.body
  const pw   = password || 'Comsa2025!'
  const hash = await bcrypt.hash(pw, SALT_ROUNDS)
  const id   = uuidv4()

  await pool.query(
    `INSERT INTO usuarios (id, nombre, email, password_hash, password_visible, rol, nivel, activo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    [id, nombre, email.toLowerCase(), hash, pw, rol, nivel || 'usuario']
  )
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM usuarios WHERE id=$1`, [id]
  )
  res.json(rows[0])
})

// ── PATCH /usuarios/:id  (solo superadmin) ───────────────────────
router.patch('/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const { nombre, rol, nivel, password, activo, notificaciones } = req.body
  const updates = []
  const vals    = []
  let idx = 1

  if (nombre          !== undefined) { updates.push(`nombre=$${idx++}`);         vals.push(nombre) }
  if (rol             !== undefined) { updates.push(`rol=$${idx++}`);            vals.push(rol) }
  if (nivel           !== undefined) { updates.push(`nivel=$${idx++}`);          vals.push(nivel) }
  if (activo          !== undefined) { updates.push(`activo=$${idx++}`);         vals.push(activo) }
  if (notificaciones  !== undefined) { updates.push(`notificaciones=$${idx++}`); vals.push(JSON.stringify(notificaciones)) }
  if (password) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    updates.push(`password_hash=$${idx++}`, `password_visible=$${idx++}`)
    vals.push(hash, password)
  }

  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' })

  vals.push(req.params.id)
  await pool.query(
    `UPDATE usuarios SET ${updates.join(', ')} WHERE id=$${idx}`, vals
  )
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM usuarios WHERE id=$1`, [req.params.id]
  )
  res.json(rows[0])
})

// ── DELETE /usuarios/:id  (solo superadmin) ──────────────────────
router.delete('/:id', requireAuth, requireSuperadmin, async (req, res) => {
  await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router

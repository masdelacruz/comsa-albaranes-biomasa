const router = require('express').Router()
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const pool   = require('../db')
const { requireAuth, passwordPolicy } = require('./auth')
const { registrarAuditoria } = require('../lib/auditoria')

const SALT_ROUNDS = 12
const NIVELES = new Set(['basico', 'usuario', 'superadmin'])

function requireSuperadmin(req, res, next) {
  if (req.user?.nivel !== 'superadmin')
    return res.status(403).json({ error: 'Solo superadmin' })
  next()
}

const SELECT_COLS = 'id, nombre, email, rol, nivel, activo, notificaciones, acceso_biomasa, acceso_trabajo'

// ── GET /usuarios ─────────────────────────────────────────────────
router.get('/', requireAuth, requireSuperadmin, async (_req, res) => {
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
  const { nombre, email, rol, nivel, password, acceso_biomasa, acceso_trabajo } = req.body
  if (!nombre?.trim() || !email?.trim()) return res.status(400).json({ error: 'Nombre y email son obligatorios' })
  if (!NIVELES.has(nivel || 'usuario')) return res.status(400).json({ error: 'Nivel inválido' })
  const policyError = passwordPolicy(password)
  if (policyError) return res.status(400).json({ error: policyError })
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const id   = uuidv4()

  await pool.query(
    `INSERT INTO usuarios (id, nombre, email, password_hash, rol, nivel, activo, acceso_biomasa, acceso_trabajo)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)`,
    [id, nombre, email.toLowerCase(), hash, rol, nivel || 'usuario',
     acceso_biomasa !== false, acceso_trabajo !== false]
  )
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM usuarios WHERE id=$1`, [id]
  )
  registrarAuditoria({
    usuario: req.user, accion: 'crear', entidad: 'usuario', entidadId: id,
    detalle: `Usuario creado: ${nombre} (${email.toLowerCase()}) · nivel ${nivel || 'usuario'}`,
  })
  res.json(rows[0])
})

// ── PATCH /usuarios/:id  (solo superadmin) ───────────────────────
router.patch('/:id', requireAuth, requireSuperadmin, async (req, res) => {
  const { nombre, rol, nivel, password, activo, notificaciones, acceso_biomasa, acceso_trabajo } = req.body
  const updates = []
  const vals    = []
  let idx = 1

  if (nivel !== undefined && !NIVELES.has(nivel)) return res.status(400).json({ error: 'Nivel inválido' })
  if (req.params.id === req.user.id && (activo === false || (nivel && nivel !== 'superadmin')))
    return res.status(400).json({ error: 'No puedes desactivar ni degradar tu propia cuenta' })

  if (nombre          !== undefined) { updates.push(`nombre=$${idx++}`);         vals.push(nombre) }
  if (rol             !== undefined) { updates.push(`rol=$${idx++}`);            vals.push(rol) }
  if (nivel           !== undefined) { updates.push(`nivel=$${idx++}`);          vals.push(nivel) }
  if (activo          !== undefined) { updates.push(`activo=$${idx++}`);         vals.push(activo) }
  if (notificaciones  !== undefined) { updates.push(`notificaciones=$${idx++}`); vals.push(JSON.stringify(notificaciones)) }
  if (acceso_biomasa  !== undefined) { updates.push(`acceso_biomasa=$${idx++}`); vals.push(acceso_biomasa) }
  if (acceso_trabajo  !== undefined) { updates.push(`acceso_trabajo=$${idx++}`); vals.push(acceso_trabajo) }
  if (password) {
    const policyError = passwordPolicy(password)
    if (policyError) return res.status(400).json({ error: policyError })
    const hash = await bcrypt.hash(password, SALT_ROUNDS)
    updates.push(`password_hash=$${idx++}`)
    vals.push(hash)
  }

  const revocaSesion = activo !== undefined || nivel !== undefined || password ||
    acceso_biomasa !== undefined || acceso_trabajo !== undefined
  if (revocaSesion) updates.push('token_version=COALESCE(token_version, 1)+1')

  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' })

  vals.push(req.params.id)
  await pool.query(
    `UPDATE usuarios SET ${updates.join(', ')} WHERE id=$${idx}`, vals
  )
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM usuarios WHERE id=$1`, [req.params.id]
  )

  const cambios = []
  if (nombre          !== undefined) cambios.push(`nombre → "${nombre}"`)
  if (rol             !== undefined) cambios.push(`rol → "${rol}"`)
  if (nivel           !== undefined) cambios.push(`nivel → "${nivel}"`)
  if (activo          !== undefined) cambios.push(`cuenta ${activo ? 'activada' : 'desactivada'}`)
  if (acceso_biomasa  !== undefined) cambios.push(`acceso Biomasa → ${acceso_biomasa}`)
  if (acceso_trabajo  !== undefined) cambios.push(`acceso Trabajo → ${acceso_trabajo}`)
  if (password) cambios.push('contraseña restablecida')
  if (cambios.length) {
    registrarAuditoria({
      usuario: req.user, accion: 'editar', entidad: 'usuario', entidadId: req.params.id,
      detalle: `Usuario editado: ${rows[0]?.nombre || req.params.id} — ${cambios.join(', ')}`,
    })
  }
  res.json(rows[0])
})

// ── DELETE /usuarios/:id  (solo superadmin) ──────────────────────
router.delete('/:id', requireAuth, requireSuperadmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' })
  const { rows } = await pool.query('SELECT nombre, email FROM usuarios WHERE id=$1', [req.params.id])
  await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id])
  registrarAuditoria({
    usuario: req.user, accion: 'borrar', entidad: 'usuario', entidadId: req.params.id,
    detalle: rows[0] ? `Usuario eliminado: ${rows[0].nombre} (${rows[0].email})` : 'Usuario eliminado',
  })
  res.json({ ok: true })
})

module.exports = router

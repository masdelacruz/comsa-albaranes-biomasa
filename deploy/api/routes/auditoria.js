const router = require('express').Router()
const pool   = require('../db')
const { requireAuth } = require('./auth')

function requireSuperadmin(req, res, next) {
  if (req.user?.nivel !== 'superadmin')
    return res.status(403).json({ error: 'Solo superadmin' })
  next()
}

// ── GET /auditoria  (solo superadmin) ─────────────────────────────
router.get('/', requireAuth, requireSuperadmin, async (req, res) => {
  const limit  = Math.min(Math.max(parseInt(req.query.limit, 10)  || 50, 1), 200)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

  const filtros = []
  const vals    = []
  if (req.query.entidad) { vals.push(req.query.entidad); filtros.push(`entidad = $${vals.length}`) }
  if (req.query.accion)  { vals.push(req.query.accion);  filtros.push(`accion = $${vals.length}`) }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''

  vals.push(limit, offset)
  const { rows } = await pool.query(
    `SELECT * FROM auditoria ${where} ORDER BY created_at DESC LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
    vals
  )
  res.json(rows)
})

module.exports = router

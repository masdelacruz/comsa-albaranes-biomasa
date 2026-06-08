const router = require('express').Router()
const { v4: uuidv4 } = require('uuid')
const pool   = require('../db')
const { requireAuth } = require('./auth')

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── GET /empresas?tipo=astilladora ────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { tipo, activo } = req.query
  let query = 'SELECT * FROM proveedores WHERE 1=1'
  const vals = []
  if (tipo)   { vals.push(tipo);   query += ` AND tipo=$${vals.length}` }
  if (activo) { vals.push(activo === 'true'); query += ` AND activo=$${vals.length}` }
  query += ' ORDER BY nombre'
  const { rows } = await pool.query(query, vals)
  res.json(rows)
})

// ── POST /empresas ────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { nombre, tipo, contacto, email, telefono, notas, activo, trabajadores, maquinas } = req.body
  const id = uuidv4()
  await pool.query(
    `INSERT INTO proveedores (id,nombre,tipo,contacto,email,telefono,notas,activo,trabajadores,maquinas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, toTitleCase(nombre), tipo, toTitleCase(contacto)||null, email||null, telefono||null, notas||null, activo??true,
     JSON.stringify(trabajadores||[]), JSON.stringify(maquinas||[])]
  )
  const { rows } = await pool.query('SELECT * FROM proveedores WHERE id=$1', [id])
  res.json(rows[0])
})

// ── PATCH /empresas/:id ───────────────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  if (req.body.nombre) req.body.nombre = toTitleCase(req.body.nombre)
  if (req.body.contacto) req.body.contacto = toTitleCase(req.body.contacto)
  const fields = ['nombre','tipo','contacto','email','telefono','notas','activo','firma_imagen','trabajadores','maquinas']
  const updates = [], vals = []
  let idx = 1
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=$${idx++}`); vals.push(req.body[f]) }
  }
  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' })
  vals.push(req.params.id)
  await pool.query(`UPDATE proveedores SET ${updates.join(',')} WHERE id=$${idx}`, vals)
  const { rows } = await pool.query('SELECT * FROM proveedores WHERE id=$1', [req.params.id])
  res.json(rows[0])
})

// ── DELETE /empresas/:id ──────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM proveedores WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

module.exports = router

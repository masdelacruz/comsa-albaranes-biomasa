const router = require('express').Router()
const pool   = require('../db')
const { requireAuth, requireConfigAccess } = require('./auth')
const { registrarAuditoria } = require('../lib/auditoria')

// GET /elementos  (público — usado en campo y oficina)
router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, tipo, valor FROM elementos ORDER BY tipo, orden, id')
  const result = {}
  rows.forEach(r => {
    if (!result[r.tipo]) result[r.tipo] = []
    result[r.tipo].push({ id: r.id, valor: r.valor })
  })
  res.json(result)
})

// POST /elementos  (requiere acceso a Configuración)
router.post('/', requireAuth, requireConfigAccess, async (req, res) => {
  const { tipo, valor } = req.body
  if (!tipo || !valor?.trim()) return res.status(400).json({ error: 'tipo y valor son obligatorios' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO elementos (tipo, valor, orden)
       VALUES ($1, $2, (SELECT COALESCE(MAX(orden), 0) + 1 FROM elementos WHERE tipo = $1))
       RETURNING id, tipo, valor`,
      [tipo, valor.trim()]
    )
    registrarAuditoria({
      usuario: req.user, accion: 'crear', entidad: 'elemento', entidadId: rows[0].id,
      detalle: `${tipo}: ${rows[0].valor}`,
    })
    res.json(rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe ese valor' })
    throw e
  }
})

// DELETE /elementos/:id  (requiere acceso a Configuración)
router.delete('/:id', requireAuth, requireConfigAccess, async (req, res) => {
  const { rows } = await pool.query('SELECT tipo, valor FROM elementos WHERE id = $1', [req.params.id])
  await pool.query('DELETE FROM elementos WHERE id = $1', [req.params.id])
  registrarAuditoria({
    usuario: req.user, accion: 'borrar', entidad: 'elemento', entidadId: req.params.id,
    detalle: rows[0] ? `${rows[0].tipo}: ${rows[0].valor}` : null,
  })
  res.json({ ok: true })
})

module.exports = router

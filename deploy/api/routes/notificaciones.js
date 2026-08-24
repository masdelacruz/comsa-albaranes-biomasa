/**
 * routes/notificaciones.js — notificaciones persistentes de los paneles
 * públicos de cliente (astilladora / instalación). Sin auth: el acceso a
 * esos paneles ya es por nombre de empresa en la URL, sin usuario logueado.
 */
const router = require('express').Router()
const pool   = require('../db')

const TIPOS_VALIDOS = ['astilladora', 'instalacion']

// ── GET /notificaciones/:tipo/:nombre  (PÚBLICO — panel cliente) ────────
router.get('/:tipo/:nombre', async (req, res) => {
  const { tipo } = req.params
  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' })
  const nombre = decodeURIComponent(req.params.nombre).replace(/-/g, ' ')

  const { rows } = await pool.query(
    `SELECT id, albaran_id, tipo, mensaje, leida, created_at
     FROM notificaciones_cliente
     WHERE empresa_tipo = $1 AND empresa_nombre = $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [tipo, nombre]
  )
  res.json(rows.map(r => ({
    id: r.id,
    albaranId: r.albaran_id,
    tipo: r.tipo,
    mensaje: r.mensaje,
    leida: r.leida,
    fecha: r.created_at,
  })))
})

// ── POST /notificaciones/:tipo/:nombre/marcar-leidas  (PÚBLICO) ─────────
router.post('/:tipo/:nombre/marcar-leidas', async (req, res) => {
  const { tipo } = req.params
  if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' })
  const nombre = decodeURIComponent(req.params.nombre).replace(/-/g, ' ')

  await pool.query(
    `UPDATE notificaciones_cliente SET leida = true
     WHERE empresa_tipo = $1 AND empresa_nombre = $2 AND leida = false`,
    [tipo, nombre]
  )
  res.json({ ok: true })
})

module.exports = router

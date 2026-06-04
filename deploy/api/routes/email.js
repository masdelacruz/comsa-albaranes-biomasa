const router                     = require('express').Router()
const { requireAuth }            = require('./auth')
const { enviarNotificacion }     = require('../emailSender')

// ── POST /email  (requiere auth — solo para nuevo_albaran desde oficina) ──
router.post('/', requireAuth, async (req, res) => {
  const { tipo, albaran } = req.body
  if (!tipo || !albaran) return res.status(400).json({ error: 'Faltan campos' })
  try {
    await enviarNotificacion(tipo, albaran)
    res.json({ ok: true })
  } catch (e) {
    console.error('Email error:', e.message)
    res.status(500).json({ error: 'Error al enviar notificación' })
  }
})

module.exports = router

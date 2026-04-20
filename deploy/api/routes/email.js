const router     = require('express').Router()
const nodemailer = require('nodemailer')

function getTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// ── POST /email ───────────────────────────────────────────────────
// Llamado internamente desde el backend (no expuesto al frontend)
router.post('/', async (req, res) => {
  const { tipo, albaran, destinatario } = req.body
  const transport = getTransport()
  const appUrl    = process.env.APP_URL || 'https://biomasa.cserintranet.com'

  let subject, html

  if (tipo === 'nuevo_albaran') {
    subject = `[Biomasa] Nuevo albarán ${albaran.id}`
    html = `
      <h2>Nuevo albarán creado</h2>
      <p><strong>ID:</strong> ${albaran.id}<br>
      <strong>Astilladora:</strong> ${albaran.astilladora || '—'}<br>
      <strong>Instalación:</strong> ${albaran.instalacion || '—'}<br>
      <strong>Especie:</strong> ${albaran.especie || '—'}</p>
      <p><a href="${appUrl}/albaran/${albaran.id}">Ver albarán</a></p>
    `
  } else if (tipo === 'firma_completada') {
    subject = `[Biomasa] Firma en albarán ${albaran.id}`
    html = `
      <h2>Nueva firma registrada</h2>
      <p><strong>Albarán:</strong> ${albaran.id}<br>
      <strong>Firmado por:</strong> ${albaran.firmante || '—'}</p>
      <p><a href="${appUrl}/albaran/${albaran.id}">Ver albarán</a></p>
    `
  } else if (tipo === 'albaran_cerrado') {
    subject = `[Biomasa] Albarán cerrado ${albaran.id}`
    html = `
      <h2>Albarán cerrado automáticamente</h2>
      <p><strong>ID:</strong> ${albaran.id}<br>
      <strong>Peso neto:</strong> ${albaran.pesoNeto || '—'}<br>
      <strong>Humedad:</strong> ${albaran.humedad ? albaran.humedad + '%' : '—'}</p>
      <p><a href="${appUrl}/albaran/${albaran.id}">Descargar PDF</a></p>
    `
  } else {
    return res.status(400).json({ error: 'Tipo de email desconocido' })
  }

  try {
    await transport.sendMail({
      from:    process.env.SMTP_FROM,
      to:      destinatario,
      subject,
      html,
    })
    res.json({ ok: true })
  } catch (e) {
    console.error('Email error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

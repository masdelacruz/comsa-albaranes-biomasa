const router               = require('express').Router()
const { transport, destinatarios } = require('../mailer')

// ── POST /email ───────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { tipo, albaran } = req.body
  const appUrl = process.env.APP_URL || 'https://biomasa.cserintranet.com'

  let subject, html

  // ── Layout ────────────────────────────────────────────────────
  const emailWrapper = (bodyContent) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comsa Service - Albaranes de Biomasa</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- CABECERA -->
          <tr>
            <td style="background-color:#0f2d1f;padding:28px 40px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">COMSA</span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:300;color:#1D9E75;letter-spacing:0.5px;"> SERVICE</span>
              <br>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8aad9b;letter-spacing:1.5px;text-transform:uppercase;">Gestión de Albaranes de Biomasa</span>
            </td>
          </tr>

          <!-- CUERPO -->
          ${bodyContent}

          <!-- PIE -->
          <tr>
            <td style="background-color:#f0f3f1;padding:24px 40px;border-top:1px solid #e2e8e4;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;line-height:1.6;">
                Mensaje generado automáticamente por el sistema de albaranes de Comsa Service.<br>
                No responda directamente a este correo.
              </p>
              <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9aada5;">
                &copy; ${new Date().getFullYear()} Comsa Service
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const badge = (text, color = '#1D9E75') => `
    <span style="display:inline-block;background-color:${color};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`

  const fila = (label, value) => `
    <tr>
      <td style="padding:10px 16px;background-color:#f9fafb;border-bottom:1px solid #edf0ed;width:38%;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;">${label}</span>
      </td>
      <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #edf0ed;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a2e24;font-weight:600;">${value || '—'}</span>
      </td>
    </tr>`

  const boton = (text, url) => `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="border-radius:6px;background-color:#1D9E75;">
          <a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">${text}</a>
        </td>
      </tr>
    </table>`

  // ── Datos comunes ─────────────────────────────────────────────
  const fmtFecha = (f) => f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—'
  const fechaHora = albaran.fecha
    ? `${fmtFecha(albaran.fecha)}${albaran.hora ? ' - ' + albaran.hora + ' h' : ''}`
    : '—'
  const esOp1 = albaran.tipo?.includes('1')

  // Partes del asunto: sin corchetes, sin puntos medios, solo guiones
  const partes = [albaran.proveedor, albaran.especie, albaran.instalacion].filter(Boolean)
  const resumenAsunto = partes.slice(0, 2).join(' - ')   // máx 2 partes en el asunto

  // Tabla de datos estándar del albarán
  const tablaAlbaran = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #edf0ed;">
      ${fila('Fecha', fechaHora)}
      ${fila('Proveedor', albaran.proveedor)}
      ${esOp1 ? fila('Astilladora', albaran.astilladora) : ''}
      ${esOp1 ? fila('Transportista', albaran.transportista) : ''}
      ${fila('Instalación', albaran.instalacion)}
      ${fila('Especie', albaran.especie)}
      ${albaran.tipoBiomasa ? fila('Tipo de biomasa', albaran.tipoBiomasa) : ''}
      ${fila('Origen', albaran.origen)}
      ${esOp1 && albaran.chofer ? fila('Chofer', albaran.chofer) : ''}
      ${esOp1 && albaran.matriculaTractora ? fila('Matricula tractora', albaran.matriculaTractora) : ''}
      ${albaran.certificacion ? fila('Certificacion', Array.isArray(albaran.certificacion) ? albaran.certificacion.join(', ') : albaran.certificacion) : ''}
    </table>`

  // ─────────────────────────────────────────────────────────────
  // Nuevo albarán
  // ─────────────────────────────────────────────────────────────
  if (tipo === 'nuevo_albaran') {
    subject = `Nuevo albaran - ${resumenAsunto}`
    html = emailWrapper(`
      <tr>
        <td style="background-color:#e8f5ef;padding:12px 40px;border-bottom:1px solid #c9e8d9;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>${badge('Nuevo albaran')}</td>
            <td align="right"><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a7a58;">${fechaHora}</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f2d1f;">Nuevo albaran registrado</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.6;">
            Se ha creado un nuevo albaran en el sistema. Queda pendiente de firma por las partes correspondientes.
          </p>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albaran', `${appUrl}/albaran/${albaran.id}`)}</td></tr>
    `)

  // ─────────────────────────────────────────────────────────────
  // Firma registrada
  // ─────────────────────────────────────────────────────────────
  } else if (tipo === 'firma_completada') {
    const rolTexto = albaran.rolLabel || 'firma'
    subject = `Firma registrada - ${rolTexto} - ${resumenAsunto}`
    html = emailWrapper(`
      <tr>
        <td style="background-color:#fff8e8;padding:12px 40px;border-bottom:1px solid #f0dfa0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>${badge('Firma registrada', '#c78a00')}</td>
            <td align="right"><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6020;">${fechaHora}</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f2d1f;">Firma registrada en el albaran</h1>
          <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.6;">
            Una de las partes ha firmado el albaran. El proceso continua hasta que todas las firmas requeridas esten completas.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0faf5;border-left:4px solid #1D9E75;border-radius:0 6px 6px 0;">
            <tr><td style="padding:16px 20px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a7a58;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Firmado por</span><br>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#0f2d1f;font-weight:700;">${albaran.firmante || '—'}</span>
              ${albaran.rolLabel ? `<br><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a7a58;">${albaran.rolLabel}</span>` : ''}
            </td></tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albaran', `${appUrl}/albaran/${albaran.id}`)}</td></tr>
    `)

  // ─────────────────────────────────────────────────────────────
  // Albarán cerrado
  // ─────────────────────────────────────────────────────────────
  } else if (tipo === 'albaran_cerrado') {
    subject = `Albaran cerrado - ${resumenAsunto} - ${fmtFecha(albaran.fecha)}`
    html = emailWrapper(`
      <tr>
        <td style="background-color:#e8f0ff;padding:12px 40px;border-bottom:1px solid #b8ccf0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>${badge('Albaran cerrado', '#2a5fc4')}</td>
            <td align="right"><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a508a;">Todas las firmas completadas</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f2d1f;">Albaran cerrado</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.6;">
            El albaran ha recibido todas las firmas requeridas y ha quedado cerrado. A continuacion se muestran los datos de pesada definitivos.
          </p>
        </td>
      </tr>
      <!-- Métricas de pesada -->
      <tr>
        <td style="padding:0 40px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:48%;background-color:#f0faf5;border:1px solid #c9e8d9;border-radius:8px;padding:20px 24px;text-align:center;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a7a58;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Peso neto</span><br>
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:#0f2d1f;">${albaran.pesoNeto || '—'}</span>
              </td>
              <td style="width:4%;"></td>
              <td style="width:48%;background-color:#fff8e8;border:1px solid #f0dfa0;border-radius:8px;padding:20px 24px;text-align:center;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7a6020;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Humedad</span><br>
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:${albaran.humedad != null ? '28' : '14'}px;font-weight:700;color:${albaran.humedad != null ? '#0f2d1f' : '#9aada5'};">
                  ${albaran.humedad != null ? albaran.humedad + ' %' : 'Pendiente de analisis'}
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albaran', `${appUrl}/albaran/${albaran.id}`)}</td></tr>
    `)

  // ─────────────────────────────────────────────────────────────
  // Humedad pendiente
  // ─────────────────────────────────────────────────────────────
  } else if (tipo === 'humedad_pendiente') {
    subject = `Humedad pendiente - ${resumenAsunto} - ${fmtFecha(albaran.fecha)}`
    html = emailWrapper(`
      <tr>
        <td style="background-color:#eff6ff;padding:12px 40px;border-bottom:1px solid #bfdbfe;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>${badge('Humedad pendiente', '#3b82f6')}</td>
            <td align="right"><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1d4ed8;">${fechaHora}</span></td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#0f2d1f;">Analisis de humedad pendiente</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.6;">
            El albaran ha completado las firmas de campo pero requiere el resultado del analisis de humedad antes de quedar cerrado definitivamente.
          </p>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Registrar humedad', `${appUrl}/albaran/${albaran.id}`)}</td></tr>
    `)

  } else {
    return res.status(400).json({ error: 'Tipo de email desconocido' })
  }

  const to = await destinatarios(tipo)
  if (!to.length) return res.json({ ok: true, sent: 0 })

  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, to: to.join(', '), subject, html })
    res.json({ ok: true, sent: to.length })
  } catch (e) {
    console.error('Email error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

const router     = require('express').Router()
const nodemailer = require('nodemailer')

// Transport persistente con pooling — reutiliza la conexión SMTP
// en lugar de reconectar en cada envío (evita overhead TCP+TLS+auth)
const transport = nodemailer.createTransport({
  host:           process.env.SMTP_HOST,
  port:           parseInt(process.env.SMTP_PORT || '587'),
  secure:         parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool:           true,   // reutiliza conexiones
  maxConnections: 3,
  maxMessages:    50,
  socketTimeout:  10000,
  greetingTimeout: 10000,
})

// ── POST /email ───────────────────────────────────────────────────
// Llamado internamente desde el backend (no expuesto al frontend)
router.post('/', async (req, res) => {
  const { tipo, albaran, destinatario } = req.body
  const appUrl = process.env.APP_URL || 'https://biomasa.cserintranet.com'

  let subject, html

  // ── Helpers de layout ──────────────────────────────────────────
  const emailWrapper = (bodyContent) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comsa Service — Gestión de Albaranes</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f4;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Contenedor principal -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#0f2d1f;padding:28px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">COMSA</span>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:300;color:#1D9E75;letter-spacing:0.5px;"> SERVICE</span>
                    <br>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8aad9b;letter-spacing:1.5px;text-transform:uppercase;">Gestión de Albaranes de Biomasa</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          ${bodyContent}

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#f0f3f1;padding:24px 40px;border-top:1px solid #e2e8e4;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;line-height:1.6;">
                Este mensaje ha sido generado automáticamente por el sistema de gestión de albaranes de Comsa Service.<br>
                Por favor, no responda directamente a este correo.
              </p>
              <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9aada5;">
                &copy; ${new Date().getFullYear()} Comsa Service &mdash; Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const badgeHtml = (text, color = '#1D9E75') => `
    <span style="display:inline-block;background-color:${color};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>
  `

  const dataRow = (label, value) => `
    <tr>
      <td style="padding:10px 16px;background-color:#f9fafb;border-bottom:1px solid #edf0ed;width:38%;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;font-weight:400;">${label}</span>
      </td>
      <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #edf0ed;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a2e24;font-weight:600;">${value || '—'}</span>
      </td>
    </tr>
  `

  const ctaButton = (text, url, primary = true) => `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td style="border-radius:6px;background-color:${primary ? '#1D9E75' : '#0f2d1f'};">
          <a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;letter-spacing:0.3px;">${text}</a>
        </td>
      </tr>
    </table>
  `

  // ── Helpers comunes ────────────────────────────────────────────
  const fmtFecha = (f) => f ? String(f).slice(0,10).split('-').reverse().join('/') : '—'
  const fechaHora = albaran.fecha
    ? `${fmtFecha(albaran.fecha)}${albaran.hora ? ' · ' + albaran.hora + ' h' : ''}`
    : '—'
  const esOp1 = albaran.tipo?.includes('1')

  // Asunto normalizado: [Estado] #ID · Especie · Proveedor → Instalación
  const resumen = [albaran.especie, albaran.proveedor, albaran.instalacion]
    .filter(Boolean).join(' · ')

  // ── Templates por tipo ─────────────────────────────────────────

  if (tipo === 'nuevo_albaran') {
    subject = `[Nuevo] #${albaran.id} · ${resumen}`
    html = emailWrapper(`
          <!-- Franja de estado -->
          <tr>
            <td style="background-color:#e8f5ef;padding:12px 40px;border-bottom:1px solid #c9e8d9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>${badgeHtml('Nuevo albarán')}</td>
                  <td align="right">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a7a58;">${fechaHora}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td style="padding:32px 40px 8px;">
              <h1 style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#0f2d1f;">
                Se ha creado un nuevo albarán
              </h1>
              <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.5;">
                El albarán <strong style="color:#1D9E75;">#${albaran.id}</strong> ha sido registrado en el sistema y está pendiente de firma.
              </p>
            </td>
          </tr>

          <!-- Tabla de datos -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #edf0ed;">
                ${dataRow('Identificador', `#${albaran.id}`)}
                ${dataRow('Fecha / Hora', fechaHora)}
                ${dataRow('Proveedor', albaran.proveedor)}
                ${esOp1 ? dataRow('Astilladora', albaran.astilladora) : ''}
                ${esOp1 ? dataRow('Transportista', albaran.transportista) : ''}
                ${dataRow('Instalación', albaran.instalacion)}
                ${dataRow('Especie', albaran.especie)}
                ${albaran.tipoBiomasa ? dataRow('Tipo de biomasa', albaran.tipoBiomasa) : ''}
                ${dataRow('Origen', albaran.origen)}
                ${esOp1 && albaran.chofer ? dataRow('Chófer', albaran.chofer) : ''}
                ${esOp1 && albaran.matriculaTractora ? dataRow('Matrícula tractora', albaran.matriculaTractora) : ''}
                ${albaran.certificacion ? dataRow('Certificación', Array.isArray(albaran.certificacion) ? albaran.certificacion.join(', ') : albaran.certificacion) : ''}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 40px;" align="center">
              ${ctaButton('Ver albarán', `${appUrl}/albaran/${albaran.id}`)}
            </td>
          </tr>
    `)

  } else if (tipo === 'firma_completada') {
    subject = `[Firma · ${albaran.rolLabel || 'Firma'}] #${albaran.id} · ${resumen}`
    html = emailWrapper(`
          <!-- Franja de estado -->
          <tr>
            <td style="background-color:#fff8e8;padding:12px 40px;border-bottom:1px solid #f0dfa0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    ${badgeHtml('Firma completada', '#c78a00')}
                  </td>
                  <td align="right">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#7a6020;">Albarán #${albaran.id}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td style="padding:32px 40px 8px;">
              <h1 style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#0f2d1f;">
                Nueva firma registrada
              </h1>
              <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.5;">
                Se ha registrado una firma en el albarán <strong style="color:#1D9E75;">#${albaran.id}</strong>.
                El proceso continúa hasta que todas las partes hayan firmado.
              </p>
            </td>
          </tr>

          <!-- Bloque de firmante destacado -->
          <tr>
            <td style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0faf5;border-left:4px solid #1D9E75;border-radius:0 6px 6px 0;">
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a7a58;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Firmado por</span>
                    <br>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#0f2d1f;font-weight:700;">${albaran.firmante || '—'}</span>
                    ${albaran.rolLabel ? `<br><span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a7a58;margin-top:2px;display:inline-block;">${albaran.rolLabel}</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla de datos del albarán -->
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#6b7c74;text-transform:uppercase;letter-spacing:1px;">Datos del albarán</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #edf0ed;">
                ${dataRow('Identificador', `#${albaran.id}`)}
                ${dataRow('Fecha / Hora', fechaHora)}
                ${dataRow('Proveedor', albaran.proveedor)}
                ${esOp1 ? dataRow('Astilladora', albaran.astilladora) : ''}
                ${esOp1 ? dataRow('Transportista', albaran.transportista) : ''}
                ${dataRow('Instalación', albaran.instalacion)}
                ${dataRow('Especie', albaran.especie)}
                ${albaran.tipoBiomasa ? dataRow('Tipo de biomasa', albaran.tipoBiomasa) : ''}
                ${dataRow('Origen', albaran.origen)}
                ${esOp1 && albaran.chofer ? dataRow('Chófer', albaran.chofer) : ''}
                ${esOp1 && albaran.matriculaTractora ? dataRow('Matrícula tractora', albaran.matriculaTractora) : ''}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 40px 40px;" align="center">
              ${ctaButton('Ver albarán', `${appUrl}/albaran/${albaran.id}`)}
            </td>
          </tr>
    `)

  } else if (tipo === 'albaran_cerrado') {
    subject = `[Cerrado] #${albaran.id} · ${resumen}`
    html = emailWrapper(`
          <!-- Franja de estado -->
          <tr>
            <td style="background-color:#e8f0ff;padding:12px 40px;border-bottom:1px solid #b8ccf0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    ${badgeHtml('Albarán cerrado', '#2a5fc4')}
                  </td>
                  <td align="right">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a508a;">Todas las firmas completadas</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido principal -->
          <tr>
            <td style="padding:32px 40px 8px;">
              <h1 style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#0f2d1f;">
                Albarán cerrado con éxito
              </h1>
              <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.5;">
                El albarán <strong style="color:#1D9E75;">#${albaran.id}</strong> ha recibido todas las firmas requeridas
                y ha quedado cerrado. A continuación se muestran los datos de pesada definitivos.
              </p>
            </td>
          </tr>

          <!-- Métricas destacadas de pesada -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Peso neto -->
                  <td style="width:48%;background-color:#f0faf5;border:1px solid #c9e8d9;border-radius:8px;padding:20px 24px;text-align:center;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#3a7a58;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Peso neto</span>
                    <br>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:#0f2d1f;">${albaran.pesoNeto || '—'}</span>
                    <br>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#3a7a58;">&nbsp;</span>
                  </td>
                  <!-- Separador -->
                  <td style="width:4%;"></td>
                  <!-- Humedad -->
                  <td style="width:48%;background-color:#fff8e8;border:1px solid #f0dfa0;border-radius:8px;padding:20px 24px;text-align:center;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#7a6020;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Humedad</span>
                    <br>
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:${albaran.humedad != null ? '28' : '14'}px;font-weight:700;color:${albaran.humedad != null ? '#0f2d1f' : '#9aada5'};">${albaran.humedad != null ? albaran.humedad + ' %' : 'Pendiente de análisis'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabla resumen albarán -->
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#6b7c74;text-transform:uppercase;letter-spacing:1px;">Resumen del albarán</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid #edf0ed;">
                ${dataRow('Identificador', `#${albaran.id}`)}
                ${dataRow('Fecha / Hora', fechaHora)}
                ${dataRow('Proveedor', albaran.proveedor)}
                ${esOp1 ? dataRow('Astilladora', albaran.astilladora) : ''}
                ${esOp1 ? dataRow('Transportista', albaran.transportista) : ''}
                ${dataRow('Instalación', albaran.instalacion)}
                ${dataRow('Especie', albaran.especie)}
                ${albaran.tipoBiomasa ? dataRow('Tipo de biomasa', albaran.tipoBiomasa) : ''}
                ${dataRow('Origen', albaran.origen)}
                ${esOp1 && albaran.chofer ? dataRow('Chófer', albaran.chofer) : ''}
                ${esOp1 && albaran.matriculaTractora ? dataRow('Matrícula tractora', albaran.matriculaTractora) : ''}
              </table>
            </td>
          </tr>

          <!-- CTA: Ver albarán -->
          <tr>
            <td style="padding:8px 40px 40px;" align="center">
              ${ctaButton('Ver albarán', `${appUrl}/albaran/${albaran.id}`, true)}
            </td>
          </tr>
    `)

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

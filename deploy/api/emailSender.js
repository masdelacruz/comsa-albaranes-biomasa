/**
 * emailSender.js — construcción de templates y envío de notificaciones.
 * Puede llamarse desde rutas autenticadas O desde el propio backend (firmas).
 */
const { transport, destinatarios, destinatarioInstalacion, logoComsaUrl } = require('./mailer')

const APP_URL = process.env.APP_URL || 'https://biomasa.cserintranet.com'

// ── Helpers de layout ─────────────────────────────────────────────
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
          <tr>
            <td style="background-color:#0f2d1f;padding:28px 40px;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">COMSA</span>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:300;color:#1D9E75;letter-spacing:0.5px;"> SERVICE</span>
              <br>
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8aad9b;letter-spacing:1.5px;text-transform:uppercase;">Gestión de Albaranes de Biomasa</span>
            </td>
          </tr>
          ${bodyContent}
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

// Variante de cabecera en negro con logo, usada por el email de "camión
// enviado" — inspirada en la plantilla de referencia (logo + etiqueta lateral).
const emailWrapperTransporte = (bodyContent, etiqueta = 'Transporte', logoUrl = null) => `
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
          <tr>
            <td style="background-color:#0a0f0c;padding:20px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="middle"><img src="${logoUrl || `${APP_URL}/logo-comsa.png`}" alt="COMSA Service Bioenergía" height="52" style="display:block;height:52px;"></td>
                <td valign="middle" align="right">
                  <span style="border-left:2px solid #1D9E75;padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#ffffff;">${etiqueta}</span>
                </td>
              </tr></table>
            </td>
          </tr>
          ${bodyContent}
          <tr>
            <td style="background-color:#f9fafb;padding:20px 40px;border-top:1px solid #edf0ed;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td width="36" valign="top">
                  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td width="30" style="width:30px;height:30px;border-radius:50%;background-color:#ffffff;border:1px solid #e2e8e4;text-align:center;vertical-align:middle;">
                      <img src="${APP_URL}/icons-email/globe.png" width="16" height="16" alt="" style="display:inline-block;vertical-align:middle;">
                    </td>
                  </tr></table>
                </td>
                <td valign="middle" style="padding-left:10px;">
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;">Accede a la aplicación</span>
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#0f2d1f;font-weight:600;">COMSA Service Bioenergía</span>
                </td>
                <td width="1" style="background-color:#e2e8e4;font-size:0;line-height:0;">&nbsp;</td>
                <td valign="middle" align="right" style="padding-left:20px;">
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;">Este es un correo automático.</span>
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;">Por favor, no respondas a este mensaje.</span>
                </td>
              </tr></table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

// Iconos monocromo (verde, mismo trazo que lucide-react) subidos como PNG
// estáticos — un <img> de icono real, sin depender de emoji multicolor.
const ICONOS_VALIDOS = new Set(['matricula', 'conductor', 'transportista', 'hora', 'estado', 'destino'])

// Celda con icono + etiqueta + valor, para la cuadrícula 2x3
// del email de camión enviado.
const celda = (label, value, iconKey = 'estado') => {
  const icono = ICONOS_VALIDOS.has(iconKey) ? iconKey : 'estado'
  return `
  <td width="50%" valign="top" style="padding:0 8px 16px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="36"><img src="${APP_URL}/icons-email/${icono}.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;"></td>
      <td style="padding-left:12px;">
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7c74;">${label}</span>
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f2d1f;font-weight:700;">${String(value || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      </td>
    </tr></table>
  </td>`
}

const badge = (text, color = '#1D9E75') =>
  `<span style="display:inline-block;background-color:${color};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`

const fila = (label, value) => `
  <tr>
    <td style="padding:10px 16px;background-color:#f9fafb;border-bottom:1px solid #edf0ed;width:38%;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7c74;">${label}</span>
    </td>
    <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #edf0ed;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a2e24;font-weight:600;">${String(value || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
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

function buildEmail(tipo, albaran) {
  const fmtFecha = (f) => f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—'
  const fechaHora = albaran.fecha
    ? `${fmtFecha(albaran.fecha)}${albaran.hora ? ' - ' + albaran.hora + ' h' : ''}`
    : '—'
  const esOp1 = albaran.tipo?.includes('1')
  const partes = [albaran.proveedor, albaran.especie, albaran.instalacion].filter(Boolean)
  const resumenAsunto = partes.slice(0, 2).join(' - ')

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

  let subject, html

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
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albaran', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `)

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
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#0f2d1f;font-weight:700;">${String(albaran.firmante || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
              ${albaran.rolLabel ? `<br><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3a7a58;">${String(albaran.rolLabel).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>` : ''}
            </td></tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albaran', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `)

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
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albaran', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `)

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
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Registrar humedad', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `)

  } else if (tipo === 'camion_enviado') {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    const fmtFechaHoraLarga = (f) => {
      if (!f) return '—'
      const [datePart, timePart] = String(f).split(', ')
      const [d, m, y] = (datePart || '').split('/')
      if (!y) return f
      return `${+d} de ${meses[+m - 1]} de ${y}${timePart ? ', ' + timePart.slice(0, 5) : ''}`
    }
    const horaSalida = fmtFechaHoraLarga(albaran.firmas?.astilladora?.fecha)
    const matricula  = [albaran.matriculaTractora, albaran.matriculaRemolque].filter(Boolean).join(' · ') || '—'
    const origenTexto = albaran.astilladora || albaran.proveedor || albaran.origen || 'origen'
    const primerNombre = albaran.contactoInstalacion ? albaran.contactoInstalacion.split(' ')[0] : null

    const instalacionSlug = String(albaran.instalacion || '').trim().replace(/\s+/g, '-')

    subject = `Camión en camino - ${albaran.instalacion || resumenAsunto}`
    html = emailWrapperTransporte(`
      <tr>
        <td style="padding:32px 40px 4px;">
          <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#0f2d1f;">Hola${primerNombre ? ' ' + primerNombre : ''},</p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#6b7c74;line-height:1.6;">
            Se ha <strong style="color:#1D9E75;">enviado</strong> un camión desde <strong style="color:#0f2d1f;">${String(origenTexto).replace(/</g, '&lt;')}</strong> con destino a <strong style="color:#0f2d1f;">${String(albaran.instalacion || '—').replace(/</g, '&lt;')}</strong>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #edf0ed;border-radius:8px;padding:20px 16px 4px;">
            <tr>${celda('Matrícula', matricula, 'matricula')}${celda('Conductor', albaran.chofer, 'conductor')}</tr>
            <tr>${celda('Empresa transportista', albaran.transportista, 'transportista')}${celda('Hora de salida', horaSalida, 'hora')}</tr>
            <tr>${celda('Estado', 'Enviado', 'estado')}${celda('Destino', albaran.instalacion, 'destino')}</tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:16px 40px 40px;" align="center">${boton('Ver envío', `${APP_URL}/campo/instalacion/${instalacionSlug}`)}</td></tr>
    `, 'Transporte', albaran.logoUrl)

  } else {
    return null
  }

  return { subject, html }
}

async function enviarNotificacion(tipo, albaran) {
  const built = buildEmail(tipo, albaran)
  if (!built) return
  const to = await destinatarios(tipo)
  if (!to.length) return
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, to: to.join(', '), subject: built.subject, html: built.html })
  } catch (e) {
    console.error('Email error:', e.message)
  }
}

async function enviarNotificacionCamionEnviado(albaran) {
  const [{ emails, contacto }, logoUrl] = await Promise.all([
    destinatarioInstalacion(albaran.instalacion),
    logoComsaUrl(),
  ])
  if (!emails.length) return
  const built = buildEmail('camion_enviado', { ...albaran, contactoInstalacion: contacto, logoUrl })
  if (!built) return
  try {
    await transport.sendMail({ from: process.env.SMTP_FROM, to: emails.join(', '), subject: built.subject, html: built.html })
  } catch (e) {
    console.error('Email error (camion_enviado):', e.message)
  }
}

module.exports = { enviarNotificacion, enviarNotificacionCamionEnviado, buildEmail }

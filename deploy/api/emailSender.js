/**
 * emailSender.js — construcción de templates y envío de notificaciones.
 * Puede llamarse desde rutas autenticadas O desde el propio backend (firmas).
 */
const { transport, destinatarios, destinatarioInstalacion, logoComsaUrl } = require('./mailer')

const APP_URL = process.env.APP_URL || 'https://biomasa.cserintranet.com'

// ── Paleta ─────────────────────────────────────────────────────────
// Email transaccional simple: un único fondo de contenido (blanco),
// cabecera de marca (negra) y botón de acento (verde) — nada más lleva
// color de fondo propio. Cuantos menos bloques de color declaremos,
// menos superficie tiene el "modo oscuro forzado" de Outlook/Gmail para
// recolorear de forma impredecible; el panel de datos es solo texto con
// una línea divisoria fina, como cualquier email transaccional normal.
const CARD_BG = '#ffffff'
const HEADER_BG = '#000000'
const LABEL_BG = '#f8fafc'
const BORDER = '#e5e7eb'
const TEXT_TITLE = '#1a1a1a'
const TEXT_MUTED = '#6b7280'
const TEXT_WHITE = '#ffffff'
const ACCENT = '#1D9E75'

// ── Helpers de layout ─────────────────────────────────────────────
// Cabecera en negro con el logo corporativo (Administración > Corporativos)
// y una etiqueta lateral por tipo de aviso — mismo estilo para todos los
// emails del sistema.
const emailWrapper = (bodyContent, etiqueta = '', logoUrl = null) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comsa Service - Albaranes de Biomasa</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CARD_BG}" style="max-width:600px;background-color:${CARD_BG};border:1px solid ${BORDER};border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.12);">
          <tr>
            <td bgcolor="${HEADER_BG}" style="background-color:${HEADER_BG};padding:26px 40px;border-bottom:3px solid ${ACCENT};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="middle"><img src="${logoUrl || `${APP_URL}/logo-comsa.png`}" alt="COMSA Service Bioenergía" height="52" style="display:block;height:52px;"></td>
                <td valign="middle" align="right">
                  <span style="border-left:2px solid ${ACCENT};padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:${TEXT_WHITE};">${etiqueta}</span>
                </td>
              </tr></table>
            </td>
          </tr>
          ${bodyContent}
          <tr>
            <td style="padding:20px 40px;border-top:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="middle">
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};">Accede a la aplicación</span>
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_TITLE};font-weight:600;">COMSA Service Bioenergía</span>
                </td>
                <td valign="middle" align="right">
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};">Este es un correo automático.</span>
                  <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};">Por favor, no respondas a este mensaje.</span>
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
const ICONOS_VALIDOS = new Set(['matricula', 'conductor', 'transportista', 'hora', 'estado', 'destino', 'peso', 'humedad'])

// Celda con icono + etiqueta + valor, para la cuadrícula 2x3
// del email de camión enviado.
const celda = (label, value, iconKey = 'estado') => {
  const icono = ICONOS_VALIDOS.has(iconKey) ? iconKey : 'estado'
  return `
  <td width="50%" valign="top" style="padding:0 8px 16px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="36"><img src="${APP_URL}/icons-email/${icono}.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;"></td>
      <td style="padding-left:12px;">
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_MUTED};">${label}</span>
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_TITLE};font-weight:700;">${String(value || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      </td>
    </tr></table>
  </td>`
}

// Celda destacada (icono + etiqueta + valor grande) para datos clave
// como el peso neto o la humedad en el cierre de un albarán. El borde
// va DIRECTAMENTE en la <td> de la fila (no en una tabla anidada
// dentro): los navegadores igualan de forma nativa la altura de las
// celdas de una misma fila sin necesidad de flex, height:100% ni una
// altura fija adivinada — y al ser solo <table>/<td> básicos, sobrevive
// intacto al reenviar (a diferencia de flex, que Outlook elimina).
const celdaGrande = (label, value, iconKey, mutedValue = false) => {
  const icono = ICONOS_VALIDOS.has(iconKey) ? iconKey : 'estado'
  // Un valor vacío (placeholder "—") nunca debe usar la tipografía grande:
  // sin esto, una card sin dato aún queda visualmente más "pesada" que una
  // con texto real, solo por el tamaño de fuente del guion.
  const chico = mutedValue || !value
  return `
  <td width="50%" valign="top" style="border:1px solid ${BORDER};border-radius:8px;padding:18px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td width="34" valign="top"><img src="${APP_URL}/icons-email/${icono}.png" width="34" height="34" alt="" style="display:block;width:34px;height:34px;"></td>
      <td valign="top" style="padding-left:10px;">
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:${chico ? '14px' : '22px'};line-height:1.3;font-weight:${chico ? '600' : '700'};color:${chico ? TEXT_MUTED : TEXT_TITLE};">${String(value || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      </td>
    </tr></table>
  </td>`
}

// Fila de la tabla de datos del albarán: la columna de etiqueta lleva un
// gris neutro muy claro para diferenciarla de la de valor (blanca) — un
// único tono suave, no dos tonos casi iguales, para que quede clara la
// jerarquía sin arriesgar el aspecto "manchado" en clientes con dark mode.
const fila = (label, value) => `
  <tr>
    <td bgcolor="${LABEL_BG}" style="padding:11px 16px;background-color:${LABEL_BG};border-bottom:1px solid ${BORDER};width:38%;">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">${label}</span>
    </td>
    <td style="padding:11px 16px;border-bottom:1px solid ${BORDER};">
      <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT_TITLE};font-weight:600;">${String(value || '—').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
    </td>
  </tr>`

const boton = (text, url) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td bgcolor="${ACCENT}" style="border-radius:6px;background-color:${ACCENT};">
        <a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${TEXT_WHITE};text-decoration:none;border-radius:6px;">${text}</a>
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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:6px;overflow:hidden;border:1px solid ${BORDER};">
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
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${TEXT_TITLE};">Nuevo albarán registrado</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
            Se ha creado un nuevo albarán en el sistema el <strong style="color:${TEXT_TITLE};">${fechaHora}</strong>. Queda pendiente de firma por las partes correspondientes.
          </p>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albarán', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `, 'Nuevo albarán', albaran.logoUrl)

  } else if (tipo === 'firma_completada') {
    subject = `Firma registrada - ${albaran.rolLabel || 'firma'} - ${resumenAsunto}`
    html = emailWrapper(`
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${TEXT_TITLE};">Firma registrada</h1>
          <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
            Una de las partes ha firmado el albarán. El proceso continúa hasta que todas las firmas requeridas estén completas.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;padding:20px 16px 4px;">
            <tr>${celda('Firmado por', albaran.firmante, 'conductor')}${celda('Rol', albaran.rolLabel, 'matricula')}</tr>
          </table>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albarán', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `, 'Firma registrada', albaran.logoUrl)

  } else if (tipo === 'albaran_cerrado') {
    subject = `Albaran cerrado - ${resumenAsunto} - ${fmtFecha(albaran.fecha)}`
    html = emailWrapper(`
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${TEXT_TITLE};">Albarán cerrado</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
            El albarán ha recibido todas las firmas requeridas y ha quedado cerrado. A continuación se muestran los datos de pesada definitivos.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${celdaGrande('Peso neto', albaran.pesoNeto, 'peso')}
            <td width="16" style="font-size:0;line-height:0;">&nbsp;</td>
            ${celdaGrande('Humedad', albaran.humedad != null ? albaran.humedad + ' %' : 'Pendiente de análisis', 'humedad', albaran.humedad == null)}
          </tr></table>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Ver albarán', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `, 'Cerrado', albaran.logoUrl)

  } else if (tipo === 'humedad_pendiente') {
    subject = `Humedad pendiente - ${resumenAsunto} - ${fmtFecha(albaran.fecha)}`
    html = emailWrapper(`
      <tr>
        <td style="padding:32px 40px 8px;">
          <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:${TEXT_TITLE};">Análisis de humedad pendiente</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
            El albarán ha completado las firmas de campo pero requiere el resultado del análisis de humedad antes de quedar cerrado definitivamente.
          </p>
        </td>
      </tr>
      <tr><td style="padding:0 40px 24px;">${tablaAlbaran}</td></tr>
      <tr><td style="padding:8px 40px 40px;" align="center">${boton('Registrar humedad', `${APP_URL}/albaran/${albaran.id}`)}</td></tr>
    `, 'Humedad pendiente', albaran.logoUrl)

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
    html = emailWrapper(`
      <tr>
        <td style="padding:32px 40px 4px;">
          <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:${TEXT_TITLE};">Hola${primerNombre ? ' ' + primerNombre : ''},</p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT_MUTED};line-height:1.6;">
            Se ha <strong style="color:${ACCENT};">enviado</strong> un camión desde <strong style="color:${TEXT_TITLE};">${String(origenTexto).replace(/</g, '&lt;')}</strong> con destino a <strong style="color:${TEXT_TITLE};">${String(albaran.instalacion || '—').replace(/</g, '&lt;')}</strong>.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 40px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;padding:20px 16px 4px;">
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
  const [to, logoUrl] = await Promise.all([destinatarios(tipo), logoComsaUrl()])
  if (!to.length) return
  const built = buildEmail(tipo, { ...albaran, logoUrl })
  if (!built) return
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

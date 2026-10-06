/**
 * mailer.js — transporte SMTP compartido + helper para obtener
 * destinatarios según sus preferencias de notificación.
 */
const nodemailer = require('nodemailer')
const pool       = require('./db')
const { signPath } = require('./lib/signedUrl')

const smtp = nodemailer.createTransport({
  host:            process.env.SMTP_HOST,
  port:            parseInt(process.env.SMTP_PORT || '587'),
  secure:          parseInt(process.env.SMTP_PORT || '587') === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool:            true,
  maxConnections:  3,
  maxMessages:     50,
  socketTimeout:   10000,
  greetingTimeout: 10000,
})

// ── Envío por Microsoft Graph desde el buzón compartido de COMSA ──
// comsa.com está en Microsoft 365 con DMARC en cuarentena: para enviar como
// albaranes.bio@comsa.com hay que salir por Microsoft. Se usa una app de
// Entra ID con permiso de aplicación Mail.Send (limitado por IT a ese buzón).
// Si no está configurado, o Graph falla, se envía por el SMTP de siempre.
const GRAPH = {
  tenant:   process.env.MAIL_GRAPH_TENANT_ID,
  clientId: process.env.MAIL_GRAPH_CLIENT_ID,
  secret:   process.env.MAIL_GRAPH_CLIENT_SECRET,
  buzon:    process.env.MAIL_GRAPH_SENDER || 'albaranes.bio@comsa.com',
  nombre:   process.env.MAIL_GRAPH_SENDER_NAME || 'Albaranes Biomasa · COMSA',
}
const graphActivo = !!(GRAPH.tenant && GRAPH.clientId && GRAPH.secret)

let tokenGraph = null   // { valor, caduca }
async function obtenerTokenGraph() {
  if (tokenGraph && Date.now() < tokenGraph.caduca) return tokenGraph.valor
  const res = await fetch(`https://login.microsoftonline.com/${GRAPH.tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GRAPH.clientId,
      client_secret: GRAPH.secret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(`Token Graph: ${data.error_description || data.error || res.status}`)
  // Margen de 5 min antes de la caducidad real
  tokenGraph = { valor: data.access_token, caduca: Date.now() + (data.expires_in - 300) * 1000 }
  return tokenGraph.valor
}

const listaEmails = (to) => (Array.isArray(to) ? to : String(to || '').split(','))
  .map(e => e.trim()).filter(Boolean)

async function enviarPorGraph({ to, subject, html }) {
  const token = await obtenerTokenGraph()
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(GRAPH.buzon)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: html },
        from: { emailAddress: { address: GRAPH.buzon, name: GRAPH.nombre } },
        toRecipients: listaEmails(to).map(address => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Graph sendMail ${res.status}: ${err.error?.message || res.statusText}`)
  }
}

// Misma interfaz que nodemailer (sendMail) para no tocar a quien lo usa.
const transport = {
  async sendMail(msg) {
    if (graphActivo) {
      try {
        return await enviarPorGraph(msg)
      } catch (e) {
        console.error('Email Graph falló, se reintenta por SMTP:', e.message)
      }
    }
    return smtp.sendMail(msg)
  },
}
console.log(`Correo saliente: ${graphActivo ? `Microsoft Graph (${GRAPH.buzon}) con respaldo SMTP` : 'SMTP'}`)

// tipo → clave en la columna JSONB notificaciones
const TIPO_KEY = {
  nuevo_albaran:     'nuevo',
  firma_completada:  'firma',
  albaran_cerrado:   'cerrado',
  humedad_pendiente: 'humedad',
}

// Buzón único de Comsa al que llegan todas las notificaciones internas
// (en vez de a cada usuario según sus preferencias).
const EMAIL_NOTIFICACIONES_INTERNAS = process.env.EMAIL_NOTIFICACIONES || 'albaranes.bio@comsa.com'

/**
 * Devuelve los destinatarios de una notificación interna del tipo indicado.
 */
async function destinatarios(tipo) {
  if (!TIPO_KEY[tipo]) return []
  return [EMAIL_NOTIFICACIONES_INTERNAS]
}

/**
 * Devuelve el email (o emails, separados por coma) configurado en
 * Administración para la empresa indicada (instalación o astilladora),
 * junto con su contacto.
 */
async function destinatarioEmpresa(tipo, nombre) {
  if (!nombre) return { emails: [], contacto: null }
  const { rows } = await pool.query(
    `SELECT email, contacto FROM proveedores
     WHERE tipo = $1 AND nombre = $2 AND activo = true
     LIMIT 1`,
    [tipo, nombre]
  )
  const row = rows[0]
  if (!row?.email) return { emails: [], contacto: null }
  return {
    emails: row.email.split(',').map(e => e.trim()).filter(Boolean),
    contacto: row.contacto || null,
  }
}

const destinatarioInstalacion  = (nombre) => destinatarioEmpresa('instalacion', nombre)
const destinatarioAstilladora  = (nombre) => destinatarioEmpresa('astilladora', nombre)
const destinatarioProveedor    = (nombre) => destinatarioEmpresa('proveedor', nombre)

/**
 * URL del logotipo corporativo configurado en Administración
 * (el mismo que se usa como cabecera de los PDF de los albaranes).
 */
const LOGO_URL_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000 // 10 años: un email puede abrirse mucho después de enviarse

async function logoComsaUrl() {
  const { rows } = await pool.query(`SELECT url FROM logos WHERE id = 'comsa'`)
  if (!rows[0]?.url) return null
  // El bucket es privado: la URL guardada en BD es solo el path interno de
  // MinIO, hay que firmarla para que el cliente de correo pueda cargarla.
  return signPath(rows[0].url, LOGO_URL_TTL_MS)
}

module.exports = { transport, destinatarios, destinatarioInstalacion, destinatarioAstilladora, destinatarioProveedor, logoComsaUrl }

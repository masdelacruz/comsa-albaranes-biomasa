/**
 * mailer.js — transporte SMTP compartido + helper para obtener
 * destinatarios según sus preferencias de notificación.
 */
const nodemailer = require('nodemailer')
const pool       = require('./db')
const { signPath } = require('./lib/signedUrl')

const transport = nodemailer.createTransport({
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

/**
 * mailer.js — transporte SMTP compartido + helper para obtener
 * destinatarios según sus preferencias de notificación.
 */
const nodemailer = require('nodemailer')
const pool       = require('./db')

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

/**
 * Devuelve los emails de usuarios activos que tienen activa
 * la notificación del tipo indicado (o sin preferencia explícita → true por defecto).
 */
async function destinatarios(tipo) {
  const key = TIPO_KEY[tipo]
  if (!key) return []
  const { rows } = await pool.query(
    `SELECT email FROM usuarios
     WHERE activo = true
       AND (notificaciones->>'silenciado')::boolean IS NOT TRUE
       AND (notificaciones->$1)::boolean IS NOT FALSE`,
    [key]
  )
  return rows.map(r => r.email)
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

/**
 * URL del logotipo corporativo configurado en Administración
 * (el mismo que se usa como cabecera de los PDF de los albaranes).
 */
async function logoComsaUrl() {
  const { rows } = await pool.query(`SELECT url FROM logos WHERE id = 'comsa'`)
  return rows[0]?.url || null
}

module.exports = { transport, destinatarios, destinatarioInstalacion, destinatarioAstilladora, logoComsaUrl }

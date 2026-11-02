const { Pool, types } = require('pg')

// Las columnas DATE (OID 1082) se devuelven tal cual ('2026-11-02'). Por
// defecto pg las convierte en un Date a medianoche de la zona del proceso
// (TZ=Europe/Madrid), que en JSON sale como '2026-11-01T23:00:00Z': todas
// las fechas se veían un día antes.
types.setTypeParser(1082, v => v)

const pool = new Pool({
  host:     process.env.POSTGRES_HOST || 'db',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
})

// Un cliente inactivo del pool puede fallar (p. ej. si la BD se reinicia);
// sin este manejador el evento 'error' sin escuchar tumba el proceso.
pool.on('error', (e) => console.error('Error en conexión inactiva de PostgreSQL:', e.message))

module.exports = pool

const express   = require('express')
const cors      = require('cors')
const path      = require('path')
const { Client: MinioClient } = require('minio')

const app  = express()
const PORT = process.env.PORT || 3001
app.disable('x-powered-by')

// Express 4 no captura errores de rutas async: sin esto, un fallo puntual
// (p. ej. la BD reiniciándose) tumbaría el proceso entero.
process.on('unhandledRejection', (e) => console.error('Promesa rechazada sin capturar:', e))

const REQUIRED_SECRETS = ['JWT_SECRET', 'POSTGRES_PASSWORD', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY']
const missingSecrets = REQUIRED_SECRETS.filter(name => !process.env[name])
if (process.env.NODE_ENV === 'production' && missingSecrets.length) {
  throw new Error(`Configuración de seguridad incompleta: ${missingSecrets.join(', ')}`)
}
if (process.env.NODE_ENV === 'production' && Buffer.byteLength(process.env.JWT_SECRET || '', 'utf8') < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 bytes en producción')
}

// ── MinIO client ──────────────────────────────────────────────────
const minio = new MinioClient({
  endPoint:  process.env.MINIO_ENDPOINT  || 'minio',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
})

const BUCKET = process.env.MINIO_BUCKET || 'documentos'

async function initMinio() {
  const exists = await minio.bucketExists(BUCKET)
  if (!exists) {
    await minio.makeBucket(BUCKET)
    console.log(`Bucket '${BUCKET}' creado (privado — sin política de lectura pública).`)
  }
  // Fase 0 (0C): el bucket ya no debe ser de lectura pública. Si el
  // contenedor arranca contra un bucket creado por una versión anterior
  // (que sí tenía política pública), se retira aquí en cada arranque.
  try {
    const policy = await minio.getBucketPolicy(BUCKET)
    if (policy) {
      await minio.setBucketPolicy(BUCKET, '')
      console.log(`Bucket '${BUCKET}': política de lectura pública retirada.`)
    }
  } catch {
    // Sin política (ya privado) → MinIO responde con error; es el caso normal.
  }
}

app.set('minio', minio)
app.set('minio_bucket', BUCKET)

// ── Proxy trust (IP real del cliente tras Apache) ─────────────────
app.set('trust proxy', 1)

// ── CORS — solo origen de producción + localhost dev ──────────────
const _allowedOrigins = [
  process.env.APP_URL,
  'http://localhost:5173',
  'http://localhost:3001',
].filter(Boolean)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || _allowedOrigins.includes(origin)) return cb(null, true)
    cb(Object.assign(new Error('CORS not allowed'), { status: 403 }))
  },
}))

// ── Security headers ──────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "frame-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; ')
  )
  next()
})

app.use(express.json({ limit: '2mb' }))

// Las respuestas de la API llevan datos personales/de negocio: que ni el
// navegador ni proxies intermedios las guarden en caché.
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })

// ── API routes bajo /api ──────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'))
app.use('/api/auth',      require('./routes/auth-microsoft'))
app.use('/api/albaranes', require('./routes/albaranes'))
app.use('/api/empresas',  require('./routes/empresas'))
app.use('/api/usuarios',  require('./routes/usuarios'))
app.use('/api/storage',   require('./routes/storage'))
app.use('/api/email',     require('./routes/email'))
app.use('/api/elementos', require('./routes/elementos'))
app.use('/api/notificaciones', require('./routes/notificaciones'))
app.use('/api/auditoria', require('./routes/auditoria'))

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// ── Frontend estático (build de Vite) ─────────────────────────────
const PUBLIC = path.join(__dirname, 'public')
app.use(express.static(PUBLIC))
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')))

// ── Errores no controlados: respuesta genérica, sin detalles internos ──
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500
  if (status >= 500) console.error('Error no controlado:', err)
  if (res.headersSent) return
  res.status(status).json({ error: status < 500 ? 'Petición no válida' : 'Error interno' })
})

// ── Arranque ──────────────────────────────────────────────────────
initMinio().catch(e => console.error('MinIO init error:', e))
app.listen(PORT, () => console.log(`Servidor escuchando en :${PORT}`))

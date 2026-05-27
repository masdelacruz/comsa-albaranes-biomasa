const express   = require('express')
const cors      = require('cors')
const path      = require('path')
const { Client: MinioClient } = require('minio')

const app  = express()
const PORT = process.env.PORT || 3001

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
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${BUCKET}/*`] }],
    })
    await minio.setBucketPolicy(BUCKET, policy)
    console.log(`Bucket '${BUCKET}' creado.`)
  }
}

app.set('minio', minio)
app.set('minio_bucket', BUCKET)

// ── Middleware ────────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── API routes bajo /api ──────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'))
app.use('/api/albaranes', require('./routes/albaranes'))
app.use('/api/empresas',  require('./routes/empresas'))
app.use('/api/usuarios',  require('./routes/usuarios'))
app.use('/api/storage',   require('./routes/storage'))
app.use('/api/email',     require('./routes/email'))
app.use('/api/elementos', require('./routes/elementos'))

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// ── Frontend estático (build de Vite) ─────────────────────────────
const PUBLIC = path.join(__dirname, 'public')
app.use(express.static(PUBLIC))
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')))

// ── Arranque ──────────────────────────────────────────────────────
initMinio().catch(e => console.error('MinIO init error:', e))
app.listen(PORT, () => console.log(`Servidor escuchando en :${PORT}`))

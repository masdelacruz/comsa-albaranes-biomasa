const express   = require('express')
const cors      = require('cors')
const { Client: MinioClient } = require('minio')

const app  = express()
const PORT = process.env.PORT || 3001

// ── MinIO client (global, disponible en rutas) ────────────────────
const minio = new MinioClient({
  endPoint:  process.env.MINIO_ENDPOINT  || 'minio',
  port:      parseInt(process.env.MINIO_PORT || '9000'),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
})

const BUCKET = process.env.MINIO_BUCKET || 'documentos'

// Asegura que el bucket existe al arrancar
async function initMinio() {
  const exists = await minio.bucketExists(BUCKET)
  if (!exists) {
    await minio.makeBucket(BUCKET)
    // Política pública de lectura (las URLs de docs son públicas)
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      }],
    })
    await minio.setBucketPolicy(BUCKET, policy)
    console.log(`Bucket '${BUCKET}' creado.`)
  }
}

// Exportar para uso en rutas
app.set('minio', minio)
app.set('minio_bucket', BUCKET)

// ── Middleware ────────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ── Rutas ─────────────────────────────────────────────────────────
app.use('/auth',       require('./routes/auth'))
app.use('/albaranes',  require('./routes/albaranes'))
app.use('/empresas',   require('./routes/empresas'))
app.use('/usuarios',   require('./routes/usuarios'))
app.use('/storage',    require('./routes/storage'))
app.use('/email',      require('./routes/email'))

// Health check (Zabbix / Portainer lo puede usar)
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

// ── Arranque ──────────────────────────────────────────────────────
initMinio().catch(e => console.error('MinIO init error:', e))

app.listen(PORT, () => console.log(`API escuchando en :${PORT}`))

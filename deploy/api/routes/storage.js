const router = require('express').Router()
const multer = require('multer')
const pool   = require('../db')
const { requireAuth } = require('./auth')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

function limpiarNombre(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getPublicUrl(req, bucket, path) {
  // Las URLs públicas pasan por el proxy Apache → /storage/file/...
  return `${process.env.APP_URL}/api/storage/file/${encodeURIComponent(path)}`
}

// ── GET /storage/file/*  (PÚBLICO — descarga de documentos) ──────
router.get('/file/*', async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const path   = decodeURIComponent(req.params[0])
  try {
    const stream = await minio.getObject(bucket, path)
    stream.pipe(res)
  } catch {
    res.status(404).json({ error: 'Fichero no encontrado' })
  }
})

// ── POST /storage/upload/:albaranId/doc  (requiere auth) ─────────
router.post('/upload/:albaranId/doc', requireAuth, upload.single('file'), async (req, res) => {
  const minio      = req.app.get('minio')
  const bucket     = req.app.get('minio_bucket')
  const { albaranId } = req.params
  const { docNombre } = req.body
  const fichero    = req.file

  const ext  = (fichero.originalname.split('.').pop() || 'bin')
  const path = `${albaranId}/${limpiarNombre(docNombre)}_${Date.now()}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, {
    'Content-Type': fichero.mimetype,
  })
  const url = getPublicUrl(req, bucket, path)

  await pool.query(
    `UPDATE docs SET adjunto=true, url=$1, nombre_fichero=$2, tipo_fichero=$3, tamanyo=$4
     WHERE albaran_id=$5 AND nombre=$6`,
    [url, fichero.originalname, fichero.mimetype, fichero.size, albaranId, docNombre]
  )
  const fecha = new Date().toLocaleString('es-ES')
  await pool.query(
    'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
    [albaranId, fecha, `Documento adjuntado: ${docNombre}`, req.user.nombre || 'Oficina']
  )
  res.json({ url })
})

// ── POST /storage/upload/:albaranId/ticket  (PÚBLICO — campo) ────
router.post('/upload/:albaranId/ticket', upload.single('file'), async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { albaranId } = req.params
  const actor  = req.body.actor || 'Sistema'
  const fichero = req.file

  const ext  = (fichero.originalname.split('.').pop() || 'bin')
  const path = `${albaranId}/ticket_pesada_${Date.now()}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, {
    'Content-Type': fichero.mimetype,
  })
  const url = getPublicUrl(req, bucket, path)

  await pool.query(
    'UPDATE pesada SET ticket_adjunto=true, ticket_url=$1 WHERE albaran_id=$2',
    [url, albaranId]
  )
  const fecha = new Date().toLocaleString('es-ES')
  await pool.query(
    'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
    [albaranId, fecha, 'Ticket de pesada adjuntado', actor]
  )
  res.json({ url })
})

// ── POST /storage/upload/:albaranId/logo  (requiere auth) ────────
router.post('/upload/logos/:logoId', requireAuth, upload.single('file'), async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { logoId } = req.params
  const fichero = req.file

  const ext  = (fichero.originalname.split('.').pop() || 'png')
  const path = `logos/${logoId}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, {
    'Content-Type': fichero.mimetype,
  })
  const url = getPublicUrl(req, bucket, path)

  await pool.query(
    `INSERT INTO logos (id,url,updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (id) DO UPDATE SET url=$2, updated_at=NOW()`,
    [logoId, url]
  )
  res.json({ url })
})

// ── DELETE /storage/logos/:logoId  (requiere auth) ───────────────
router.delete('/logos/:logoId', requireAuth, async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { logoId } = req.params

  // Buscar el objeto en MinIO y borrarlo
  const { rows } = await pool.query('SELECT url FROM logos WHERE id=$1', [req.params.logoId])
  if (rows[0]?.url) {
    const path = decodeURIComponent(rows[0].url.split('/api/storage/file/')[1] || '')
    if (path) await minio.removeObject(bucket, path).catch(() => {})
  }
  await pool.query('DELETE FROM logos WHERE id=$1', [logoId])
  res.json({ ok: true })
})

// ── GET /storage/logos  (requiere auth) ──────────────────────────
router.get('/logos', requireAuth, async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM logos')
  const map = {}
  rows.forEach(r => { map[r.id] = r.url })
  res.json(map)
})

module.exports = router

const router = require('express').Router()
const multer = require('multer')
const pool   = require('../db')
const { requireAuth, requireConfigAccess } = require('./auth')
const { requireAuthOrCampoToken } = require('../lib/campoAuth')
const { signPath, verifySignedPath, toPath } = require('../lib/signedUrl')
const { contentMatchesAllowlist } = require('../lib/sniffMime')
const { registrarAuditoria } = require('../lib/auditoria')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

function limpiarNombre(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

// ── GET /storage/file/*  (descarga — requiere URL firmada) ───────
// El bucket es privado. Nadie puede leer un objeto sin una firma válida y
// no caducada, generada por la API al construir la respuesta de un albarán
// (ver lib/signedUrl.js). No requiere sesión: la firma ES la autorización.
router.get('/file/*', async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const path   = decodeURIComponent(req.params[0])
  if (!verifySignedPath(path, req.query.exp, req.query.sig)) {
    return res.status(403).json({ error: 'Enlace caducado o no válido' })
  }
  try {
    const stream = await minio.getObject(bucket, path)
    res.setHeader('Cache-Control', 'private, max-age=300')
    stream.pipe(res)
  } catch {
    res.status(404).json({ error: 'Fichero no encontrado' })
  }
})

const ALLOWED_DOC_EXTS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx'])

// ── POST /storage/upload/:albaranId/doc  (requiere auth) ─────────
router.post('/upload/:albaranId/doc', requireAuth, upload.single('file'), async (req, res) => {
  const minio      = req.app.get('minio')
  const bucket     = req.app.get('minio_bucket')
  const { albaranId } = req.params
  const { docNombre } = req.body
  const fichero    = req.file
  if (!fichero) return res.status(400).json({ error: 'Falta el fichero' })

  const ext = (fichero.originalname.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_DOC_EXTS.has(ext)) return res.status(400).json({ error: 'Tipo de fichero no permitido' })
  if (!contentMatchesAllowlist(fichero.buffer, [ext])) {
    return res.status(400).json({ error: 'El contenido del fichero no coincide con su extensión' })
  }

  const path = `${albaranId}/${limpiarNombre(docNombre)}_${Date.now()}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, {
    'Content-Type': fichero.mimetype,
  })

  // UPSERT manual: actualiza si existe, inserta si no (adjunto masivo puede enviar
  // tipos de doc que no están en el template del albarán, ej. SURE en Op1)
  const upd = await pool.query(
    `UPDATE docs SET adjunto=true, url=$1, nombre_fichero=$2, tipo_fichero=$3, tamanyo=$4
     WHERE albaran_id=$5 AND nombre=$6`,
    [path, fichero.originalname, fichero.mimetype, fichero.size, albaranId, docNombre]
  )
  if (upd.rowCount === 0) {
    await pool.query(
      `INSERT INTO docs (albaran_id, nombre, adjunto, url, nombre_fichero, tipo_fichero, tamanyo)
       VALUES ($1, $2, true, $3, $4, $5, $6)`,
      [albaranId, docNombre, path, fichero.originalname, fichero.mimetype, fichero.size]
    )
  }
  const fecha = new Date().toLocaleString('es-ES')
  await pool.query(
    'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
    [albaranId, fecha, `Documento adjuntado: ${docNombre}`, req.user.nombre || 'Oficina']
  )
  res.json({ url: signPath(path) })
})

const ALLOWED_TICKET_EXTS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp'])

// ── POST /storage/upload/:albaranId/ticket  (oficina o token de campo) ──
router.post('/upload/:albaranId/ticket', requireAuthOrCampoToken(), upload.single('file'), async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { albaranId } = req.params
  const actor  = req.body.actor || 'Sistema'
  const fichero = req.file
  if (!fichero) return res.status(400).json({ error: 'Falta el fichero' })

  const { rows: exists } = await pool.query('SELECT id FROM albaranes WHERE id=$1', [albaranId])
  if (!exists.length) return res.status(404).json({ error: 'Albarán no encontrado' })

  const ext = (fichero.originalname.split('.').pop() || '').toLowerCase()
  if (!ALLOWED_TICKET_EXTS.has(ext)) return res.status(400).json({ error: 'Tipo de fichero no permitido' })
  if (!contentMatchesAllowlist(fichero.buffer, [ext])) {
    return res.status(400).json({ error: 'El contenido del fichero no coincide con su extensión' })
  }

  const path = `${albaranId}/ticket_pesada_${Date.now()}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, {
    'Content-Type': fichero.mimetype,
  })

  await pool.query(
    'UPDATE pesada SET ticket_adjunto=true, ticket_url=$1 WHERE albaran_id=$2',
    [path, albaranId]
  )
  const fecha = new Date().toLocaleString('es-ES')
  await pool.query(
    'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
    [albaranId, fecha, 'Ticket de pesada adjuntado', actor]
  )
  res.json({ url: signPath(path) })
})

const ALLOWED_IMG_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp'])

// ── POST /storage/upload/empresa/:empresaId/firma  (Configuración) ──
router.post('/upload/empresa/:empresaId/firma', requireAuth, requireConfigAccess, upload.single('file'), async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { empresaId } = req.params
  const fichero = req.file
  if (!fichero) return res.status(400).json({ error: 'Falta el fichero' })

  const ext = (fichero.originalname.split('.').pop() || 'png').toLowerCase()
  if (!ALLOWED_IMG_EXTS.has(ext) || !contentMatchesAllowlist(fichero.buffer, [ext])) {
    return res.status(400).json({ error: 'La firma debe ser una imagen (PNG, JPG o WEBP)' })
  }
  const path = `firmas_empresa/${empresaId}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, { 'Content-Type': fichero.mimetype })

  await pool.query(
    'UPDATE proveedores SET firma_imagen=$1 WHERE id=$2',
    [path, empresaId]
  )
  registrarAuditoria({
    usuario: req.user, accion: 'editar', entidad: 'firma_empresa', entidadId: empresaId,
    detalle: 'Firma oficial de empresa actualizada',
  })
  res.json({ url: signPath(path) })
})

// ── POST /storage/upload/:albaranId/logo  (Configuración) ────────
router.post('/upload/logos/:logoId', requireAuth, requireConfigAccess, upload.single('file'), async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { logoId } = req.params
  const fichero = req.file
  if (!fichero) return res.status(400).json({ error: 'Falta el fichero' })

  const ext = (fichero.originalname.split('.').pop() || 'png').toLowerCase()
  if (!ALLOWED_IMG_EXTS.has(ext) || !contentMatchesAllowlist(fichero.buffer, [ext])) {
    return res.status(400).json({ error: 'El logo debe ser una imagen (PNG, JPG o WEBP)' })
  }
  const path = `logos/${logoId}.${ext}`

  await minio.putObject(bucket, path, fichero.buffer, fichero.size, {
    'Content-Type': fichero.mimetype,
  })

  await pool.query(
    `INSERT INTO logos (id,url,updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (id) DO UPDATE SET url=$2, updated_at=NOW()`,
    [logoId, path]
  )
  registrarAuditoria({
    usuario: req.user, accion: 'editar', entidad: 'logo', entidadId: logoId,
    detalle: `Logo actualizado: ${logoId}`,
  })
  res.json({ url: signPath(path) })
})

// ── DELETE /storage/logos/:logoId  (Configuración) ───────────────
router.delete('/logos/:logoId', requireAuth, requireConfigAccess, async (req, res) => {
  const minio  = req.app.get('minio')
  const bucket = req.app.get('minio_bucket')
  const { logoId } = req.params

  const { rows } = await pool.query('SELECT url FROM logos WHERE id=$1', [req.params.logoId])
  if (rows[0]?.url) {
    await minio.removeObject(bucket, toPath(rows[0].url)).catch(() => {})
  }
  await pool.query('DELETE FROM logos WHERE id=$1', [logoId])
  registrarAuditoria({
    usuario: req.user, accion: 'borrar', entidad: 'logo', entidadId: logoId,
    detalle: `Logo eliminado: ${logoId}`,
  })
  res.json({ ok: true })
})

// ── GET /storage/logos/public/:id  (PÚBLICO — logo panel instalación) ──
router.get('/logos/public/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT url FROM logos WHERE id=$1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'No encontrado' })
  res.json({ url: signPath(rows[0].url) })
})

// ── GET /storage/logos  (requiere auth) ──────────────────────────
router.get('/logos', requireAuth, async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM logos')
  const map = {}
  rows.forEach(r => { map[r.id] = signPath(r.url) })
  res.json(map)
})

module.exports = router

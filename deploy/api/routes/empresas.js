const router = require('express').Router()
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const pool   = require('../db')
const { requireAuth, requireConfigAccess, requireSuperadmin } = require('./auth')
const { registrarAuditoria } = require('../lib/auditoria')

// Referencia SURE efectiva de un proveedor: solo cuenta si está marcado
// como SURE. Se guarda recortada y en mayúsculas (formato de certificado).
function refSure(esSure, referencia) {
  if (!esSure) return null
  const r = typeof referencia === 'string' ? referencia.trim().toUpperCase() : ''
  return r || null
}

// Copia la referencia SURE del proveedor a sus albaranes de Opción 2 que
// siguen abiertos. Los cerrados o anulados conservan la que tenían.
async function propagarReferenciaSure(nombre, referencia) {
  if (!nombre) return 0
  const { rowCount } = await pool.query(
    `UPDATE albaranes SET referencia_sure=$1
     WHERE proveedor=$2 AND tipo LIKE 'Opción 2%'
       AND estado NOT IN ('cerrado','cancelado')
       AND referencia_sure IS DISTINCT FROM $1`,
    [referencia, nombre]
  )
  return rowCount
}

// Una misma empresa puede estar dada de alta con varios tipos (p. ej.
// proveedor y astilladora): cada tipo es una fila, pero sus datos de
// contacto son los mismos y se mantienen sincronizados por nombre.
const CAMPOS_COMPARTIDOS = ['contacto', 'email', 'telefono']

async function sincronizarHermanas(id) {
  const { rows: [e] } = await pool.query(
    'SELECT nombre, contacto, email, telefono FROM proveedores WHERE id=$1', [id]
  )
  if (!e) return
  await pool.query(
    `UPDATE proveedores SET contacto=$1, email=$2, telefono=$3
     WHERE lower(nombre)=lower($4) AND id<>$5`,
    [e.contacto, e.email, e.telefono, e.nombre, id]
  )
}

function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── GET /empresas?tipo=astilladora ────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { tipo, activo } = req.query
  let query = 'SELECT * FROM proveedores WHERE 1=1'
  const vals = []
  if (tipo)   { vals.push(tipo);   query += ` AND tipo=$${vals.length}` }
  if (activo) { vals.push(activo === 'true'); query += ` AND activo=$${vals.length}` }
  query += ' ORDER BY nombre'
  const { rows } = await pool.query(query, vals)
  res.json(rows)
})

// ── POST /empresas ────────────────────────────────────────────────
router.post('/', requireAuth, requireConfigAccess, async (req, res) => {
  const { nombre, tipo, contacto, email, telefono, notas, activo, trabajadores, maquinas, horario } = req.body
  const esSure = tipo === 'proveedor' && !!req.body.es_sure
  const id = uuidv4()
  await pool.query(
    `INSERT INTO proveedores (id,nombre,tipo,contacto,email,telefono,notas,activo,trabajadores,maquinas,horario,es_sure,referencia_sure)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, toTitleCase(nombre), tipo, toTitleCase(contacto)||null, email||null, telefono||null, notas||null, activo??true,
     JSON.stringify(trabajadores||[]), JSON.stringify(maquinas||[]), horario||null,
     esSure, refSure(esSure, req.body.referencia_sure)]
  )
  // Si la empresa ya existe con otro tipo, los datos que no se han indicado
  // se heredan de ella; los indicados pasan a ser los de todas.
  const { rows: [hermana] } = await pool.query(
    'SELECT contacto, email, telefono FROM proveedores WHERE lower(nombre)=lower($1) AND id<>$2 LIMIT 1',
    [toTitleCase(nombre), id]
  )
  if (hermana) {
    const { rows: [nueva] } = await pool.query('SELECT contacto, email, telefono FROM proveedores WHERE id=$1', [id])
    await pool.query(
      'UPDATE proveedores SET contacto=$1, email=$2, telefono=$3 WHERE id=$4',
      CAMPOS_COMPARTIDOS.map(c => nueva[c] || hermana[c] || null).concat(id)
    )
    await sincronizarHermanas(id)
  }
  const { rows } = await pool.query('SELECT * FROM proveedores WHERE id=$1', [id])
  registrarAuditoria({
    usuario: req.user, accion: 'crear', entidad: 'proveedor', entidadId: id,
    detalle: `${tipo}: ${rows[0]?.nombre}`,
  })
  res.json(rows[0])
})

// ── PATCH /empresas/:id ───────────────────────────────────────────
router.patch('/:id', requireAuth, requireConfigAccess, async (req, res) => {
  if (req.body.nombre) req.body.nombre = toTitleCase(req.body.nombre)
  if (req.body.contacto) req.body.contacto = toTitleCase(req.body.contacto)
  const { rows: prevRows } = await pool.query('SELECT nombre, tipo, es_sure, referencia_sure FROM proveedores WHERE id=$1', [req.params.id])
  if (!prevRows.length) return res.status(404).json({ error: 'No encontrado' })
  const prev = prevRows[0]
  if (req.body.es_sure !== undefined || req.body.referencia_sure !== undefined || req.body.tipo !== undefined) {
    const esSure = (req.body.tipo ?? prev.tipo) === 'proveedor' && !!(req.body.es_sure ?? prev.es_sure)
    req.body.es_sure = esSure
    req.body.referencia_sure = refSure(esSure, req.body.referencia_sure ?? prev.referencia_sure)
  }
  const fields = ['nombre','tipo','contacto','email','telefono','notas','activo','trabajadores','maquinas','horario','es_sure','referencia_sure']
  const jsonbFields = new Set(['trabajadores', 'maquinas'])
  const updates = [], vals = []
  let idx = 1
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f}=$${idx++}`)
      vals.push(jsonbFields.has(f) ? JSON.stringify(req.body[f]) : req.body[f])
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'Sin cambios' })
  vals.push(req.params.id)
  await pool.query(`UPDATE proveedores SET ${updates.join(',')} WHERE id=$${idx}`, vals)
  if (CAMPOS_COMPARTIDOS.some(c => req.body[c] !== undefined)) {
    await sincronizarHermanas(req.params.id)
  }
  const { rows } = await pool.query('SELECT * FROM proveedores WHERE id=$1', [req.params.id])
  if (prev.tipo === 'proveedor' && (prev.referencia_sure || null) !== (rows[0]?.referencia_sure || null)) {
    await propagarReferenciaSure(rows[0].nombre, rows[0].referencia_sure || null)
  }
  registrarAuditoria({
    usuario: req.user, accion: 'editar', entidad: 'proveedor', entidadId: req.params.id,
    detalle: `${rows[0]?.nombre} — campos: ${fields.filter(f => req.body[f] !== undefined).join(', ')}`,
  })
  res.json(rows[0])
})

// ── POST /empresas/:id/regenerar-codigo-acceso ──────────────────────
// Invalida el enlace de panel público actual de la empresa (con su código
// viejo) y genera uno nuevo. Solo superadmin.
router.post('/:id/regenerar-codigo-acceso', requireAuth, requireSuperadmin, async (req, res) => {
  const nuevoCodigo = crypto.randomBytes(16).toString('hex')
  const { rows } = await pool.query(
    'UPDATE proveedores SET acceso_codigo=$1 WHERE id=$2 RETURNING nombre',
    [nuevoCodigo, req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'No encontrado' })
  registrarAuditoria({
    usuario: req.user, accion: 'editar', entidad: 'proveedor', entidadId: req.params.id,
    detalle: `Código de acceso al panel regenerado: ${rows[0].nombre}`,
  })
  res.json({ acceso_codigo: nuevoCodigo })
})

// ── DELETE /empresas/:id ──────────────────────────────────────────
router.delete('/:id', requireAuth, requireConfigAccess, async (req, res) => {
  const { rows } = await pool.query('SELECT nombre, tipo FROM proveedores WHERE id=$1', [req.params.id])
  await pool.query('DELETE FROM proveedores WHERE id=$1', [req.params.id])
  registrarAuditoria({
    usuario: req.user, accion: 'borrar', entidad: 'proveedor', entidadId: req.params.id,
    detalle: rows[0] ? `${rows[0].tipo}: ${rows[0].nombre}` : null,
  })
  res.json({ ok: true })
})

module.exports = router

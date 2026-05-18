const router = require('express').Router()
const pool   = require('../db')
const { requireAuth } = require('./auth')

// Rutas de /campo/:id son públicas — todo lo demás requiere auth
// El frontend llama con o sin token según el contexto.

// ── Helper: arma el objeto completo de un albarán ─────────────────
async function fetchOne(id) {
  const [aRes, fRes, pRes, dRes, actRes] = await Promise.all([
    pool.query('SELECT * FROM albaranes WHERE id = $1', [id]),
    pool.query('SELECT * FROM firmas WHERE albaran_id = $1', [id]),
    pool.query('SELECT * FROM pesada WHERE albaran_id = $1', [id]),
    pool.query('SELECT * FROM docs WHERE albaran_id = $1', [id]),
    pool.query('SELECT * FROM actividad WHERE albaran_id = $1 ORDER BY created_at ASC', [id]),
  ])
  const a = aRes.rows[0]
  if (!a) return null
  // Carga firmas de empresa (para campo click-to-sign)
  const empresasNombres = [a.proveedor, a.astilladora, a.transportista, a.instalacion].filter(Boolean)
  const empresaFirmaMap = {}
  if (empresasNombres.length) {
    const eRes = await pool.query(
      'SELECT nombre, firma_imagen FROM proveedores WHERE nombre = ANY($1)',
      [empresasNombres]
    )
    eRes.rows.forEach(e => { if (e.firma_imagen) empresaFirmaMap[e.nombre] = e.firma_imagen })
  }
  return buildAlbaran(a, fRes.rows, pRes.rows[0], dRes.rows, actRes.rows, empresaFirmaMap)
}

function buildAlbaran(a, firmas, pesada, docs, actividad, empresaFirmaMap = {}) {
  const firmasObj = {}
  firmas.forEach(f => {
    firmasObj[f.rol] = {
      firmado: f.firmado, fecha: f.fecha, actor: f.actor,
      nombrePersona: f.nombre_persona || null,
      firmaImagen: f.firma_imagen || null,
      ipOrigen: f.ip_origen || null,
    }
  })
  const p = pesada || {}
  const docsObj = {}
  docs.forEach(d => {
    docsObj[d.nombre] = {
      adjunto: d.adjunto, url: d.url || null,
      nombreFichero: d.nombre_fichero || null,
      tipoFichero: d.tipo_fichero || null,
      tamanyo: d.tamanyo || null,
    }
  })
  return {
    id: a.id, fecha: a.fecha ? new Date(a.fecha).toISOString().slice(0,10) : null, hora: a.hora, numCamiones: a.num_camiones,
    tipo: a.tipo, proveedor: a.proveedor, astilladora: a.astilladora,
    transportista: a.transportista, instalacion: a.instalacion,
    especie: a.especie, tipoBiomasa: a.tipo_biomasa,
    origen: a.origen, permiso: a.permiso, observaciones: a.observaciones,
    estado: a.estado, mapsOrigen: a.maps_origen, mapsDestino: a.maps_destino,
    matriculaTractora: a.matricula_tractora, matriculaRemolque: a.matricula_remolque,
    chofer: a.chofer, certificacion: a.certificacion || [],
    firmas: firmasObj,
    empresaFirmaMap,
    pesada: {
      entrada: p.entrada || null, salida: p.salida || null,
      humedad: p.humedad || null,
      ticketAdjunto: p.ticket_adjunto || false,
      ticketUrl: p.ticket_url || null,
    },
    docs: docsObj,
    actividad: actividad.map(ev => ({ ts: ev.ts, texto: ev.texto, actor: ev.actor })),
  }
}

// ── GET /albaranes  (requiere auth) ──────────────────────────────
router.get('/', requireAuth, async (_req, res) => {
  const { rows: albs } = await pool.query(
    'SELECT * FROM albaranes ORDER BY created_at DESC'
  )
  if (!albs.length) return res.json([])

  const ids = albs.map(a => `'${a.id}'`).join(',')
  const [fRes, pRes, dRes, actRes] = await Promise.all([
    pool.query(`SELECT * FROM firmas WHERE albaran_id IN (${ids})`),
    pool.query(`SELECT * FROM pesada WHERE albaran_id IN (${ids})`),
    pool.query(`SELECT * FROM docs WHERE albaran_id IN (${ids})`),
    pool.query(`SELECT * FROM actividad WHERE albaran_id IN (${ids}) ORDER BY created_at ASC`),
  ])

  // Carga imágenes de firma/sello de todas las empresas referenciadas (una sola query)
  const allNombres = [...new Set(
    albs.flatMap(a => [a.proveedor, a.astilladora, a.transportista, a.instalacion].filter(Boolean))
  )]
  const empresaFirmaMap = {}
  if (allNombres.length) {
    const eRes = await pool.query(
      'SELECT nombre, firma_imagen FROM proveedores WHERE nombre = ANY($1) AND firma_imagen IS NOT NULL',
      [allNombres]
    )
    eRes.rows.forEach(e => { empresaFirmaMap[e.nombre] = e.firma_imagen })
  }

  const result = albs.map(a =>
    buildAlbaran(
      a,
      fRes.rows.filter(f => f.albaran_id === a.id),
      pRes.rows.find(p => p.albaran_id === a.id),
      dRes.rows.filter(d => d.albaran_id === a.id),
      actRes.rows.filter(ev => ev.albaran_id === a.id),
      empresaFirmaMap,
    )
  )
  res.json(result)
})

// ── GET /albaranes/:id  (PÚBLICO — usado por vista de campo) ──────
router.get('/:id', async (req, res) => {
  const albaran = await fetchOne(req.params.id)
  if (!albaran) return res.status(404).json({ error: 'No encontrado' })
  res.json(albaran)
})

// ── POST /albaranes  (requiere auth) ─────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const f = req.body
  const { rows } = await pool.query('SELECT next_albaran_id() AS id')
  const id   = rows[0].id
  const fecha = new Date().toLocaleString('es-ES')
  const esOp1 = f.tipo?.includes('1')
  const docs  = esOp1
    ? ['Autodeclaración', 'Acuerdo de cesión', 'Contrato prestación servicios', 'Permiso de corta']
    : ['Autodeclaración', 'Certificado SURE', 'Permiso de obra', 'Contrato prestación servicios']

  // Normalizar certificacion: puede llegar como string 'SURE,PEFC' o array o vacío
  const certArray = Array.isArray(f.certificacion)
    ? f.certificacion
    : (typeof f.certificacion === 'string' && f.certificacion
        ? f.certificacion.split(',').filter(Boolean)
        : [])

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO albaranes (id,fecha,hora,num_camiones,tipo,proveedor,astilladora,
       transportista,instalacion,especie,tipo_biomasa,origen,permiso,observaciones,
       estado,maps_origen,maps_destino,matricula_tractora,matricula_remolque,
       chofer,certificacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pendiente_campo',$15,$16,$17,$18,$19,$20)`,
      [id, f.fecha, f.hora, f.numCamiones, f.tipo, f.proveedor, f.astilladora,
       f.transportista, f.instalacion, f.especie, f.tipoBiomasa, f.origen,
       f.permiso, f.observaciones, f.mapsOrigen, f.mapsDestino,
       f.matriculaTractora, f.matriculaRemolque, f.chofer,
       certArray]
    )

    // Firmas — orden: proveedor → astilladora (Op1) → transportista (Op1) → instalacion → oficina
    const firmasBase = []
    if (f.proveedor)              firmasBase.push({ rol:'proveedor',     actor:f.proveedor,    firmado:false, fecha:null })
    if (esOp1 && f.astilladora)   firmasBase.push({ rol:'astilladora',   actor:f.astilladora,  firmado:false, fecha:null })
    if (esOp1 && f.transportista) firmasBase.push({ rol:'transportista', actor:f.transportista,firmado:false, fecha:null })
    if (f.instalacion)            firmasBase.push({ rol:'instalacion',   actor:f.instalacion,  firmado:false, fecha:null })
    firmasBase.push({ rol:'oficina', actor: f.actorNombre || 'Oficina', firmado:false, fecha:null })

    for (const fr of firmasBase) {
      await client.query(
        'INSERT INTO firmas (albaran_id,rol,actor,firmado,fecha) VALUES ($1,$2,$3,$4,$5)',
        [id, fr.rol, fr.actor, fr.firmado, fr.fecha]
      )
    }

    await client.query('INSERT INTO pesada (albaran_id) VALUES ($1)', [id])

    for (const d of docs) {
      await client.query(
        'INSERT INTO docs (albaran_id,nombre,adjunto) VALUES ($1,$2,false)', [id, d]
      )
    }

    const actorNombre = f.actorNombre || 'Oficina'
    await client.query(
      'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4),($1,$2,$5,$6)',
      [id, fecha, 'Albarán creado', actorNombre, 'Enlace generado para campo', 'Sistema']
    )

    await client.query('COMMIT')
    res.json({ id })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ error: e.message })
  } finally {
    client.release()
  }
})

// ── PATCH /albaranes/:id  (requiere auth) ─────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const { campos, pesadaCampos, descripcion } = req.body
  const { id } = req.params
  const fecha = new Date().toLocaleString('es-ES')
  const actorNombre = req.user.nombre || 'Oficina'

  if (campos && Object.keys(campos).length) {
    // Normalizar certificacion si viene como string
    if ('certificacion' in campos) {
      const c = campos.certificacion
      campos.certificacion = Array.isArray(c) ? c
        : (typeof c === 'string' && c ? c.split(',').filter(Boolean) : [])
    }
    const sets  = Object.keys(campos).map((k, i) => `${k} = $${i+2}`).join(', ')
    const vals  = Object.values(campos)
    await pool.query(`UPDATE albaranes SET ${sets} WHERE id = $1`, [id, ...vals])
  }

  if (pesadaCampos && Object.keys(pesadaCampos).length) {
    const sets = Object.keys(pesadaCampos).map((k, i) => `${k} = $${i+2}`).join(', ')
    const vals = Object.values(pesadaCampos)
    await pool.query(`UPDATE pesada SET ${sets} WHERE albaran_id = $1`, [id, ...vals])
  }

  await pool.query(
    'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
    [id, fecha, descripcion || 'Datos editados manualmente', actorNombre]
  )

  const albaran = await fetchOne(id)
  res.json(albaran)
})

// Helper: normaliza nombre a Title Case ("MARCOS LOPEZ" → "Marcos Lopez")
function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ── POST /albaranes/:id/firmas/:rol  (PÚBLICO — campo) ───────────
router.post('/:id/firmas/:rol', async (req, res) => {
  const { id, rol } = req.params
  const { actor, firmaImagen, pesadaData, campoData } = req.body
  const nombrePersona = toTitleCase(req.body.nombrePersona)
  const fecha = new Date().toLocaleString('es-ES')
  const ROL_LABEL = { oficina:'Oficina', proveedor:'Proveedor', astilladora:'Astilladora', transportista:'Transportista', instalacion:'Instalación' }

  // Captura IP real — Apache añade X-Forwarded-For con la IP del cliente original
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || req.headers['x-real-ip']
          || req.socket?.remoteAddress
          || 'desconocida'

  await pool.query(
    'UPDATE firmas SET firmado=true, fecha=$1, actor=$2, nombre_persona=$3, firma_imagen=$4, ip_origen=$5 WHERE albaran_id=$6 AND rol=$7',
    [fecha, actor, nombrePersona || null, firmaImagen || null, ip, id, rol]
  )
  await pool.query(
    'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
    [id, fecha, `${ROL_LABEL[rol] || rol} confirmó y firmó${nombrePersona ? ' ('+nombrePersona+')' : ''} · IP: ${ip}`, actor]
  )

  if (pesadaData) {
    await pool.query(
      'UPDATE pesada SET entrada=$1, salida=$2, humedad=$3 WHERE albaran_id=$4',
      [pesadaData.entrada||null, pesadaData.salida||null, pesadaData.humedad||null, id]
    )
  }

  if (campoData) {
    const map = {
      matriculaTractora: 'matricula_tractora',
      matriculaRemolque: 'matricula_remolque',
      chofer: 'chofer',
      origen: 'origen',
    }
    const cols = Object.entries(campoData)
      .filter(([k]) => map[k])
      .map(([k, v]) => [map[k], v])
    if (cols.length) {
      const sets = cols.map(([c], i) => `${c} = $${i+2}`).join(', ')
      await pool.query(`UPDATE albaranes SET ${sets} WHERE id = $1`,
        [id, ...cols.map(([,v]) => v || null)]
      )
    }
  }

  // Comprueba cierre automático — todas las firmas del albarán deben estar firmadas
  const { rows: firmas } = await pool.query(
    'SELECT * FROM firmas WHERE albaran_id=$1', [id]
  )
  const todasFirmadas = firmas.length > 0 && firmas.every(f => f.firmado)

  if (todasFirmadas) {
    await pool.query("UPDATE albaranes SET estado='cerrado' WHERE id=$1", [id])
    await pool.query(
      'INSERT INTO actividad (albaran_id,ts,texto,actor) VALUES ($1,$2,$3,$4)',
      [id, fecha, 'Albarán cerrado automáticamente', 'Sistema']
    )
  }

  const albaran = await fetchOne(id)
  res.json({ albaran, cerrado: todasFirmadas })
})

// ── DELETE /albaranes/:id  (solo superadmin) ─────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.nivel !== 'superadmin') return res.status(403).json({ error: 'Solo superadmin puede borrar albaranes' })
  const { id } = req.params
  await pool.query('DELETE FROM albaranes WHERE id = $1', [id])
  res.json({ ok: true })
})

module.exports = router
module.exports.fetchOne = fetchOne

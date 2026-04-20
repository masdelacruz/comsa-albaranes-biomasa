#!/usr/bin/env node
/**
 * Migración de datos Supabase → PostgreSQL propio
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=eyJ... \
 *   POSTGRES_HOST=localhost POSTGRES_PORT=5432 \
 *   POSTGRES_DB=biomasa POSTGRES_USER=biomasa_user POSTGRES_PASSWORD=xxx \
 *   node migrate-from-supabase.js
 */

const { createClient } = require('@supabase/supabase-js')
const { Pool }         = require('pg')
const bcrypt           = require('bcrypt')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const pool = new Pool({
  host:     process.env.POSTGRES_HOST || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
})

async function fetchAll(table, extra = '') {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true })
  if (error) throw new Error(`Supabase error en ${table}: ${error.message}`)
  return data || []
}

async function run() {
  console.log('═══════════════════════════════════════════════')
  console.log(' Migración Supabase → PostgreSQL              ')
  console.log('═══════════════════════════════════════════════')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── 1. Albaranes ─────────────────────────────────────────────
    console.log('\n→ Albaranes...')
    const albaranes = await fetchAll('albaranes')
    for (const a of albaranes) {
      await client.query(
        `INSERT INTO albaranes
         (id,fecha,hora,num_camiones,tipo,proveedor,astilladora,transportista,
          instalacion,especie,tipo_biomasa,origen,permiso,observaciones,estado,
          maps_origen,maps_destino,matricula_tractora,matricula_remolque,
          chofer,certificacion,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.fecha, a.hora, a.num_camiones, a.tipo, a.proveedor,
         a.astilladora, a.transportista, a.instalacion, a.especie, a.tipo_biomasa,
         a.origen, a.permiso, a.observaciones, a.estado, a.maps_origen, a.maps_destino,
         a.matricula_tractora, a.matricula_remolque, a.chofer,
         [].concat(a.certificacion || []), a.created_at]
      )
    }
    console.log(`   ${albaranes.length} albaranes migrados`)

    // ── 2. Firmas ─────────────────────────────────────────────────
    console.log('→ Firmas...')
    const firmas = await fetchAll('firmas')
    for (const f of firmas) {
      await client.query(
        `INSERT INTO firmas (albaran_id,rol,actor,firmado,fecha,firma_imagen,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (albaran_id,rol) DO NOTHING`,
        [f.albaran_id, f.rol, f.actor, f.firmado, f.fecha, f.firma_imagen, f.created_at]
      )
    }
    console.log(`   ${firmas.length} firmas migradas`)

    // ── 3. Pesada ─────────────────────────────────────────────────
    console.log('→ Pesada...')
    const pesadas = await fetchAll('pesada')
    for (const p of pesadas) {
      await client.query(
        `INSERT INTO pesada (albaran_id,entrada,salida,humedad,ticket_adjunto,ticket_url,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (albaran_id) DO NOTHING`,
        [p.albaran_id, p.entrada, p.salida, p.humedad, p.ticket_adjunto||false, p.ticket_url, p.created_at]
      )
    }
    console.log(`   ${pesadas.length} pesadas migradas`)

    // ── 4. Documentos ─────────────────────────────────────────────
    console.log('→ Documentos...')
    const docs = await fetchAll('docs')
    for (const d of docs) {
      await client.query(
        `INSERT INTO docs (albaran_id,nombre,adjunto,url,nombre_fichero,tipo_fichero,tamanyo,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [d.albaran_id, d.nombre, d.adjunto||false, d.url, d.nombre_fichero, d.tipo_fichero, d.tamanyo, d.created_at]
      )
    }
    console.log(`   ${docs.length} documentos migrados`)

    // ── 5. Actividad ──────────────────────────────────────────────
    console.log('→ Actividad...')
    const actividad = await fetchAll('actividad')
    for (const ev of actividad) {
      await client.query(
        `INSERT INTO actividad (albaran_id,ts,texto,actor,created_at) VALUES ($1,$2,$3,$4,$5)`,
        [ev.albaran_id, ev.ts, ev.texto, ev.actor, ev.created_at]
      )
    }
    console.log(`   ${actividad.length} eventos de actividad migrados`)

    // ── 6. Proveedores / Empresas ─────────────────────────────────
    console.log('→ Proveedores...')
    const proveedores = await fetchAll('proveedores')
    for (const p of proveedores) {
      await client.query(
        `INSERT INTO proveedores (id,nombre,tipo,contacto,email,telefono,notas,activo,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.nombre, p.tipo, p.contacto, p.email, p.telefono, p.notas, p.activo, p.created_at]
      )
    }
    console.log(`   ${proveedores.length} empresas migradas`)

    // ── 7. Usuarios ───────────────────────────────────────────────
    console.log('→ Usuarios...')
    const usuarios = await fetchAll('usuarios')
    for (const u of usuarios) {
      // Genera hash a partir del password_visible guardado
      const pw   = u.password_visible || 'Comsa2025!'
      const hash = await bcrypt.hash(pw, 12)
      await client.query(
        `INSERT INTO usuarios (id,nombre,email,password_hash,password_visible,rol,nivel,activo,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.nombre, u.email, hash, u.password_visible, u.rol, u.nivel, u.activo, u.created_at]
      )
    }
    console.log(`   ${usuarios.length} usuarios migrados`)

    // ── 8. Logos (URLs de Supabase Storage) ───────────────────────
    // Los ficheros físicos hay que migrarlos aparte (ver instrucciones abajo)
    console.log('→ Logos...')
    const logos = await fetchAll('logos')
    for (const l of logos) {
      await client.query(
        `INSERT INTO logos (id,nombre,url,updated_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET url=$3, updated_at=$4`,
        [l.id, l.nombre, l.url, l.updated_at || new Date()]
      )
    }
    console.log(`   ${logos.length} logos migrados`)

    await client.query('COMMIT')
    console.log('\n✓ Migración completada con éxito')

  } catch (e) {
    await client.query('ROLLBACK')
    console.error('\n✗ Error — rollback ejecutado:', e.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }

  console.log(`
══════════════════════════════════════════════
PENDIENTE: migrar ficheros del Storage de Supabase a MinIO
  1. Descargar todos los ficheros del bucket "documentos":
       supabase storage download --project-id edxlcvqrddnvwzuxfjni ./storage_backup/
  2. Subir a MinIO:
       mc alias set biomasa http://localhost:9000 MINIO_USER MINIO_PASS
       mc cp --recursive ./storage_backup/ biomasa/documentos/
  3. Actualizar las URLs en la base de datos:
       UPDATE docs SET url = REPLACE(url,
         'https://edxlcvqrddnvwzuxfjni.supabase.co/storage/v1/object/public/documentos/',
         'https://biomasa.cserintranet.com/api/storage/file/')
       WHERE url LIKE '%supabase.co%';
══════════════════════════════════════════════
`)
}

run().catch(e => { console.error(e); process.exit(1) })

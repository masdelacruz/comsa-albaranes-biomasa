/**
 * notificacionesCliente.js — notificaciones persistentes para los paneles
 * públicos de astilladora/instalación (ver migrate_010_notificaciones_cliente.sql).
 * Sin usuario logueado detrás: se guardan por empresa_tipo + empresa_nombre.
 */
const pool = require('./db')

async function crearNotificacion({ empresaTipo, empresaNombre, albaranId, tipo, mensaje }) {
  if (!empresaNombre) return
  try {
    await pool.query(
      `INSERT INTO notificaciones_cliente (empresa_tipo, empresa_nombre, albaran_id, tipo, mensaje)
       VALUES ($1,$2,$3,$4,$5)`,
      [empresaTipo, empresaNombre, albaranId, tipo, mensaje]
    )
  } catch (e) {
    console.error('Error creando notificación cliente:', e.message)
  }
}

module.exports = { crearNotificacion }

const pool = require('../db')

// Registra una acción administrativa/destructiva en el log global de auditoría
// (solo visible para superadmin). Nunca debe romper la operación principal.
async function registrarAuditoria({ usuario, accion, entidad, entidadId, detalle }) {
  const ts = new Date().toLocaleString('es-ES')
  try {
    await pool.query(
      `INSERT INTO auditoria (ts, usuario_id, usuario_nombre, accion, entidad, entidad_id, detalle)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ts, usuario?.id || null, usuario?.nombre || 'Sistema', accion, entidad, entidadId != null ? String(entidadId) : null, detalle || null]
    )
  } catch (e) {
    console.error('Error registrando auditoría:', e)
  }
}

module.exports = { registrarAuditoria }

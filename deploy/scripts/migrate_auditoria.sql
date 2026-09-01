-- Añade la tabla de auditoría (registro de acciones administrativas/destructivas,
-- visible solo para superadmin). Seguro de re-ejecutar.

CREATE TABLE IF NOT EXISTS auditoria (
  id             SERIAL PRIMARY KEY,
  ts             TEXT NOT NULL,
  usuario_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre TEXT NOT NULL,
  accion         TEXT NOT NULL,
  entidad        TEXT NOT NULL,
  entidad_id     TEXT,
  detalle        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at DESC);

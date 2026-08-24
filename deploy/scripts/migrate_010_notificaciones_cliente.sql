-- Notificaciones para los paneles públicos de cliente (astilladora / instalación).
-- Esos paneles no tienen usuario logueado detrás (se accede por nombre de
-- empresa en la URL), así que se guardan por empresa_tipo + empresa_nombre
-- en vez de por un user_id.
CREATE TABLE IF NOT EXISTS notificaciones_cliente (
  id             SERIAL PRIMARY KEY,
  empresa_tipo   TEXT NOT NULL,     -- 'astilladora' | 'instalacion'
  empresa_nombre TEXT NOT NULL,
  albaran_id     TEXT REFERENCES albaranes(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,     -- 'enviado_a_campo' | 'astilladora_firmo'
  mensaje        TEXT NOT NULL,
  leida          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_cliente ON notificaciones_cliente(empresa_tipo, empresa_nombre, leida);

-- ─────────────────────────────────────────────────────────────────
-- COMSA Albaranes · Esquema PostgreSQL
-- Se ejecuta automáticamente al crear el contenedor por primera vez
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Albaranes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS albaranes (
  id                  TEXT PRIMARY KEY,
  fecha               DATE,
  hora                TEXT,
  num_camiones        INTEGER,
  tipo                TEXT,
  proveedor           TEXT,
  astilladora         TEXT,
  transportista       TEXT,
  instalacion         TEXT,
  especie             TEXT,
  tipo_biomasa        TEXT,
  origen              TEXT,
  permiso             TEXT,
  observaciones       TEXT,
  estado              TEXT NOT NULL DEFAULT 'pendiente_campo',
  maps_origen         TEXT,
  maps_destino        TEXT,
  matricula_tractora  TEXT,
  matricula_remolque  TEXT,
  chofer              TEXT,
  certificacion       TEXT[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Firmas ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firmas (
  id            SERIAL PRIMARY KEY,
  albaran_id    TEXT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  rol           TEXT NOT NULL,
  actor         TEXT,
  firmado       BOOLEAN NOT NULL DEFAULT FALSE,
  fecha         TEXT,
  firma_imagen  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (albaran_id, rol)
);

-- ── Pesada ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pesada (
  id              SERIAL PRIMARY KEY,
  albaran_id      TEXT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE UNIQUE,
  entrada         NUMERIC,
  salida          NUMERIC,
  humedad         NUMERIC,
  ticket_adjunto  BOOLEAN NOT NULL DEFAULT FALSE,
  ticket_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Documentos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS docs (
  id             SERIAL PRIMARY KEY,
  albaran_id     TEXT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  adjunto        BOOLEAN NOT NULL DEFAULT FALSE,
  url            TEXT,
  nombre_fichero TEXT,
  tipo_fichero   TEXT,
  tamanyo        INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Actividad ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actividad (
  id          SERIAL PRIMARY KEY,
  albaran_id  TEXT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  ts          TEXT NOT NULL,
  texto       TEXT NOT NULL,
  actor       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Usuarios (auth propia, sin Supabase) ─────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  password_visible TEXT,                       -- visible para superadmin
  rol              TEXT,
  nivel            TEXT NOT NULL DEFAULT 'usuario',  -- 'usuario' | 'superadmin'
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Proveedores / Empresas ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre    TEXT NOT NULL,
  tipo      TEXT NOT NULL,   -- proveedor | astilladora | transportista | instalacion
  contacto  TEXT,
  email     TEXT,
  telefono  TEXT,
  notas     TEXT,
  activo    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Logos PDF ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logos (
  id         TEXT PRIMARY KEY,
  nombre     TEXT,
  url        TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Función: ID correlativo de albarán ────────────────────────────
-- Formato: ALB-AAAA-NNNN  (ej. ALB-2026-0001)
CREATE OR REPLACE FUNCTION next_albaran_id() RETURNS TEXT AS $$
DECLARE
  anio    TEXT := TO_CHAR(NOW(), 'YYYY');
  prefix  TEXT;
  siguiente INTEGER;
BEGIN
  prefix := 'ALB-' || anio || '-';
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(id FROM LENGTH(prefix) + 1) AS INTEGER)), 0
  ) + 1
  INTO siguiente
  FROM albaranes
  WHERE id LIKE prefix || '%';
  RETURN prefix || LPAD(siguiente::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Índices de rendimiento ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_albaranes_estado      ON albaranes(estado);
CREATE INDEX IF NOT EXISTS idx_albaranes_created_at  ON albaranes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_firmas_albaran        ON firmas(albaran_id);
CREATE INDEX IF NOT EXISTS idx_pesada_albaran        ON pesada(albaran_id);
CREATE INDEX IF NOT EXISTS idx_docs_albaran          ON docs(albaran_id);
CREATE INDEX IF NOT EXISTS idx_actividad_albaran     ON actividad(albaran_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_tipo      ON proveedores(tipo);

-- Observaciones post-firma del astillador
CREATE TABLE IF NOT EXISTS observaciones_albaran (
  id         SERIAL PRIMARY KEY,
  albaran_id TEXT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  rol        TEXT NOT NULL,
  texto      TEXT NOT NULL,
  fecha      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_obs_albaran ON observaciones_albaran(albaran_id);

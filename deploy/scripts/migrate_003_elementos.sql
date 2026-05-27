-- Tabla de elementos configurables para desplegables (tipo biomasa, especie, etc.)
CREATE TABLE IF NOT EXISTS elementos (
  id     SERIAL PRIMARY KEY,
  tipo   TEXT NOT NULL,
  valor  TEXT NOT NULL,
  orden  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tipo, valor)
);

-- Valores por defecto
INSERT INTO elementos (tipo, valor, orden) VALUES
  ('tipoBiomasa', 'Forestal',    1),
  ('tipoBiomasa', 'Industrial',  2),
  ('tipoBiomasa', 'Agrícola',    3),
  ('especie', 'Estella ACO100',  1),
  ('especie', 'Estella ACO50',   2),
  ('especie', 'Estella ACO30',   3),
  ('especie', 'Estella TRO100',  4),
  ('especie', 'Estella TRO50',   5),
  ('especie', 'Estella TRO30',   6),
  ('especie', 'Estella TRO100C', 7),
  ('especie', 'Estella TRO50C',  8),
  ('especie', 'Estella TRO30C',  9)
ON CONFLICT DO NOTHING;

-- Añadir campo estella y migrar datos de especie
ALTER TABLE albaranes ADD COLUMN IF NOT EXISTS estella TEXT;

-- Los valores actuales de especie (Estella ACO100, etc.) pasan a estella
UPDATE albaranes SET estella = especie WHERE especie IS NOT NULL AND especie != '';

-- especie ahora significa la nueva clasificación (Pinus SP, Otros)
UPDATE albaranes SET especie = NULL;

-- Renombrar elementos tipo 'especie' → 'estella'
UPDATE elementos SET tipo = 'estella' WHERE tipo = 'especie';

-- Insertar opciones iniciales para el nuevo desplegable Especie
INSERT INTO elementos (tipo, valor, orden) VALUES
  ('especie', 'Pinus SP', 1),
  ('especie', 'Otros',    2)
ON CONFLICT DO NOTHING;

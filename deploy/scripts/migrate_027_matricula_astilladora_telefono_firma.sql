-- La matrícula de la máquina astilladora se pedía en campo y en el detalle
-- pero no tenía columna: la API la descartaba sin avisar.
ALTER TABLE albaranes ADD COLUMN IF NOT EXISTS matricula_astilladora TEXT;

-- Teléfono de la persona que confirma en campo (se pedía y se perdía).
ALTER TABLE firmas ADD COLUMN IF NOT EXISTS telefono_persona TEXT;

-- La pesada se actualiza con INSERT ... ON CONFLICT (albaran_id): requiere
-- índice único. El esquema ya lo declara UNIQUE; se asegura por si acaso.
CREATE UNIQUE INDEX IF NOT EXISTS pesada_albaran_id_key ON pesada (albaran_id);

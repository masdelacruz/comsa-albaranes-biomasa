-- Añade flag para que campo pueda solicitar revisión a oficina
ALTER TABLE albaranes ADD COLUMN IF NOT EXISTS solicita_revision BOOLEAN DEFAULT FALSE;

-- Fase 0 (0B): cada albarán necesita un token secreto propio para las
-- acciones públicas de campo. Sustituye el uso del id correlativo (adivinable)
-- como única "credencial" de los enlaces compartidos por WhatsApp/email.
ALTER TABLE albaranes ADD COLUMN IF NOT EXISTS campo_token TEXT UNIQUE
  DEFAULT encode(gen_random_bytes(24), 'hex');
UPDATE albaranes SET campo_token = encode(gen_random_bytes(24), 'hex') WHERE campo_token IS NULL;
ALTER TABLE albaranes ALTER COLUMN campo_token SET NOT NULL;

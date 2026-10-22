-- Marca "Notificado" de cada paso de campo: la oficina deja constancia de que
-- ha avisado al cliente (WhatsApp, email o a mano) de que tiene el albarán
-- pendiente en su panel. Es informativa, no bloquea el flujo; al firmar el
-- paso, el siguiente empieza sin notificar.
ALTER TABLE firmas ADD COLUMN IF NOT EXISTS notificado_at    TIMESTAMPTZ;
ALTER TABLE firmas ADD COLUMN IF NOT EXISTS notificado_por   TEXT;
ALTER TABLE firmas ADD COLUMN IF NOT EXISTS notificado_medio TEXT;

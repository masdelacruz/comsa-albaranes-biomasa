-- Valores leídos automáticamente del ticket de pesada (PDF de la báscula):
-- {"numeroPesada":"9272","bruto":47120,"tara":15380,"neto":31740}.
-- Se compara con entrada/salida/numero_pesada para mostrar si cada dato
-- viene del ticket o se ha introducido/modificado a mano. NULL = sin lectura.
ALTER TABLE pesada ADD COLUMN IF NOT EXISTS ticket_leido JSONB;

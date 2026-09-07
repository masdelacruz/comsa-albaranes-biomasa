-- Fase 0 (0C): el bucket deja de ser público. A partir de ahora la BD guarda
-- solo el path del objeto (no la URL pública completa) y la API genera URLs
-- firmadas y temporales bajo demanda. Convierte los valores ya guardados
-- como URL completa a solo su path. Idempotente: una vez convertido ya no
-- coincide con el patrón y no vuelve a tocarse.
UPDATE docs       SET url          = substring(url          from '/api/storage/file/(.*)$') WHERE url          LIKE '%/api/storage/file/%';
UPDATE pesada      SET ticket_url  = substring(ticket_url   from '/api/storage/file/(.*)$') WHERE ticket_url   LIKE '%/api/storage/file/%';
UPDATE proveedores SET firma_imagen= substring(firma_imagen from '/api/storage/file/(.*)$') WHERE firma_imagen LIKE '%/api/storage/file/%';
UPDATE logos       SET url         = substring(url          from '/api/storage/file/(.*)$') WHERE url          LIKE '%/api/storage/file/%';

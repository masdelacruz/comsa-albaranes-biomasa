-- Matrículas siempre en mayúsculas (la API ya las normaliza al guardar).
-- Pasa a mayúsculas las existentes y quita espacios sobrantes.
UPDATE albaranes SET
  matricula_tractora = NULLIF(upper(btrim(regexp_replace(matricula_tractora, '\s+', ' ', 'g'))), ''),
  matricula_remolque = NULLIF(upper(btrim(regexp_replace(matricula_remolque, '\s+', ' ', 'g'))), '')
WHERE matricula_tractora IS DISTINCT FROM NULLIF(upper(btrim(regexp_replace(matricula_tractora, '\s+', ' ', 'g'))), '')
   OR matricula_remolque IS DISTINCT FROM NULLIF(upper(btrim(regexp_replace(matricula_remolque, '\s+', ' ', 'g'))), '');

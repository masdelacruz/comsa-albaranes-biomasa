-- Nombres de fichero guardados con la codificación rota (UTF-8 leído como
-- latin1: "rÃ¡pida" en vez de "rápida"). Se recodifican fila a fila; si
-- alguno no se puede convertir se deja como está.
DO $$
DECLARE r RECORD; arreglado TEXT;
BEGIN
  FOR r IN SELECT id, nombre_fichero FROM docs WHERE nombre_fichero ~ '[ÃÂ]' LOOP
    BEGIN
      arreglado := convert_from(convert_to(r.nombre_fichero, 'LATIN1'), 'UTF8');
      UPDATE docs SET nombre_fichero = arreglado WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- Empresas dadas de alta con varios tipos (proveedor, astilladora...) deben
-- compartir los datos de contacto. Rellena los huecos con el valor de la
-- otra ficha cuando solo hay uno distinto; los conflictos reales se dejan
-- para resolverlos a mano.
DO $$
DECLARE c TEXT;
BEGIN
  FOREACH c IN ARRAY ARRAY['contacto', 'email', 'telefono'] LOOP
    EXECUTE format($q$
      UPDATE proveedores p SET %1$I = v.valor
      FROM (
        SELECT lower(nombre) AS clave, min(%1$I) AS valor
        FROM proveedores
        WHERE COALESCE(TRIM(%1$I), '') <> ''
        GROUP BY lower(nombre)
        HAVING count(DISTINCT %1$I) = 1
      ) v
      WHERE lower(p.nombre) = v.clave AND COALESCE(TRIM(p.%1$I), '') = ''
    $q$, c);
  END LOOP;
END $$;

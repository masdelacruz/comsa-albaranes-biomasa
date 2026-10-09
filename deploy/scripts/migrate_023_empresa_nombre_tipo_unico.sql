-- Una empresa no puede estar dos veces con el mismo tipo (p. ej. dos
-- "Cliente3" proveedores). Puede tener varios tipos: una fila por tipo,
-- todas con el mismo nombre. Si ya hubiera duplicados, no se crea el
-- índice y se avisa para resolverlos a mano antes de reintentar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM proveedores GROUP BY lower(nombre), tipo HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'Hay empresas duplicadas con el mismo nombre y tipo; índice único NO creado';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nombre_tipo_unico ON proveedores (lower(nombre), tipo);
  END IF;
END $$;

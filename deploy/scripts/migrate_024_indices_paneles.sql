-- Índices para las consultas que crecen con el volumen: los paneles de
-- cliente (se consultan cada 30 s por empresa) filtran por nombre de
-- astilladora / proveedor / instalación, y los grupos de camiones y las
-- vistas por día filtran por grupo_id y fecha.
CREATE INDEX IF NOT EXISTS idx_albaranes_astilladora ON albaranes(astilladora);
CREATE INDEX IF NOT EXISTS idx_albaranes_proveedor   ON albaranes(proveedor);
CREATE INDEX IF NOT EXISTS idx_albaranes_instalacion ON albaranes(instalacion);
CREATE INDEX IF NOT EXISTS idx_albaranes_fecha       ON albaranes(fecha);
CREATE INDEX IF NOT EXISTS idx_albaranes_grupo       ON albaranes(grupo_id) WHERE grupo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proveedores_nombre    ON proveedores(nombre);

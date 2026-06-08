-- Trabajadores y máquinas registradas por empresa (astilladora)
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS trabajadores JSONB DEFAULT '[]';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS maquinas JSONB DEFAULT '[]';

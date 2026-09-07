-- Fase 0 (cierre de gap 0B): los paneles públicos por nombre de empresa
-- (/campo/instalacion/:nombre, /campo/astilladora/:nombre) dejan de bastar
-- con solo el nombre — cada empresa tiene ahora un código de acceso propio.
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS acceso_codigo TEXT UNIQUE
  DEFAULT encode(gen_random_bytes(16), 'hex');
UPDATE proveedores SET acceso_codigo = encode(gen_random_bytes(16), 'hex') WHERE acceso_codigo IS NULL;
ALTER TABLE proveedores ALTER COLUMN acceso_codigo SET NOT NULL;

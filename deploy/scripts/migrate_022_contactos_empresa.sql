-- Varias personas de contacto por empresa: lista de {nombre, telefono}.
-- La primera es la principal; las columnas contacto/telefono se mantienen
-- como copia de ella (WhatsApp, llamadas y saludo de los emails).
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contactos JSONB NOT NULL DEFAULT '[]';

-- Pasa el contacto único actual a la lista
UPDATE proveedores
SET contactos = jsonb_build_array(jsonb_build_object(
      'nombre',   COALESCE(TRIM(contacto), ''),
      'telefono', COALESCE(TRIM(telefono), '')))
WHERE contactos = '[]'::jsonb
  AND (COALESCE(TRIM(contacto), '') <> '' OR COALESCE(TRIM(telefono), '') <> '');

-- Zefferino Biomass: tenía los dos contactos metidos en un solo texto
UPDATE proveedores
SET contactos = '[{"nombre":"Ceferino","telefono":"609 740 595"},{"nombre":"David","telefono":"618 147 792"}]'::jsonb,
    contacto  = 'Ceferino',
    telefono  = '609 740 595'
WHERE lower(nombre) = 'zefferino biomass'
  AND contacto LIKE 'Ceferino (%';

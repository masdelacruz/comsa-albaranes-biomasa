-- Elimina la imagen de firma propia de la empresa: astilladoras e
-- instalaciones usan ahora su logo (tabla logos, id "empresa_<slug>") como
-- firma/sello al confirmar desde el panel de campo. Proveedor y
-- transportista no tienen ni logo ni firma.
ALTER TABLE proveedores DROP COLUMN IF EXISTS firma_imagen;

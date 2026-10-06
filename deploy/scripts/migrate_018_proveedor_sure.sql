-- Proveedores SURE: un proveedor puede marcarse como certificado SURE con su
-- referencia, que se copia a los albaranes de Opción 2 (proveedor directo)
-- que provienen de él. El albarán guarda su propia copia para que un albarán
-- cerrado conserve la referencia vigente en su momento.
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS es_sure BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS referencia_sure TEXT;
ALTER TABLE albaranes   ADD COLUMN IF NOT EXISTS referencia_sure TEXT;

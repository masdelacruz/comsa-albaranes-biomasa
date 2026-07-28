-- Horario de apertura de instalaciones/astilladoras, para mostrar en campo
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS horario TEXT;

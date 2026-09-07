-- Fase 0: las contraseñas nunca deben poder recuperarse desde la base de datos.
-- El incremento de token_version permite revocar inmediatamente JWT existentes.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE usuarios DROP COLUMN IF EXISTS password_visible;

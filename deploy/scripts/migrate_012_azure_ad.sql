-- Login con Microsoft Entra ID (Azure AD): vincula la identidad de
-- Microsoft a un usuario ya existente en la primera vez que inicia
-- sesión así. No se usa para dar de alta cuentas nuevas.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS azure_oid TEXT UNIQUE;

-- Concepto de multi-app: cada usuario puede tener acceso a Biomasa,
-- a Trabajo (nueva, aún sin lógica propia — placeholder), o a ambas.
-- Arranque del concepto: todos empiezan con acceso a las dos.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acceso_biomasa BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acceso_trabajo BOOLEAN NOT NULL DEFAULT TRUE;

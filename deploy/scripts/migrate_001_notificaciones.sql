-- Migración 001: columna notificaciones en usuarios
-- Segura de ejecutar múltiples veces (IF NOT EXISTS)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS notificaciones JSONB NOT NULL DEFAULT '{}'::jsonb;

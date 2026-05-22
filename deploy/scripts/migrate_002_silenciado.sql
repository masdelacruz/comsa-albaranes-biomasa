-- Migración 002: silenciado por defecto para todos los usuarios
-- Añade silenciado=true a usuarios que no tienen la clave aún
UPDATE usuarios
SET notificaciones = notificaciones || '{"silenciado": true}'::jsonb
WHERE NOT (notificaciones ? 'silenciado');

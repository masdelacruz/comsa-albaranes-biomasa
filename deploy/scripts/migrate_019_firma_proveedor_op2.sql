-- Opción 2 (proveedor directo): el proveedor pasa a ser el primer paso del
-- albarán — adjunta su albarán y completa el origen desde su panel. Los
-- albaranes de Opción 2 que aún no han salido de campo reciben su paso de
-- proveedor (los ya avanzados o cerrados se quedan como están).
INSERT INTO firmas (albaran_id, rol, actor, firmado, fecha)
SELECT a.id, 'proveedor', a.proveedor, false, null
FROM albaranes a
WHERE a.tipo LIKE 'Opción 2%'
  AND a.proveedor IS NOT NULL
  AND a.estado IN ('programado', 'pendiente_campo')
ON CONFLICT (albaran_id, rol) DO NOTHING;

INSERT INTO docs (albaran_id, nombre, adjunto)
SELECT a.id, 'Albarán proveedor', false
FROM albaranes a
WHERE a.tipo LIKE 'Opción 2%'
  AND a.estado NOT IN ('cerrado', 'cancelado')
  AND NOT EXISTS (SELECT 1 FROM docs d WHERE d.albaran_id = a.id AND d.nombre = 'Albarán proveedor');

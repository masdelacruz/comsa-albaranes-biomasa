// Los completados que no aparecen ya en la vista actual, más recientes primero.
export function completadosFuera(todos, visibles, estaCompleto) {
  const ids = new Set(visibles.map(a => a.id))
  return todos
    .filter(a => estaCompleto(a) && !ids.has(a.id))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || String(b.id).localeCompare(String(a.id)))
}

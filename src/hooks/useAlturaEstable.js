import { useRef, useState, useLayoutEffect } from 'react'

// Mantiene el alto de un bloque de listado (tabla + paginación) cuando se
// filtra: mientras no hay filtros se mide su alto natural; con filtros se
// aplica ese alto como mínimo, para que un resultado más corto (o vacío) no
// haga saltar la página. `alturaVacio` es el alto que debe ocupar la fila de
// "no hay resultados" para quedar centrada en ese hueco.
export function useAlturaEstable(conFiltros) {
  const bloqueRef = useRef(null)
  const [base,     setBase]     = useState(0)
  const [cabecera, setCabecera] = useState(0)

  useLayoutEffect(() => {
    const el = bloqueRef.current
    if (!el) return
    const medir = () => {
      setCabecera(el.querySelector('thead')?.offsetHeight || 0)
      if (!conFiltros) setBase(el.offsetHeight)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [conFiltros])

  const fijar = conFiltros && base > 0
  return {
    bloqueRef,
    estiloBloque: fijar ? { minHeight: base } : undefined,
    alturaVacio:  fijar ? Math.max(0, base - cabecera) : undefined,
  }
}

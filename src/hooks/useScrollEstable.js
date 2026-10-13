import { useRef, useEffect, useLayoutEffect } from 'react'

// Evita que la página "salte" al filtrar un listado. Cuando el resultado es
// más corto, el documento encoge y el navegador recorta el scroll, subiendo
// media página. En vez de rellenar la tarjeta con espacio en blanco, se da a
// la raíz de la página un min-height justo para conservar la posición actual
// (un colchón invisible bajo el contenido) y se restaura el scroll antes de
// pintar. Al hacer scroll hacia arriba el colchón se va soltando, así que
// nunca queda hueco de sobra por debajo.
//
// `raizRef`: elemento raíz de la página. `clave`: cambia cuando cambia el
// contenido del listado (nº de resultados, página...).
export function useScrollEstable(raizRef, clave) {
  const yRef = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const colchonRef = useRef(0)

  const topAbs = (el) => el.getBoundingClientRect().top + window.scrollY
  const aplicar = (el, px) => {
    colchonRef.current = px
    el.style.minHeight = px > 0 ? `${px}px` : ''
  }

  useEffect(() => {
    const onScroll = () => {
      yRef.current = window.scrollY
      const el = raizRef.current
      if (!el || !colchonRef.current) return
      const necesario = window.scrollY + window.innerHeight - topAbs(el)
      if (necesario < colchonRef.current) aplicar(el, necesario)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [raizRef])

  const montadoRef = useRef(false)
  useLayoutEffect(() => {
    const el = raizRef.current
    if (!el) return
    // Al montar la página no se toca el scroll (lo gestiona la navegación)
    if (!montadoRef.current) { montadoRef.current = true; yRef.current = window.scrollY; return }
    const y = yRef.current
    aplicar(el, y + window.innerHeight - topAbs(el))
    if (window.scrollY !== y) window.scrollTo(0, y)
  }, [raizRef, clave])
}

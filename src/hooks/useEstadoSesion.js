import { useState, useEffect, useRef } from 'react'

// Estado de vista que sobrevive a entrar y salir de otra pantalla (p. ej. abrir
// el detalle de un albarán y volver al listado): filtros, página, scroll...
// Se guarda en sessionStorage, así que dura lo que la pestaña y no se comparte
// entre pestañas ni usuarios; además se borra al cerrar sesión (api.clearToken).
const PREFIJO = 'vista:'

const leer = (clave, inicial) => {
  try {
    const raw = sessionStorage.getItem(PREFIJO + clave)
    return raw == null ? inicial : JSON.parse(raw)
  } catch { return inicial }
}

export function useEstadoSesion(clave, inicial) {
  const [valor, setValor] = useState(() => leer(clave, inicial))
  useEffect(() => {
    try { sessionStorage.setItem(PREFIJO + clave, JSON.stringify(valor)) } catch { /* modo privado o cuota llena */ }
  }, [clave, valor])
  return [valor, setValor]
}

// Como useEffect pero sin ejecutarse al montar: para "al cambiar los filtros,
// vuelve a la página 1" sin pisar la página restaurada al volver al listado.
export function useAlCambiar(fn, deps) {
  const montado = useRef(false)
  useEffect(() => {
    if (!montado.current) { montado.current = true; return }
    fn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// Guarda la posición de scroll al salir de la vista y la recupera al volver,
// en cuanto el listado tiene datos (`listo`) y por tanto altura suficiente.
export function useScrollSesion(clave, listo) {
  const restaurado = useRef(false)
  useEffect(() => {
    const guardar = () => { try { sessionStorage.setItem(PREFIJO + clave + ':scroll', String(window.scrollY)) } catch { /* ignore */ } }
    window.addEventListener('scroll', guardar, { passive: true })
    return () => { guardar(); window.removeEventListener('scroll', guardar) }
  }, [clave])
  useEffect(() => {
    if (!listo || restaurado.current) return
    restaurado.current = true
    const y = Number(leer(clave + ':scroll', 0)) || 0
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y))
  }, [clave, listo])
}

// Deja preparada una vista antes de navegar a ella (p. ej. desde un aviso del
// Dashboard: "abrir Albaranes con estos filtros"). Borra el estado anterior de
// esa vista — filtros, página y scroll — y escribe solo los valores indicados.
export function prepararVista(raiz, valores = {}) {
  try {
    const pre = PREFIJO + raiz + ':'
    Object.keys(sessionStorage).filter(k => k.startsWith(pre)).forEach(k => sessionStorage.removeItem(k))
    Object.entries(valores).forEach(([k, v]) => sessionStorage.setItem(pre + k, JSON.stringify(v)))
  } catch { /* sin sessionStorage: se abre la vista tal cual */ }
}

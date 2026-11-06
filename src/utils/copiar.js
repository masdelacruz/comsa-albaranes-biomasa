import { useState, useRef, useEffect } from 'react'

// Copia texto al portapapeles (con alternativa para navegadores sin clipboard API
// o páginas sin contexto seguro)
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(ta)
    return ok
  }
}

// [copiado, copiar]: "copiado" vuelve a false a los 2 s, para el texto del botón
export function useCopiar() {
  const [copiado, setCopiado] = useState(false)
  const t = useRef(null)
  useEffect(() => () => clearTimeout(t.current), [])
  const copiar = async (texto) => {
    const ok = await copiarTexto(texto)
    setCopiado(ok ? 'ok' : 'error')
    clearTimeout(t.current)
    t.current = setTimeout(() => setCopiado(false), 2000)
  }
  return [copiado, copiar]
}

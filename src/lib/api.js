/**
 * Cliente API — reemplaza el cliente Supabase en el despliegue self-hosted.
 * Todas las llamadas van a /api (proxy nginx → contenedor api).
 */

const BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('biomasa_token') || sessionStorage.getItem('biomasa_token')
}

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

// Inicio de la app en la que se está: Trabajo → /trabajo, selector → /apps
// y cualquier apartado de Biomasa → Panel
export function inicioDeApp(ruta = window.location.pathname) {
  if (ruta.startsWith('/trabajo')) return '/trabajo'
  if (ruta.startsWith('/apps')) return '/apps'
  return '/panel'
}

// Tras volver a entrar con Microsoft se aterriza aquí (ver AuthCallback)
const CLAVE_DESTINO = 'destino_tras_login'

// Sesión caducada o revocada a mitad de uso: se borra el token y se recarga en
// el inicio de la app, arriba del todo, donde aparece el login. Al volver a
// entrar se sigue ahí y no en la pantalla en la que caducó.
function sesionCaducada(err) {
  if (err?.error === 'usar_microsoft') sessionStorage.setItem('sso_error', 'usar_microsoft')
  api.clearToken()
  window.location.replace(inicioDeApp())
}

async function request(method, path, body) {
  const teniaToken = !!getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    if (res.status === 401 && teniaToken && !path.startsWith('/auth/login') && !window.location.pathname.startsWith('/campo')) {
      sesionCaducada(err)
      return new Promise(() => {})  // la página se está recargando
    }
    throw Object.assign(new Error(err.error || res.statusText), { status: res.status, data: err })
  }
  return res.json()
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),

  // Auth
  login:  (email, pw)    => request('POST', '/auth/login', { email, password: pw }),
  me:     ()             => request('GET',  '/auth/me'),

  // Storage — upload con FormData (no JSON)
  async upload(path, formData) {
    const token = getToken()
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || res.statusText)
    }
    return res.json()
  },

  // remember=true → persiste entre reinicios del navegador (localStorage).
  // remember=false → solo dura la pestaña actual (sessionStorage).
  setToken(token, remember = true) {
    if (remember) {
      localStorage.setItem('biomasa_token', token)
      sessionStorage.removeItem('biomasa_token')
    } else {
      sessionStorage.setItem('biomasa_token', token)
      localStorage.removeItem('biomasa_token')
    }
  },
  clearToken() {
    localStorage.removeItem('biomasa_token')
    sessionStorage.removeItem('biomasa_token')
    localStorage.removeItem('biomasa_sso')
    // Filtros y posición de los listados (ver hooks/useEstadoSesion)
    try { Object.keys(sessionStorage).filter(k => k.startsWith('vista:')).forEach(k => sessionStorage.removeItem(k)) } catch { /* ignore */ }
  },
  // Marca que la sesión actual viene del login con Microsoft (para el logout)
  marcarSso()      { localStorage.setItem('biomasa_sso', '1') },
  esSso()          { return localStorage.getItem('biomasa_sso') === '1' },
  hasToken()       { return !!getToken() },
  // Desde "/" se deja que decida InicioRedirect (selector o app única)
  guardarDestino() { sessionStorage.setItem(CLAVE_DESTINO, window.location.pathname === '/' ? '/' : inicioDeApp()) },
  tomarDestino()   { const d = sessionStorage.getItem(CLAVE_DESTINO) || '/'; sessionStorage.removeItem(CLAVE_DESTINO); return d },
}

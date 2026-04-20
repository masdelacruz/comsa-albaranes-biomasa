/**
 * Cliente API — reemplaza el cliente Supabase en el despliegue self-hosted.
 * Todas las llamadas van a /api (proxy nginx → contenedor api).
 */

const BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('biomasa_token')
}

function authHeaders(extra = {}) {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
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

  setToken(token)  { localStorage.setItem('biomasa_token', token) },
  clearToken()     { localStorage.removeItem('biomasa_token') },
  hasToken()       { return !!getToken() },
}

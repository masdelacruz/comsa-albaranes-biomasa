import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useAuth() {
  const [session,    setSession]    = useState(null)
  const [usuario,    setUsuario]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [bloqueado,  setBloqueado]  = useState(false)
  const [verificado, setVerificado] = useState(false)

  const verificarToken = useCallback(async () => {
    if (!api.hasToken()) {
      setLoading(false)
      setVerificado(true)
      return
    }
    try {
      const { user } = await api.me()
      setUsuario(user)
      setSession({ user })
      setBloqueado(false)
    } catch (err) {
      if (err.status === 403) setBloqueado(true)
      if (err.data?.error === 'usar_microsoft') sessionStorage.setItem('sso_error', 'usar_microsoft')
      api.clearToken()
      setSession(null)
      setUsuario(null)
    } finally {
      setLoading(false)
      setVerificado(true)
    }
  }, [])

  useEffect(() => { verificarToken() }, [verificarToken])

  const logout = useCallback(() => {
    const eraSso = api.esSso()
    api.clearToken()
    // El servidor decide si además se cierra la sesión de Microsoft
    // (AZURE_AD_SINGLE_LOGOUT); si no, vuelve directamente al login.
    if (eraSso) { window.location.href = '/api/auth/microsoft/logout'; return }
    setSession(null)
    setUsuario(null)
    setBloqueado(false)
  }, [])

  const actualizarUsuario = useCallback((updates) => {
    setUsuario(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  return { session, usuario, loading, bloqueado, verificado, logout, actualizarUsuario }
}

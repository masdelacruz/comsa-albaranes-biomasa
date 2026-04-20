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
    api.clearToken()
    setSession(null)
    setUsuario(null)
    setBloqueado(false)
  }, [])

  return { session, usuario, loading, bloqueado, verificado, logout }
}

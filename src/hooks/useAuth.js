import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
  const [session, setSession]     = useState(null)
  const [usuario, setUsuario]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [bloqueado, setBloqueado] = useState(false)
  const [verificado, setVerificado] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUsuario(session.user.id)
      else { setLoading(false); setVerificado(true) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUsuario(session.user.id)
      else { setUsuario(null); setBloqueado(false); setLoading(false); setVerificado(true) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUsuario = async (id) => {
    const { data } = await supabase.from('usuarios').select('*').eq('id', id).single()
    if (data && !data.activo) {
      await supabase.auth.signOut()
      setBloqueado(true)
      setSession(null)
      setUsuario(null)
    } else {
      setUsuario(data)
      setBloqueado(false)
    }
    setLoading(false)
    setVerificado(true)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return { session, usuario, loading, bloqueado, verificado, logout }
}
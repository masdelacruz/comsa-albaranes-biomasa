import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useAuth() {
  const [session, setSession]   = useState(null)
  const [usuario, setUsuario]   = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUsuario(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchUsuario(session.user.id)
      else { setUsuario(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUsuario = async (id) => {
    const { data } = await supabase.from('usuarios').select('*').eq('id', id).single()
    setUsuario(data)
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return { session, usuario, loading, logout }
}
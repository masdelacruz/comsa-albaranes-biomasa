import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

export function useAlbaranes() {
  const [albaranes, setAlbaranes] = useState([])
  const [loading,   setLoading]   = useState(true)

  const fetchAlbaranes = useCallback(async () => {
    try {
      const data = await api.get('/albaranes')
      setAlbaranes(data || [])
    } catch (e) {
      console.error('Error cargando albaranes:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlbaranes()
    // Polling cada 30 s para mantener datos actualizados
    // (reemplaza el realtime de Supabase)
    const interval = setInterval(fetchAlbaranes, 30_000)
    return () => clearInterval(interval)
  }, [fetchAlbaranes])

  return { albaranes, loading, refetch: fetchAlbaranes }
}

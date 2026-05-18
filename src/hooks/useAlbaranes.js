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

    // Polling cada 30 s — pausa cuando el tab está oculto
    const interval = setInterval(() => {
      if (!document.hidden) fetchAlbaranes()
    }, 30_000)

    // Al volver al tab, recarga inmediatamente
    const onVisibilityChange = () => {
      if (!document.hidden) fetchAlbaranes()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchAlbaranes])

  return { albaranes, loading, refetch: fetchAlbaranes }
}

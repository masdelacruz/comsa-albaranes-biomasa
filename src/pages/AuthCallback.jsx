import { useEffect } from 'react'
import { api } from '../lib/api'

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token  = params.get('token')
    const error  = params.get('error')

    if (token) {
      api.setToken(token, true)
      window.location.replace('/')
    } else {
      sessionStorage.setItem('sso_error', error || 'error_desconocido')
      window.location.replace('/')
    }
  }, [])

  return null
}

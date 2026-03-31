import { useState } from 'react'
import { supabase } from '../supabase'
import { Leaf } from 'lucide-react'
import './Login.css'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon"><Leaf size={22} /></div>
          <div>
            <div className="login-logo-title">Comsa Service</div>
            <div className="login-logo-sub">Gestión de albaranes · Biomasa</div>
          </div>
        </div>

        <h1 className="login-title">Acceder</h1>
        <p className="login-sub">Introduce tus credenciales para continuar</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label>Email corporativo</label>
            <input
              type="email"
              placeholder="nombre@comsa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Accediendo...' : 'Acceder'}
          </button>
        </form>

        <div className="login-footer">
          ¿Problemas de acceso? Contacta con Marc Serrano
        </div>
      </div>
    </div>
  )
}
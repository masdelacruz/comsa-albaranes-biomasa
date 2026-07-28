import { useState } from 'react'
import { api } from '../lib/api'
import logoFull from '../assets/logo_biomasa_full.png'
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
    try {
      const { token } = await api.login(email, password)
      api.setToken(token)
      window.location.reload()
    } catch (err) {
      setError(err.data?.error === 'cuenta_bloqueada'
        ? 'Tu cuenta está desactivada. Contacta con administración (biomasa@cserintranet.com).'
        : 'Email o contraseña incorrectos')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-content">
          <img src={logoFull} alt="Comsa Service Bioenergia" className="login-brand-logo" />
          <p className="login-brand-sub">Gestión de albaranes · Biomasa</p>
        </div>
        <div className="login-brand-footer">C/ Vallès, 2 - Pol. Ind. Almeda · 08940 Cornellà de Llobregat</div>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          <img src={logoFull} alt="Comsa Service Bioenergia" className="login-card-logo-mobile" />

          <h1 className="login-title">Bienvenido</h1>
          <p className="login-sub">Inicia sesión en tu cuenta para continuar</p>

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
            ¿Problemas de acceso? Contacta con administración: <a href="mailto:biomasa@cserintranet.com">biomasa@cserintranet.com</a>
          </div>
        </div>
      </div>
    </div>
  )
}

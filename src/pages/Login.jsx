import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import './Login.css'

const EMAIL_ADMIN = 'biomasa@cserintranet.com'
const MAILTO_OLVIDO = `mailto:${EMAIL_ADMIN}?subject=${encodeURIComponent('Recuperación de contraseña — Comsa Albaranes')}&body=${encodeURIComponent('Hola,\n\nHe olvidado mi contraseña de acceso a la plataforma de albaranes.\nMi email de usuario es: ')}`

export default function Login() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [recordarme, setRecordarme] = useState(true)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token } = await api.login(email, password)
      api.setToken(token, recordarme)
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
          <div className="login-brand-mark">
            <span className="login-brand-dot" />
            <span className="login-brand-square" />
          </div>
          <div className="login-brand-wordmark">
            <div className="login-brand-comsa">COMSA</div>
            <div className="login-brand-service">SERVICE</div>
            <div className="login-brand-service">BIOENERGIA</div>
          </div>
          <div className="login-brand-divider" />
          <p className="login-brand-sub">Gestión de albaranes · Biomasa</p>
        </div>
        <div className="login-brand-footer">
          <MapPin size={15} />
          <div>
            <div>C/ Vallès, 2 - Pol. Ind. Almeda</div>
            <div>08940 Cornellà de Llobregat</div>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-card-logo-mobile">
            <span className="login-brand-dot" />
            <span className="login-brand-square" />
            <span className="login-card-logo-mobile-text">COMSA</span>
          </div>

          <h1 className="login-title">Bienvenido</h1>
          <p className="login-sub">Inicia sesión en tu cuenta para continuar</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label>Email corporativo</label>
              <div className="login-input-group">
                <Mail size={16} className="login-input-icon" />
                <input
                  type="email"
                  placeholder="nombre@comsa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="login-field">
              <label>Contraseña</label>
              <div className="login-input-group login-input-group--toggle">
                <Lock size={16} className="login-input-icon" />
                <input
                  type={verPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-input-toggle"
                  onClick={() => setVerPassword(v => !v)}
                  tabIndex={-1}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-row-options">
              <label className="login-remember">
                <input type="checkbox" checked={recordarme} onChange={e => setRecordarme(e.target.checked)} />
                Recordarme
              </label>
              <a className="login-forgot" href={MAILTO_OLVIDO}>¿Has olvidado tu contraseña?</a>
            </div>

            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Accediendo...' : <>Acceder <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="login-shield-divider">
            <ShieldCheck size={14} />
          </div>
          <div className="login-footer">
            ¿Problemas de acceso? Contacta con administración:<br />
            <a href={`mailto:${EMAIL_ADMIN}`}>{EMAIL_ADMIN}</a>
          </div>
        </div>
      </div>
    </div>
  )
}

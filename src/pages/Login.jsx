import { useState, useEffect } from 'react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import logoFull from '../assets/logo_biomasa_full.png'
import './Login.css'

const EMAIL_ADMIN = 'biomasa@cserintranet.com'
const MAILTO_OLVIDO = `mailto:${EMAIL_ADMIN}?subject=${encodeURIComponent('Recuperación de contraseña — Comsa Albaranes')}&body=${encodeURIComponent('Hola,\n\nHe olvidado mi contraseña de acceso a la plataforma de albaranes.\nMi email de usuario es: ')}`

const ERRORES_SSO = {
  usuario_no_registrado: 'Tu cuenta de Microsoft no está dada de alta. Contacta con administración (biomasa@cserintranet.com).',
  cuenta_bloqueada: 'Tu cuenta está desactivada. Contacta con administración (biomasa@cserintranet.com).',
  dominio_no_permitido: 'Solo se admiten cuentas @comsa.com.',
  usar_microsoft: 'Tu cuenta corporativa debe iniciar sesión con Microsoft.',
  acceso_denegado: 'Microsoft no ha autorizado el acceso. Si crees que deberías tenerlo, contacta con IT.',
  sin_rol: 'Tu cuenta de Microsoft no tiene asignado acceso a esta aplicación. Contacta con IT.',
  identidad_no_coincide: 'Este email ya está vinculado a otra cuenta de Microsoft. Contacta con administración (biomasa@cserintranet.com).',
  tenant_no_permitido: 'Solo se admiten cuentas de la organización COMSA.',
  estado_invalido: 'El inicio de sesión ha caducado o se abrió en otra ventana. Inténtalo de nuevo.',
}
const ERROR_SSO_GENERICO = 'No se pudo iniciar sesión con Microsoft. Inténtalo de nuevo.'

export default function Login() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [recordarme, setRecordarme] = useState(true)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [msEnabled, setMsEnabled]   = useState(false)
  const [msObligatorio, setMsObligatorio] = useState(false)

  useEffect(() => {
    api.get('/auth/microsoft/status').then(d => {
      setMsEnabled(!!d?.enabled)
      setMsObligatorio(!!d?.obligatorio)
    }).catch(() => {})

    const ssoError = sessionStorage.getItem('sso_error')
    if (ssoError) {
      sessionStorage.removeItem('sso_error')
      setError(ERRORES_SSO[ssoError] || ERROR_SSO_GENERICO)
    }
  }, [])

  const loginMicrosoft = () => { window.location.href = '/api/auth/microsoft/login' }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token } = await api.login(email, password)
      api.setToken(token, recordarme)
      window.location.reload()
    } catch (err) {
      const codigo = err.data?.error
      setError(codigo === 'cuenta_bloqueada' || codigo === 'usar_microsoft'
        ? ERRORES_SSO[codigo]
        : 'Email o contraseña incorrectos')
      setLoading(false)
    }
  }

  const botonMicrosoft = (
    <button type="button" className="login-btn-microsoft" onClick={loginMicrosoft}>
      <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      Iniciar sesión con Microsoft
    </button>
  )

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-brand-content">
          <img src={logoFull} alt="Comsa Service Bioenergia" className="login-brand-logo" />
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
          <img src={logoFull} alt="Comsa Service Bioenergia" className="login-card-logo-mobile" />

          <h1 className="login-title">Bienvenido</h1>
          <p className="login-sub">Inicia sesión en tu cuenta para continuar</p>

          {msObligatorio && (
            <>
              {botonMicrosoft}
              <div className="login-divider"><span>cuentas externas</span></div>
            </>
          )}

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
              {loading ? 'Accediendo...' : 'Acceder'}
              <span className="icon">
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
            </button>
          </form>

          {msEnabled && !msObligatorio && (
            <>
              <div className="login-divider"><span>o</span></div>
              {botonMicrosoft}
            </>
          )}

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

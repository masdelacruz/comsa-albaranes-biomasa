import { useState } from 'react'
import { X, Check, Eye, EyeOff, Mail, Leaf, HardHat, Package, PenLine, CheckCircle2, Droplet, Lock } from 'lucide-react'
import { api } from '../lib/api'
import { useScrollLock } from '../hooks/useScrollLock'
import '../components/shared.css'
import './Perfil.css'
import './PerfilUsuario.css'

const ROLES = [
  'Transformación Digital', 'Resp. Operaciones Biomasa',
  'Administrativa Operaciones', 'Delegado Operaciones', 'Resp. Operaciones',
]

// Mismo orden y textos que en la página de Perfil
const NOTIFS = [
  { key: 'nuevo',   icon: Package,      label: 'Nuevo albarán',     desc: 'Se registra un albarán en el sistema' },
  { key: 'firma',   icon: PenLine,      label: 'Firma registrada',  desc: 'Se completa una firma de campo o de instalación' },
  { key: 'humedad', icon: Droplet,      label: 'Humedad pendiente', desc: 'El albarán necesita análisis de humedad' },
  { key: 'cerrado', icon: CheckCircle2, label: 'Albarán cerrado',   desc: 'Están todas las firmas requeridas' },
]

const APPS = [
  { key: 'accesoBiomasa', icon: Leaf,    label: 'Biomasa', desc: 'Gestión de albaranes de biomasa', mod: 'biomasa' },
  { key: 'accesoTrabajo', icon: HardHat, label: 'Trabajo', desc: 'Próximamente',                    mod: 'trabajo' },
]

const getN = (prefs, key) => prefs?.[key] !== false

function Switch({ on, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      className={`perfil-sw${on ? ' on' : ''}`} onClick={onClick}>
      <span className="perfil-sw-thumb" />
    </button>
  )
}

export default function PerfilUsuario({ usuario, viewer, onClose, onGuardado }) {
  useScrollLock(true)

  const iniciales = usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const esSuperadmin = viewer?.nivel === 'superadmin'
  const puedeEditarActivo = esSuperadmin && usuario.id !== viewer?.id

  const [form, setForm] = useState({
    nombre:   usuario.nombre,
    rol:      usuario.rol || ROLES[0],
    nivel:    usuario.nivel,
    activo:   usuario.activo,
    password: '',
    accesoBiomasa: usuario.acceso_biomasa !== false,
    accesoTrabajo: !!usuario.acceso_trabajo,
  })
  const [notifs,    setNotifs]    = useState(usuario.notificaciones || { silenciado: true })
  const [showPw,    setShowPw]    = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Con la cuenta desactivada todo lo demás queda bloqueado; los valores se
  // conservan tal cual y vuelven a estar disponibles al reactivarla.
  const bloqueado = !form.activo

  const silenciado = notifs.silenciado === true || NOTIFS.every(({ key }) => notifs[key] === false)
  const numActivas = NOTIFS.filter(({ key }) => getN(notifs, key)).length

  const toggleSilencio = () => setNotifs(p => {
    if (!silenciado) return { ...p, silenciado: true }
    // Al reactivar sin ningún tipo marcado, se activan todos para que tenga efecto
    const ninguno = NOTIFS.every(({ key }) => p?.[key] === false)
    return ninguno
      ? { ...p, silenciado: false, ...Object.fromEntries(NOTIFS.map(({ key }) => [key, true])) }
      : { ...p, silenciado: false }
  })

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true); setError('')
    try {
      let body
      if (bloqueado) {
        // Desactivada: solo se guarda el estado; la configuración queda intacta
        body = {}
      } else {
        body = {
          nombre: form.nombre,
          rol:    form.rol,
          nivel:  form.nivel,
          notificaciones: notifs,
        }
        if (esSuperadmin) {
          body.acceso_biomasa = form.accesoBiomasa
          body.acceso_trabajo = form.accesoTrabajo
        }
        if (form.password.trim())
          body.password = form.password
      }
      if (puedeEditarActivo && form.activo !== usuario.activo)
        body.activo = form.activo
      if (Object.keys(body).length) await api.patch(`/usuarios/${usuario.id}`, body)
      await onGuardado?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Error al guardar')
      setGuardando(false)
    }
  }

  return (
    <div className="pu-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pu-modal">

        {/* ── Identidad ────────────────────────────────────── */}
        <div className="pu-header">
          <button className="pu-close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
          <div className={`perfil-avatar pu-avatar${bloqueado ? ' off' : ''}`}>{iniciales}</div>
          <div className="pu-id">
            <h2 className="pu-nombre">
              {usuario.nombre}
              {usuario.nivel === 'superadmin' && <span className="pu-super" title="Superadministrador">★</span>}
            </h2>
            <div className="perfil-email"><Mail size={13} /> {usuario.email}</div>
            <div className={`pu-estado${bloqueado ? ' off' : ''}`}>
              {bloqueado ? 'Cuenta desactivada' : 'Cuenta activa'}
            </div>
          </div>
        </div>

        <div className="pu-body">

          {/* ── Estado de la cuenta (solo superadmin sobre otros) ── */}
          {puedeEditarActivo && (
            <section className="pu-sec">
              <div className="pu-row">
                <div className="pu-row-txt">
                  <h3 className="perfil-h3">Cuenta activa</h3>
                  <p className="pu-row-desc">
                    {bloqueado
                      ? 'No puede iniciar sesión. Su configuración se conserva y se recupera al reactivarla.'
                      : 'El usuario puede iniciar sesión en la plataforma.'}
                  </p>
                </div>
                <Switch on={form.activo} label="Cuenta activa" onClick={() => set('activo', !form.activo)} />
              </div>
            </section>
          )}

          <fieldset className="pu-bloque" disabled={bloqueado}>
            {bloqueado && (
              <div className="pu-bloqueo-aviso"><Lock size={13} /> Bloqueado mientras la cuenta esté desactivada</div>
            )}

            {/* ── Datos ── */}
            <section className="pu-sec">
              <h3 className="perfil-h3">Datos del usuario</h3>
              <div className="pu-grid">
                <div className="pu-fg pu-fg--full">
                  <label>Nombre completo</label>
                  <input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                </div>
                <div className="pu-fg">
                  <label>Departamento</label>
                  <select value={form.rol} onChange={e => set('rol', e.target.value)}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="pu-fg">
                  <label>Nivel de acceso</label>
                  <select value={form.nivel} onChange={e => set('nivel', e.target.value)}>
                    <option value="basico">Usuario básico</option>
                    <option value="usuario">Usuario avanzado</option>
                    <option value="superadmin">Superadministrador</option>
                  </select>
                </div>
                <div className="pu-fg pu-fg--full">
                  <label>Contraseña <span className="pu-hint">(vacío = sin cambio)</span></label>
                  <div className="pu-pw">
                    <input
                      type={showPw ? 'text' : 'password'}
                      minLength={12}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="pu-pw-eye" aria-label={showPw ? 'Ocultar' : 'Mostrar'}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Aplicaciones (solo superadmin) ── */}
            {esSuperadmin && (
              <section className="pu-sec">
                <h3 className="perfil-h3">Aplicaciones</h3>
                <ul className="pu-apps">
                  {APPS.map(({ key, icon: Icon, label, desc, mod }) => {
                    const on = form[key]
                    return (
                      <li key={key} className={`pu-app${on ? ' on' : ''}`}>
                        <span className={`perfil-app-ico${on ? ` perfil-app-ico--${mod}` : ''}`}><Icon size={14} /></span>
                        <div className="pu-row-txt">
                          <span className="pu-app-nombre">{label}</span>
                          <span className="pu-row-desc">{desc}</span>
                        </div>
                        <Switch on={on} label={`Acceso a ${label}`} onClick={() => set(key, !on)} />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {/* ── Avisos por email ── */}
            <section className="pu-sec">
              <div className="pu-row">
                <div className="pu-row-txt">
                  <h3 className="perfil-h3">Avisos por email</h3>
                  <p className="pu-row-desc">
                    {silenciado
                      ? 'Pausados: no recibirá ningún correo.'
                      : <>Recibe <strong>{numActivas} de {NOTIFS.length}</strong> avisos</>}
                  </p>
                </div>
                <label className="perfil-master">
                  <span>{silenciado ? 'Pausados' : 'Activados'}</span>
                  <Switch on={!silenciado} label="Recibir avisos por email" onClick={toggleSilencio} />
                </label>
              </div>

              <div className="perfil-flujo-label">Ciclo de un albarán</div>
              <ol className={`perfil-flujo${silenciado ? ' pausado' : ''}`}>
                {NOTIFS.map(n => {
                  const Icon = n.icon
                  const on = getN(notifs, n.key)
                  return (
                    <li key={n.key} className={`perfil-paso${on ? ' on' : ''}`}>
                      <span className="perfil-paso-nodo"><Icon size={15} /></span>
                      <div className="perfil-paso-txt">
                        <span className="perfil-paso-lbl">{n.label}</span>
                        <span className="perfil-paso-desc">{n.desc}</span>
                      </div>
                      <button type="button" role="switch" aria-checked={on} aria-label={n.label} disabled={silenciado}
                        className={`perfil-sw${on ? ' on' : ''}`}
                        onClick={() => setNotifs(p => ({ ...p, [n.key]: !getN(p, n.key) }))}>
                        <span className="perfil-sw-thumb" />
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          </fieldset>

          {error && <div className="pu-error">{error}</div>}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="pu-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando || !form.nombre.trim()}>
            {guardando ? 'Guardando...' : <><Check size={14} /> Guardar</>}
          </button>
        </div>

      </div>
    </div>
  )
}

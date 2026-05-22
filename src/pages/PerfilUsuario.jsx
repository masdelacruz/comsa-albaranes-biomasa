import { useState } from 'react'
import { X, Check, Eye, EyeOff, BellOff } from 'lucide-react'
import { api } from '../lib/api'
import { useScrollLock } from '../hooks/useScrollLock'
import '../components/shared.css'
import './PerfilUsuario.css'

const ROLES = [
  'Transformación Digital', 'Resp. Operaciones Biomasa',
  'Administrativa Operaciones', 'Delegado Operaciones', 'Resp. Operaciones',
]

const NOTIFS = [
  { key: 'nuevo',   color: 'var(--blue-400)',  label: 'Nuevo albarán',     desc: 'Al registrar un nuevo albarán en el sistema' },
  { key: 'firma',   color: 'var(--amber-400)', label: 'Firma registrada',  desc: 'Cuando se completa una firma de campo o instalación' },
  { key: 'cerrado', color: 'var(--green-400)', label: 'Albarán cerrado',   desc: 'Al finalizar todas las firmas requeridas' },
  { key: 'humedad', color: '#60a5fa',           label: 'Humedad pendiente', desc: 'Cuando un albarán requiere análisis de humedad' },
]

const getN = (prefs, key) => prefs?.[key] !== false

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
  })
  const [notifs,    setNotifs]    = useState(usuario.notificaciones || { silenciado: true })
  const [showPw,    setShowPw]    = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const silenciado = notifs.silenciado === true
    || ['nuevo', 'firma', 'cerrado', 'humedad'].every(k => notifs[k] === false)

  const toggleSilenciar = () =>
    setNotifs(p => ({ ...p, silenciado: !p.silenciado }))

  const toggleN = key =>
    setNotifs(p => ({ ...p, [key]: !getN(p, key) }))

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    setGuardando(true); setError('')
    try {
      const body = {
        nombre: form.nombre,
        rol:    form.rol,
        nivel:  form.nivel,
        notificaciones: notifs,
      }
      if (puedeEditarActivo && form.activo !== usuario.activo)
        body.activo = form.activo
      if (form.password.trim() && form.password !== (usuario.password_visible || ''))
        body.password = form.password
      await api.patch(`/usuarios/${usuario.id}`, body)
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

        {/* ── Header ───────────────────────────────────────── */}
        <div className="pu-header">
          <button className="pu-close" onClick={onClose}><X size={15} /></button>
          <div className="pu-avatar">{iniciales}</div>
          <div>
            <div className="pu-nombre">{usuario.nombre}</div>
            <div className="pu-rol">{usuario.email}</div>
            {usuario.nivel === 'superadmin' && (
              <span className="pu-super">★ Superadmin</span>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="pu-body">

          {/* Datos */}
          <section className="pu-sec">
            <div className="pu-sec-lbl">Datos del usuario</div>
            <div className="pu-fields">
              <div className="pu-fg">
                <label>Nombre completo</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              </div>
              <div className="pu-fg">
                <label>Rol</label>
                <select value={form.rol} onChange={e => set('rol', e.target.value)}>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="pu-fg" style={{ flex: 1 }}>
                  <label>Nivel</label>
                  <select value={form.nivel} onChange={e => set('nivel', e.target.value)}>
                    <option value="usuario">Usuario</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div className="pu-fg" style={{ flex: 2 }}>
                  <label>Contraseña <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(vacío = sin cambio)</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      style={{ paddingRight: 34, width: '100%', boxSizing: 'border-box' }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="pu-pw-eye">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Estado de cuenta — solo superadmin sobre otros usuarios */}
              {puedeEditarActivo && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', border: 'var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--gray-700)' }}>Cuenta activa</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>El usuario puede iniciar sesión</div>
                  </div>
                  <div
                    onClick={() => set('activo', !form.activo)}
                    style={{ width: 38, height: 21, background: form.activo ? 'var(--green-400)' : 'var(--gray-200)', borderRadius: 11, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: form.activo ? 18 : 3, width: 15, height: 15, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Notificaciones */}
          <section className="pu-sec">
            <div className="pu-sec-lbl">Notificaciones por email</div>

            {/* Toggle silenciar maestro */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: 10, background: silenciado ? 'var(--gray-50)' : '#ecfdf5', borderRadius: 'var(--radius-md)', border: silenciado ? 'var(--border)' : '1px solid #bbf7d0', cursor: 'pointer' }}
              onClick={toggleSilenciar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BellOff size={14} style={{ color: silenciado ? 'var(--gray-400)' : 'var(--green-600)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: silenciado ? 'var(--gray-600)' : 'var(--green-700)' }}>
                    {silenciado ? 'Silenciado — sin notificaciones' : 'Notificaciones activas'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>
                    {silenciado ? 'No recibirá ningún correo' : 'Recibe los tipos seleccionados abajo'}
                  </div>
                </div>
              </div>
              <div style={{ width: 38, height: 21, background: silenciado ? 'var(--gray-200)' : 'var(--green-400)', borderRadius: 11, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: silenciado ? 3 : 18, width: 15, height: 15, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
            </div>

            {/* Tipos individuales */}
            <div className="pu-notifs" style={{ opacity: silenciado ? 0.45 : 1, transition: 'opacity 0.2s' }}>
              <p className="pu-sec-desc" style={{ margin: '0 0 8px' }}>
                {silenciado ? 'Configura los tipos para cuando se active.' : 'Selecciona qué eventos generan un correo.'}
              </p>
              {NOTIFS.map(({ key, color, label, desc }) => (
                <div key={key} className="pu-notif-row" onClick={() => toggleN(key)}>
                  <span className="pu-notif-dot" style={{ background: color }} />
                  <div className="pu-notif-info">
                    <span className="pu-notif-lbl">{label}</span>
                    <span className="pu-notif-desc">{desc}</span>
                  </div>
                  <div className={`pu-sw${getN(notifs, key) ? ' on' : ''}`}>
                    <div className="pu-sw-thumb" />
                  </div>
                </div>
              ))}
            </div>
          </section>

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

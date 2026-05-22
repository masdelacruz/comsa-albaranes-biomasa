import { useState } from 'react'
import { X, Check, Eye, EyeOff } from 'lucide-react'
import { api } from '../lib/api'
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

export default function PerfilUsuario({ usuario, onClose, onGuardado }) {
  const iniciales = usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  const [form, setForm] = useState({
    nombre:   usuario.nombre,
    rol:      usuario.rol || ROLES[0],
    nivel:    usuario.nivel,
    password: '',
  })
  const [notifs,    setNotifs]    = useState(usuario.notificaciones || {})
  const [showPw,    setShowPw]    = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleN = key => setNotifs(p => ({ ...p, [key]: !getN(p, key) }))

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
            </div>
          </section>

          {/* Notificaciones */}
          <section className="pu-sec">
            <div className="pu-sec-lbl">Notificaciones por email</div>
            <p className="pu-sec-desc">Selecciona qué eventos generan un correo para este usuario.</p>
            <div className="pu-notifs">
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

          {error && (
            <div className="pu-error">{error}</div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="pu-footer">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleGuardar}
            disabled={guardando || !form.nombre.trim()}
          >
            {guardando ? 'Guardando...' : <><Check size={14} /> Guardar</>}
          </button>
        </div>

      </div>
    </div>
  )
}

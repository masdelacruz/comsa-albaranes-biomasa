import { useState } from 'react'
import { X, Check, Eye, EyeOff, Bell, ShieldCheck, UserRound, LayoutGrid } from 'lucide-react'
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

const APPS = [
  { key: 'accesoBiomasa', label: 'Biomasa', desc: 'Gestión de albaranes de biomasa', color: 'var(--green-400)' },
  { key: 'accesoTrabajo', label: 'Trabajo', desc: 'Próximamente',                    color: 'var(--blue-400)' },
]

const NIVELES = { basico: 'Básico', usuario: 'Usuario', superadmin: 'Superadmin' }

const getN = (prefs, key) => prefs?.[key] !== false

// Fila con interruptor: toda la fila es el botón, así un <fieldset disabled>
// la bloquea igual que a los inputs.
function FilaSwitch({ on, onToggle, titulo, desc, punto, icono, compacta }) {
  return (
    <button type="button" role="switch" aria-checked={on}
      className={`pu-fila${compacta ? ' compacta' : ''}`} onClick={onToggle}>
      {punto && <span className="pu-punto" style={{ background: punto }} />}
      {icono}
      <span className="pu-fila-texto">
        <span className="pu-fila-titulo">{titulo}</span>
        {desc && <span className="pu-fila-desc">{desc}</span>}
      </span>
      <span className={`pu-sw${on ? ' on' : ''}`}><span className="pu-sw-thumb" /></span>
    </button>
  )
}

const Seccion = ({ icono: Icono, titulo, children }) => (
  <section className="pu-sec">
    <div className="pu-sec-head">
      <span className="pu-sec-icon"><Icono size={14} /></span>
      <span className="pu-sec-lbl">{titulo}</span>
    </div>
    {children}
  </section>
)

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

  // Con la cuenta desactivada no tiene sentido tocar nada más: el resto del
  // formulario se bloquea (se conserva tal cual) hasta que se vuelva a activar.
  const bloqueado = puedeEditarActivo && !form.activo

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
      if (esSuperadmin) {
        body.acceso_biomasa = form.accesoBiomasa
        body.acceso_trabajo = form.accesoTrabajo
      }
      if (puedeEditarActivo && form.activo !== usuario.activo)
        body.activo = form.activo
      if (form.password.trim() && !bloqueado)
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

        {/* ── Cabecera ─────────────────────────────────────── */}
        <div className="pu-header">
          <button className="pu-close" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
          <div className={`pu-avatar${bloqueado ? ' inactivo' : ''}`}>{iniciales}</div>
          <div className="pu-quien">
            <div className="pu-nombre">{usuario.nombre}</div>
            <div className="pu-email">{usuario.email}</div>
            <div className="pu-meta">
              <span>{NIVELES[usuario.nivel] || usuario.nivel}</span>
              {usuario.rol && <><span className="pu-meta-sep">·</span><span>{usuario.rol}</span></>}
              <span className="pu-meta-sep">·</span>
              <span className={form.activo ? 'pu-estado-on' : 'pu-estado-off'}>
                {form.activo ? 'Activa' : 'Desactivada'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Cuerpo ───────────────────────────────────────── */}
        <div className="pu-body">

          {/* Estado de la cuenta — solo superadmin sobre otros usuarios; va
              primero porque condiciona todo lo demás */}
          {puedeEditarActivo && (
            <Seccion icono={ShieldCheck} titulo="Estado de la cuenta">
              <FilaSwitch on={form.activo} onToggle={() => set('activo', !form.activo)}
                titulo="Cuenta activa"
                desc={form.activo
                  ? 'El usuario puede iniciar sesión y recibir notificaciones'
                  : 'No puede iniciar sesión. Actívala para editar el resto de datos'} />
            </Seccion>
          )}

          <fieldset className="pu-bloque" disabled={bloqueado}>

            <Seccion icono={UserRound} titulo="Datos del usuario">
              <div className="pu-grid">
                <div className="pu-fg">
                  <label htmlFor="pu-nombre">Nombre completo</label>
                  <input id="pu-nombre" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
                </div>
                <div className="pu-fg">
                  <label htmlFor="pu-rol">Rol</label>
                  <select id="pu-rol" value={form.rol} onChange={e => set('rol', e.target.value)}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="pu-fg">
                  <label htmlFor="pu-nivel">Nivel</label>
                  <select id="pu-nivel" value={form.nivel} onChange={e => set('nivel', e.target.value)}>
                    {Object.entries(NIVELES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <div className="pu-fg">
                  <label htmlFor="pu-pw">Contraseña <span className="pu-label-nota">(vacío = sin cambio)</span></label>
                  <div className="pu-pw">
                    <input
                      id="pu-pw"
                      type={showPw ? 'text' : 'password'}
                      minLength={12}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="pu-pw-eye"
                      aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </Seccion>

            {/* Acceso a apps — solo superadmin lo configura */}
            {esSuperadmin && (
              <Seccion icono={LayoutGrid} titulo="Acceso a aplicaciones">
                <div className="pu-lista">
                  {APPS.map(({ key, label, desc, color }) => (
                    <FilaSwitch key={key} on={form[key]} onToggle={() => set(key, !form[key])}
                      titulo={label} desc={desc} punto={color} />
                  ))}
                </div>
              </Seccion>
            )}

            <Seccion icono={Bell} titulo="Notificaciones por email">
              <FilaSwitch on={!silenciado} onToggle={toggleSilenciar}
                titulo={silenciado ? 'Silenciado' : 'Notificaciones activas'}
                desc={silenciado ? 'No recibirá ningún correo' : 'Recibe los tipos seleccionados abajo'} />

              <div className={`pu-notifs${silenciado ? ' apagadas' : ''}`}>
                <p className="pu-sec-desc">
                  {silenciado ? 'Configura los tipos para cuando se active.' : 'Selecciona qué eventos generan un correo.'}
                </p>
                {NOTIFS.map(({ key, color, label, desc }) => (
                  <FilaSwitch key={key} compacta on={getN(notifs, key)} onToggle={() => toggleN(key)}
                    titulo={label} desc={desc} punto={color} />
                ))}
              </div>
            </Seccion>

          </fieldset>

          {error && <div className="pu-error">{error}</div>}
        </div>

        {/* ── Pie ──────────────────────────────────────────── */}
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

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Briefcase, Shield, Bell, BellOff, LogOut, LayoutGrid, Leaf, HardHat } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'
import './Perfil.css'

const NOTIFS = [
  { key: 'nuevo',   color: 'var(--blue-400)',  label: 'Nuevo albarán',     desc: 'Al registrar un nuevo albarán en el sistema' },
  { key: 'firma',   color: 'var(--amber-400)', label: 'Firma registrada',  desc: 'Cuando se completa una firma de campo o instalación' },
  { key: 'cerrado', color: 'var(--green-400)', label: 'Albarán cerrado',   desc: 'Al finalizar todas las firmas requeridas' },
  { key: 'humedad', color: '#60a5fa',           label: 'Humedad pendiente', desc: 'Cuando un albarán requiere análisis de humedad' },
]
const getN = (p, k) => p?.[k] !== false

export default function Perfil({ usuario, actualizarUsuario, logout }) {
  const navigate = useNavigate()
  const [notifPrefs, setNotifPrefs]         = useState(usuario?.notificaciones || {})
  const [notifGuardando, setNotifGuardando] = useState(false)
  const [notifOk, setNotifOk]               = useState(false)
  const [confirmLogout, setConfirmLogout]   = useState(false)

  useEffect(() => { setNotifPrefs(usuario?.notificaciones || {}) }, [usuario?.notificaciones])

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const esSuperadmin = usuario?.nivel === 'superadmin'
  const tieneBiomasa = usuario?.acceso_biomasa !== false
  const tieneTrabajo = !!usuario?.acceso_trabajo

  const silenciado = notifPrefs?.silenciado === true
    || ['nuevo', 'firma', 'cerrado', 'humedad'].every(k => notifPrefs?.[k] === false)

  const notifDirty =
    (notifPrefs?.silenciado ?? false) !== (usuario?.notificaciones?.silenciado ?? false) ||
    NOTIFS.some(({ key }) => getN(notifPrefs, key) !== getN(usuario?.notificaciones, key))

  const handleGuardarNotif = async () => {
    setNotifGuardando(true)
    try {
      await api.patch('/usuarios/me/notificaciones', { notificaciones: notifPrefs })
      actualizarUsuario?.({ notificaciones: notifPrefs })
      setNotifOk(true)
      setTimeout(() => setNotifOk(false), 2500)
    } catch (e) { console.error(e) }
    finally { setNotifGuardando(false) }
  }

  const handleLogout = async () => {
    await logout()
    setConfirmLogout(false)
  }

  return (
    <div className="perfil-page">
      <div className="page-header">
        <div className="page-title">Perfil</div>
        <div className="page-sub">Tu cuenta y tus preferencias</div>
      </div>

      <div className="perfil-content">
        {/* Identidad */}
        <div className="card perfil-identidad">
          <div className="perfil-avatar">{iniciales}</div>
          <div>
            <div className="perfil-nombre">
              {usuario?.nombre}
              {esSuperadmin && <span className="perfil-super">★ Superadmin</span>}
            </div>
            <div className="perfil-email">{usuario?.email}</div>
          </div>
        </div>

        <div className="perfil-grid">
          {/* Datos de cuenta */}
          <div className="card perfil-sec">
            <div className="section-label">Información de cuenta</div>
            {[
              { icon: <Mail size={14} />,      label: 'Email',  value: usuario?.email },
              { icon: <Briefcase size={14} />, label: 'Rol',    value: usuario?.rol },
              { icon: <Shield size={14} />,    label: 'Acceso', value: esSuperadmin ? 'Superadministrador' : 'Usuario estándar' },
            ].map(({ icon, label, value }) => (
              <div key={label} className="perfil-row">
                <div className="perfil-row-icon">{icon}</div>
                <div>
                  <div className="perfil-row-label">{label}</div>
                  <div className="perfil-row-val">{value || '—'}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Aplicaciones */}
          <div className="card perfil-sec">
            <div className="section-label">Aplicaciones</div>
            <div className="perfil-apps">
              <div className={`perfil-app${tieneBiomasa ? ' activa' : ''}`}>
                <span className="perfil-app-icon perfil-app-icon--biomasa"><Leaf size={15} /></span>
                <span className="perfil-app-nombre">Biomasa</span>
                <span className="perfil-app-estado">{tieneBiomasa ? 'Con acceso' : 'Sin acceso'}</span>
              </div>
              <div className={`perfil-app${tieneTrabajo ? ' activa' : ''}`}>
                <span className="perfil-app-icon perfil-app-icon--trabajo"><HardHat size={15} /></span>
                <span className="perfil-app-nombre">Trabajo</span>
                <span className="perfil-app-estado">{tieneTrabajo ? 'Con acceso' : 'Sin acceso'}</span>
              </div>
            </div>
            {tieneBiomasa && tieneTrabajo && (
              <button className="btn perfil-cambiar-app" onClick={() => navigate('/apps')}>
                <LayoutGrid size={13} /> Cambiar de aplicación
              </button>
            )}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="card perfil-sec">
          <div className="section-label">Notificaciones por email</div>

          <div className={`perfil-silenciar${silenciado ? '' : ' activo'}`} onClick={() => setNotifPrefs(p => ({ ...p, silenciado: !p.silenciado }))}>
            <div className="perfil-silenciar-info">
              <BellOff size={14} />
              <div>
                <div className="perfil-silenciar-title">{silenciado ? 'Silenciado — sin notificaciones' : 'Notificaciones activas'}</div>
                <div className="perfil-silenciar-sub">{silenciado ? 'No recibirás ningún correo' : 'Recibes los tipos seleccionados abajo'}</div>
              </div>
            </div>
            <div className={`perfil-sw${silenciado ? '' : ' on'}`}><div className="perfil-sw-thumb" /></div>
          </div>

          <div className="perfil-notifs" style={{ opacity: silenciado ? 0.45 : 1 }}>
            {NOTIFS.map(({ key, color, label, desc }) => (
              <div key={key} className="perfil-notif-row" onClick={() => setNotifPrefs(p => ({ ...p, [key]: !getN(p, key) }))}>
                <span className="perfil-notif-dot" style={{ background: color }} />
                <div className="perfil-notif-info">
                  <span className="perfil-notif-lbl">{label}</span>
                  <span className="perfil-notif-desc">{desc}</span>
                </div>
                <div className={`perfil-sw${getN(notifPrefs, key) ? ' on' : ''}`}><div className="perfil-sw-thumb" /></div>
              </div>
            ))}
          </div>

          {(notifDirty || notifOk) && (
            <div className="perfil-notif-actions">
              {notifOk
                ? <span className="perfil-notif-ok">✓ Guardado</span>
                : <button className="btn btn-primary" onClick={handleGuardarNotif} disabled={notifGuardando}>
                    {notifGuardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
              }
            </div>
          )}
        </div>

        {/* Sesión */}
        <div className="card perfil-sec">
          <div className="section-label">Sesión</div>
          {!confirmLogout ? (
            <button className="btn perfil-logout-btn" onClick={() => setConfirmLogout(true)}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          ) : (
            <div className="perfil-logout-confirm">
              <div className="perfil-logout-confirm-text">¿Seguro que quieres cerrar sesión?</div>
              <div className="perfil-logout-confirm-actions">
                <button className="btn" onClick={() => setConfirmLogout(false)}>Cancelar</button>
                <button className="btn perfil-logout-yes" onClick={handleLogout}>Sí, cerrar sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

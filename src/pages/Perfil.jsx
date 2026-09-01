import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Briefcase, Shield, BellOff, LogOut, LayoutGrid, Leaf, HardHat, Package, PenLine, CheckCircle2, Droplet, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'
import './Perfil.css'

const NOTIFS = [
  { key: 'nuevo',   icon: Package,      tone: 'blue',  label: 'Nuevo albarán',     desc: 'Al registrar un nuevo albarán en el sistema' },
  { key: 'firma',   icon: PenLine,      tone: 'amber', label: 'Firma registrada',  desc: 'Cuando se completa una firma de campo o instalación' },
  { key: 'cerrado', icon: CheckCircle2, tone: 'green', label: 'Albarán cerrado',   desc: 'Al finalizar todas las firmas requeridas' },
  { key: 'humedad', icon: Droplet,      tone: 'blue',  label: 'Humedad pendiente', desc: 'Cuando un albarán requiere análisis de humedad' },
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
  const labelAcceso = esSuperadmin ? 'Superadministrador' : usuario?.nivel === 'usuario' ? 'Usuario avanzado' : 'Usuario básico'
  const tieneBiomasa = usuario?.acceso_biomasa !== false
  const tieneTrabajo = !!usuario?.acceso_trabajo
  const numApps = (tieneBiomasa ? 1 : 0) + (tieneTrabajo ? 1 : 0)

  const silenciado = notifPrefs?.silenciado === true
    || ['nuevo', 'firma', 'cerrado', 'humedad'].every(k => notifPrefs?.[k] === false)
  const numActivas = NOTIFS.filter(({ key }) => getN(notifPrefs, key)).length

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
        <div className="card perfil-banner">
          <div className="perfil-avatar">{iniciales}</div>
          <div className="perfil-banner-info">
            <div className="perfil-nombre">
              {usuario?.nombre}
              {esSuperadmin && <span className="perfil-super">★ Superadmin</span>}
            </div>
            <div className="perfil-email"><Mail size={12} /> {usuario?.email}</div>
            <div className="perfil-chips">
              <span className="perfil-chip"><Briefcase size={11} /> {usuario?.rol || '—'}</span>
              <span className="perfil-chip"><Shield size={11} /> {labelAcceso}</span>
              <span className="perfil-chip"><LayoutGrid size={11} /> {numApps} app{numApps !== 1 ? 's' : ''} activa{numApps !== 1 ? 's' : ''}</span>
              <span className="perfil-chip"><BellOff size={11} /> {silenciado ? 'Notificaciones off' : `${numActivas}/${NOTIFS.length} notificaciones`}</span>
            </div>
          </div>
        </div>

        <div className="perfil-layout">
          {/* ── Columna izquierda ── */}
          <div className="perfil-col">
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

            <div className="card perfil-sec">
              <div className="section-label">Aplicaciones</div>
              <div className="perfil-apps">
                <div className={`perfil-app${tieneBiomasa ? ' activa' : ''}`}>
                  <span className="perfil-app-icon perfil-app-icon--biomasa"><Leaf size={18} /></span>
                  <div className="perfil-app-texto">
                    <span className="perfil-app-nombre">Biomasa</span>
                    <span className="perfil-app-desc">Gestión de albaranes de biomasa</span>
                  </div>
                  {tieneBiomasa && <CheckCircle size={15} className="perfil-app-check" />}
                </div>
                <div className={`perfil-app${tieneTrabajo ? ' activa' : ''}`}>
                  <span className="perfil-app-icon perfil-app-icon--trabajo"><HardHat size={18} /></span>
                  <div className="perfil-app-texto">
                    <span className="perfil-app-nombre">Trabajo</span>
                    <span className="perfil-app-desc">Próximamente</span>
                  </div>
                  {tieneTrabajo && <CheckCircle size={15} className="perfil-app-check" />}
                </div>
              </div>
              {tieneBiomasa && tieneTrabajo && (
                <button className="btn perfil-cambiar-app" onClick={() => navigate('/apps')}>
                  <LayoutGrid size={13} /> Cambiar de aplicación
                </button>
              )}
            </div>

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

          {/* ── Columna derecha: notificaciones ── */}
          <div className="card perfil-sec perfil-notif-card">
            <div className="section-label">Notificaciones por email</div>

            <div className={`perfil-silenciar${silenciado ? '' : ' activo'}`} onClick={() => setNotifPrefs(p => ({ ...p, silenciado: !p.silenciado }))}>
              <div className="perfil-silenciar-info">
                <BellOff size={14} />
                <div>
                  <div className="perfil-silenciar-title">{silenciado ? 'Silenciado — sin notificaciones' : 'Notificaciones activas'}</div>
                  <div className="perfil-silenciar-sub">{silenciado ? 'No recibirás ningún correo' : 'Recibes los tipos activados abajo'}</div>
                </div>
              </div>
              <div className={`perfil-sw${silenciado ? '' : ' on'}`}><div className="perfil-sw-thumb" /></div>
            </div>

            <div className="perfil-notifs" style={{ opacity: silenciado ? 0.45 : 1 }}>
              {NOTIFS.map(n => {
                const Icon = n.icon
                return (
                <div key={n.key} className="perfil-notif-card-item" onClick={() => setNotifPrefs(p => ({ ...p, [n.key]: !getN(p, n.key) }))}>
                  <div className="perfil-notif-top">
                    <span className={`perfil-notif-icon perfil-tone-${n.tone}`}><Icon size={15} /></span>
                    <div className={`perfil-sw${getN(notifPrefs, n.key) ? ' on' : ''}`}><div className="perfil-sw-thumb" /></div>
                  </div>
                  <span className="perfil-notif-lbl">{n.label}</span>
                  <span className="perfil-notif-desc">{n.desc}</span>
                </div>
                )
              })}
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
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, LogOut, LayoutGrid, Leaf, HardHat, Package, PenLine, CheckCircle2, Droplet, Check, Minus } from 'lucide-react'
import { api } from '../lib/api'
import '../components/shared.css'
import './Perfil.css'

// En el orden en que ocurren durante la vida de un albarán
const NOTIFS = [
  { key: 'nuevo',   icon: Package,      label: 'Nuevo albarán',     desc: 'Se registra un albarán en el sistema' },
  { key: 'firma',   icon: PenLine,      label: 'Firma registrada',  desc: 'Se completa una firma de campo o de instalación' },
  { key: 'humedad', icon: Droplet,      label: 'Humedad pendiente', desc: 'El albarán necesita análisis de humedad' },
  { key: 'cerrado', icon: CheckCircle2, label: 'Albarán cerrado',   desc: 'Están todas las firmas requeridas' },
]
const getN = (p, k) => p?.[k] !== false

const NIVELES = {
  superadmin: { label: 'Superadministrador', resumen: 'Acceso completo a la plataforma' },
  usuario:    { label: 'Usuario avanzado',   resumen: 'Gestiona albaranes, clientes y configuración' },
  basico:     { label: 'Usuario básico',     resumen: 'Consulta y registra albaranes' },
}
const PERMISOS = [
  { label: 'Ver y registrar albaranes',             niveles: ['basico', 'usuario', 'superadmin'] },
  { label: 'Consultar historial y estadísticas',    niveles: ['basico', 'usuario', 'superadmin'] },
  { label: 'Gestionar clientes y configuración',    niveles: ['usuario', 'superadmin'] },
  { label: 'Regenerar accesos de clientes',         niveles: ['superadmin'] },
  { label: 'Administrar usuarios y auditoría',      niveles: ['superadmin'] },
]
const CONTACTO = 'albaranes.bio@comsa.com'

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
  const nivel = NIVELES[usuario?.nivel] ? usuario.nivel : 'basico'
  const esSuperadmin = nivel === 'superadmin'
  const tieneBiomasa = usuario?.acceso_biomasa !== false
  const tieneTrabajo = !!usuario?.acceso_trabajo

  const silenciado = notifPrefs?.silenciado === true || NOTIFS.every(({ key }) => notifPrefs?.[key] === false)
  const numActivas = NOTIFS.filter(({ key }) => getN(notifPrefs, key)).length

  const notifDirty =
    (notifPrefs?.silenciado ?? false) !== (usuario?.notificaciones?.silenciado ?? false) ||
    NOTIFS.some(({ key }) => getN(notifPrefs, key) !== getN(usuario?.notificaciones, key))

  const toggleSilencio = () => setNotifPrefs(p => {
    if (!silenciado) return { ...p, silenciado: true }
    // Al reactivar sin ningún tipo marcado, se activan todos para que tenga efecto
    const ninguno = NOTIFS.every(({ key }) => p?.[key] === false)
    return ninguno
      ? { ...p, silenciado: false, ...Object.fromEntries(NOTIFS.map(({ key }) => [key, true])) }
      : { ...p, silenciado: false }
  })

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
        {/* ── Identidad ── */}
        <section className="card perfil-hero">
          <div className="perfil-hero-top">
            <div className="perfil-avatar">{iniciales}</div>
            <div className="perfil-hero-id">
              <h2 className="perfil-nombre">{usuario?.nombre}</h2>
              <div className="perfil-email"><Mail size={13} /> {usuario?.email}</div>
            </div>
            <div className="perfil-hero-actions">
              {!confirmLogout ? (
                <button className="btn perfil-logout-btn" onClick={() => setConfirmLogout(true)}>
                  <LogOut size={14} /> Cerrar sesión
                </button>
              ) : (
                <div className="perfil-logout-confirm">
                  <span>¿Cerrar sesión?</span>
                  <button className="btn" onClick={() => setConfirmLogout(false)}>Cancelar</button>
                  <button className="btn perfil-logout-yes" onClick={handleLogout}>Sí, salir</button>
                </div>
              )}
            </div>
          </div>

          <dl className="perfil-facts">
            <div className="perfil-fact">
              <dt>Departamento</dt>
              <dd>{usuario?.rol || '—'}</dd>
            </div>
            <div className="perfil-fact">
              <dt>Nivel de acceso</dt>
              <dd>
                {NIVELES[nivel].label}
                {esSuperadmin && <span className="perfil-super">★</span>}
              </dd>
              <span className="perfil-fact-sub">{NIVELES[nivel].resumen}</span>
            </div>
            <div className="perfil-fact">
              <dt>Aplicaciones</dt>
              <dd className="perfil-apps">
                <span className={`perfil-app${tieneBiomasa ? '' : ' off'}`}><Leaf size={13} /> Biomasa</span>
                <span className={`perfil-app${tieneTrabajo ? '' : ' off'}`}><HardHat size={13} /> Trabajo</span>
              </dd>
              {tieneBiomasa && tieneTrabajo
                ? <button className="perfil-link" onClick={() => navigate('/apps')}><LayoutGrid size={12} /> Cambiar de aplicación</button>
                : <span className="perfil-fact-sub">{tieneTrabajo ? '' : 'Trabajo: próximamente'}</span>}
            </div>
          </dl>
        </section>

        <div className="perfil-layout">
          {/* ── Avisos por email ── */}
          <section className="card perfil-notif">
            <header className="perfil-notif-head">
              <div>
                <h3 className="perfil-h3">Avisos por email</h3>
                <p className="perfil-notif-resumen">
                  {silenciado
                    ? 'Pausados: no recibirás ningún correo.'
                    : <>Recibes <strong>{numActivas} de {NOTIFS.length}</strong> avisos en {usuario?.email}</>}
                </p>
              </div>
              <label className="perfil-master">
                <span>{silenciado ? 'Pausados' : 'Activados'}</span>
                <button type="button" role="switch" aria-checked={!silenciado} aria-label="Recibir avisos por email"
                  className={`perfil-sw${silenciado ? '' : ' on'}`} onClick={toggleSilencio}>
                  <span className="perfil-sw-thumb" />
                </button>
              </label>
            </header>

            <div className="perfil-flujo-label">Ciclo de un albarán</div>
            <ol className={`perfil-flujo${silenciado ? ' pausado' : ''}`}>
              {NOTIFS.map(n => {
                const Icon = n.icon
                const on = getN(notifPrefs, n.key)
                return (
                  <li key={n.key} className={`perfil-paso${on ? ' on' : ''}`}>
                    <span className="perfil-paso-nodo"><Icon size={15} /></span>
                    <div className="perfil-paso-txt">
                      <span className="perfil-paso-lbl">{n.label}</span>
                      <span className="perfil-paso-desc">{n.desc}</span>
                    </div>
                    <button type="button" role="switch" aria-checked={on} aria-label={n.label} disabled={silenciado}
                      className={`perfil-sw${on ? ' on' : ''}`}
                      onClick={() => setNotifPrefs(p => ({ ...p, [n.key]: !getN(p, n.key) }))}>
                      <span className="perfil-sw-thumb" />
                    </button>
                  </li>
                )
              })}
            </ol>

            {(notifDirty || notifOk) && (
              <div className="perfil-notif-actions">
                {notifOk
                  ? <span className="perfil-notif-ok"><Check size={14} /> Preferencias guardadas</span>
                  : <>
                      <span className="perfil-notif-pend">Tienes cambios sin guardar</span>
                      <button className="btn" onClick={() => setNotifPrefs(usuario?.notificaciones || {})} disabled={notifGuardando}>Descartar</button>
                      <button className="btn btn-primary" onClick={handleGuardarNotif} disabled={notifGuardando}>
                        {notifGuardando ? 'Guardando...' : 'Guardar'}
                      </button>
                    </>}
              </div>
            )}
          </section>

          {/* ── Qué permite tu acceso ── */}
          <aside className="card perfil-permisos">
            <h3 className="perfil-h3">Qué puedes hacer</h3>
            <ul className="perfil-permisos-lista">
              {PERMISOS.map(p => {
                const ok = p.niveles.includes(nivel)
                return (
                  <li key={p.label} className={ok ? 'ok' : 'no'}>
                    {ok ? <Check size={14} /> : <Minus size={14} />} {p.label}
                  </li>
                )
              })}
            </ul>
            <p className="perfil-ayuda">
              ¿Algún dato incorrecto o necesitas más permisos? Escribe a{' '}
              <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}

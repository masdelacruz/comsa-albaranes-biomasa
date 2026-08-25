import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Clock, BarChart2, Settings, LogOut, User, X, Mail, Briefcase, Shield, Users, Bell, BellOff, LayoutGrid } from 'lucide-react'
import { api } from '../lib/api'
import { useScrollLock } from '../hooks/useScrollLock'
import Dock from './Dock'
import './Layout.css'

const NOTIFS = [
  { key: 'nuevo',   color: 'var(--blue-400)',  label: 'Nuevo albarán',     desc: 'Al registrar un nuevo albarán' },
  { key: 'firma',   color: 'var(--amber-400)', label: 'Firma registrada',  desc: 'Cuando se completa una firma' },
  { key: 'cerrado', color: 'var(--green-400)', label: 'Albarán cerrado',   desc: 'Al finalizar todas las firmas' },
  { key: 'humedad', color: '#60a5fa',           label: 'Humedad pendiente', desc: 'Pendiente de análisis de humedad' },
]
const getN = (p, k) => p?.[k] !== false

export default function Layout({ usuario, logout, albaranes = [], actualizarUsuario }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [perfilOpen, setPerfilOpen]       = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [notifPrefs, setNotifPrefs]       = useState({})
  const [notifGuardando, setNotifGuardando] = useState(false)
  const [notifOk, setNotifOk]             = useState(false)

  // .layout usa min-height:100vh, así que el scroll real es el de la
  // ventana (no uno interno) — React Router no lo resetea solo al navegar.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  // Si ya estamos en la ruta destino, el pathname no cambia al pulsar el
  // icono del dock, así que el efecto de arriba no salta solo: forzamos
  // el scroll suave aquí también.
  const irA = ruta => () => {
    if (location.pathname === ruta) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate(ruta)
    }
  }

  const iniciales = usuario?.nombre
    ? usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const esSuperadmin = usuario?.nivel === 'superadmin'

  const pendientesOficina = albaranes.filter(a => a.estado === 'pendiente_oficina').length

  // Reinicia prefs al abrir modal + ESC para cerrar
  useEffect(() => {
    if (perfilOpen) {
      setNotifPrefs(usuario?.notificaciones || {})
      setNotifOk(false)
    }
  }, [perfilOpen])

  useEffect(() => {
    if (!perfilOpen) return
    const onKey = e => { if (e.key === 'Escape') { setPerfilOpen(false); setConfirmLogout(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [perfilOpen])

  const handleLogout = async () => {
    await logout()
    setConfirmLogout(false)
  }

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

  useScrollLock(perfilOpen)

  const silenciadoPropio = notifPrefs?.silenciado === true
    || ['nuevo', 'firma', 'cerrado', 'humedad'].every(k => notifPrefs?.[k] === false)

  const notifDirty =
    (notifPrefs?.silenciado ?? false) !== (usuario?.notificaciones?.silenciado ?? false) ||
    NOTIFS.some(({ key }) => getN(notifPrefs, key) !== getN(usuario?.notificaciones, key))

  const dockItems = [
    { key: 'dashboard',      label: 'Dashboard',      icon: <LayoutDashboard size={18} />, active: location.pathname === '/dashboard',      badge: pendientesOficina, onClick: irA('/dashboard') },
    { key: 'nuevo',          label: 'Nuevo albarán',  icon: <PlusCircle size={18} />,      active: location.pathname === '/nuevo',          onClick: irA('/nuevo') },
    { key: 'historial',      label: 'Historial',      icon: <Clock size={18} />,           active: location.pathname === '/historial',      onClick: irA('/historial') },
    { key: 'estadisticas',   label: 'Estadísticas',   icon: <BarChart2 size={18} />,       active: location.pathname === '/estadisticas',   onClick: irA('/estadisticas') },
    { key: 'administracion', label: 'Administración', icon: <Settings size={18} />,        active: location.pathname === '/administracion', onClick: irA('/administracion') },
    ...(esSuperadmin ? [
      { key: 'usuarios', label: 'Usuarios', icon: <Users size={18} />, active: location.pathname === '/usuarios', onClick: irA('/usuarios') },
    ] : []),
    ...(usuario?.acceso_biomasa !== false && usuario?.acceso_trabajo ? [
      { key: 'apps', label: 'Cambiar de aplicación', icon: <LayoutGrid size={18} />, onClick: () => navigate('/apps') },
    ] : []),
    { key: 'perfil', label: usuario?.nombre || 'Perfil', isAvatar: true, initials: iniciales, onClick: () => setPerfilOpen(true) },
  ]

  return (
    <div className="layout">
      <main className="main-area"><Outlet /></main>

      <Dock items={dockItems} />

      {perfilOpen && (
        <div
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:20}}
          onClick={() => { setPerfilOpen(false); setConfirmLogout(false) }}
        >
          <div style={{background:'#fff',borderRadius:'var(--radius-xl)',width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.15)',overflow:'hidden'}} onClick={e => e.stopPropagation()}>
            <div style={{background:'var(--gray-900)',padding:'24px 24px 20px',position:'relative'}}>
              <button onClick={() => setPerfilOpen(false)} style={{position:'absolute',top:16,right:16,background:'none',border:'none',cursor:'pointer',color:'var(--gray-400)',display:'flex',alignItems:'center'}}>
                <X size={16} />
              </button>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'var(--green-400)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:600,color:'#fff',flexShrink:0}}>
                  {iniciales}
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:600,color:'#fff'}}>{usuario?.nombre}</div>
                  <div style={{fontSize:12,color:'var(--gray-400)',marginTop:3}}>{usuario?.rol}</div>
                  {esSuperadmin && <span style={{fontSize:10,background:'#fef3c7',color:'#92400e',padding:'1px 6px',borderRadius:20,fontWeight:600,marginTop:4,display:'inline-block'}}>★ Superadmin</span>}
                </div>
              </div>
            </div>

            <div style={{padding:'20px 24px'}}>
              <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--gray-400)',marginBottom:12}}>Información de cuenta</div>
              {[
                { icon: <Mail size={14} />,      label: 'Email',   value: usuario?.email },
                { icon: <Briefcase size={14} />, label: 'Rol',     value: usuario?.rol },
                { icon: <Shield size={14} />,    label: 'Acceso',  value: esSuperadmin ? 'Superadministrador' : 'Usuario estándar' },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'var(--border-light)'}}>
                  <div style={{color:'var(--gray-400)',marginTop:1,flexShrink:0}}>{icon}</div>
                  <div>
                    <div style={{fontSize:11,color:'var(--gray-400)',marginBottom:2}}>{label}</div>
                    <div style={{fontSize:13,color:'var(--gray-800)',fontWeight:500}}>{value || '—'}</div>
                  </div>
                </div>
              ))}

              {/* ── Notificaciones ── */}
              <div style={{marginTop:16,paddingTop:16,borderTop:'var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
                  <Bell size={13} style={{color:'var(--gray-400)'}} />
                  <span style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',color:'var(--gray-400)'}}>Notificaciones</span>
                </div>
                {/* Toggle silenciar maestro */}
                <div
                  onClick={() => setNotifPrefs(p => ({ ...p, silenciado: !p.silenciado }))}
                  style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',marginBottom:8,background:silenciadoPropio?'var(--gray-50)':'#ecfdf5',borderRadius:'var(--radius-md)',border:silenciadoPropio?'var(--border)':'1px solid #bbf7d0',cursor:'pointer',userSelect:'none'}}
                >
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <BellOff size={13} style={{color:silenciadoPropio?'var(--gray-400)':'var(--green-600)'}} />
                    <span style={{fontSize:12,fontWeight:600,color:silenciadoPropio?'var(--gray-600)':'var(--green-700)'}}>
                      {silenciadoPropio ? 'Silenciado' : 'Notificaciones activas'}
                    </span>
                  </div>
                  <div style={{width:34,height:19,background:silenciadoPropio?'var(--gray-200)':'var(--green-400)',borderRadius:10,position:'relative',transition:'background 0.2s',flexShrink:0}}>
                    <div style={{position:'absolute',top:2,left:silenciadoPropio?2:15,width:15,height:15,background:'#fff',borderRadius:'50%',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
                  </div>
                </div>
                {/* Tipos individuales */}
                <div style={{display:'flex',flexDirection:'column',gap:1,opacity:silenciadoPropio?0.45:1,transition:'opacity 0.2s'}}>
                  {NOTIFS.map(({ key, color, label }) => (
                    <div
                      key={key}
                      onClick={() => setNotifPrefs(p => ({ ...p, [key]: !getN(p, key) }))}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'7px 6px',borderRadius:'var(--radius-sm)',cursor:'pointer',transition:'background 0.12s',userSelect:'none'}}
                      onMouseEnter={e => e.currentTarget.style.background='var(--gray-50)'}
                      onMouseLeave={e => e.currentTarget.style.background=''}
                    >
                      <span style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}} />
                      <span style={{flex:1,fontSize:12,color:'var(--gray-700)'}}>{label}</span>
                      <div style={{width:34,height:19,background:getN(notifPrefs,key)?'var(--green-400)':'var(--gray-200)',borderRadius:10,position:'relative',transition:'background 0.2s',flexShrink:0}}>
                        <div style={{position:'absolute',top:2,left:getN(notifPrefs,key)?15:2,width:15,height:15,background:'#fff',borderRadius:'50%',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
                      </div>
                    </div>
                  ))}
                </div>
                {(notifDirty || notifOk) && (
                  <div style={{marginTop:10,display:'flex',justifyContent:'flex-end'}}>
                    {notifOk ? (
                      <span style={{fontSize:12,color:'var(--green-600)',fontWeight:500}}>✓ Guardado</span>
                    ) : (
                      <button onClick={handleGuardarNotif} disabled={notifGuardando} className="btn btn-primary" style={{padding:'5px 12px',fontSize:12}}>
                        {notifGuardando ? 'Guardando...' : 'Guardar'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{marginTop:16,paddingTop:16,borderTop:'var(--border)'}}>
                {!confirmLogout ? (
                  <button onClick={() => setConfirmLogout(true)} style={{width:'100%',padding:'10px',borderRadius:'var(--radius-md)',border:'1px solid var(--red-100)',background:'var(--red-50)',color:'var(--red-700)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                ) : (
                  <div style={{background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:'var(--radius-md)',padding:'14px'}}>
                    <div style={{fontSize:13,color:'var(--red-700)',fontWeight:500,marginBottom:10,textAlign:'center'}}>¿Seguro que quieres cerrar sesión?</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={() => setConfirmLogout(false)} style={{flex:1,padding:'8px',borderRadius:'var(--radius-sm)',border:'var(--border)',background:'#fff',fontSize:13,cursor:'pointer'}}>Cancelar</button>
                      <button onClick={handleLogout} style={{flex:1,padding:'8px',borderRadius:'var(--radius-sm)',border:'none',background:'var(--red-400)',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer'}}>Sí, cerrar sesión</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

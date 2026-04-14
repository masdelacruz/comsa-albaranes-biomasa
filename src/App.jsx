import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NuevoAlbaran from './pages/NuevoAlbaran'
import DetalleAlbaran from './pages/DetalleAlbaran'
import VistaCampo from './pages/VistaCampo'
import Historial from './pages/Historial'
import Estadisticas from './pages/Estadisticas'
import Administracion from './pages/Administracion'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'
import { useAlbaranes } from './hooks/useAlbaranes'
import { useAlbaranActions } from './hooks/useAlbaranActions'
import { useAuth } from './hooks/useAuth'

const Spinner = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',flexDirection:'column',gap:12}}>
    <div style={{width:32,height:32,border:'3px solid #e0deda',borderTop:'3px solid #1D9E75',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
)

const Bloqueado = () => (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',flexDirection:'column',gap:16,padding:20,background:'#f8f8f6'}}>
    <div style={{width:56,height:56,borderRadius:'50%',background:'#fde8e8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🔒</div>
    <div style={{fontSize:18,fontWeight:600,color:'#1a1917'}}>Acceso desactivado</div>
    <div style={{fontSize:13,color:'#9e9b94',textAlign:'center',maxWidth:320}}>
      Tu cuenta ha sido desactivada. Contacta con Marc Serrano para recuperar el acceso.
    </div>
  </div>
)

function VistaCampoPublica() {
  const { albaranes, loading } = useAlbaranes()
  const { updateFirma, subirTicketPesada } = useAlbaranActions(() => {}, null)
  if (loading) return <Spinner />
  return <VistaCampo albaranes={albaranes} updateFirma={updateFirma} subirTicketPesada={subirTicketPesada} />
}

function AppConDatos({ usuario, logout }) {
  const { albaranes, loading: dataLoading, refetch } = useAlbaranes()
  const { addAlbaran, updateFirma, simularFirmaOficina, subirDocumento, subirTicketPesada, actualizarAlbaran } = useAlbaranActions(refetch, usuario)

  if (dataLoading) return <Spinner />

  return (
    <Routes>
      <Route path="/" element={<Layout usuario={usuario} logout={logout} />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<Dashboard albaranes={albaranes} usuario={usuario} />} />
        <Route path="nuevo"          element={<NuevoAlbaran addAlbaran={addAlbaran} usuario={usuario} />} />
        <Route path="albaran/:id"    element={<DetalleAlbaran albaranes={albaranes} simularFirma={simularFirmaOficina} subirDocumento={subirDocumento} subirTicketPesada={subirTicketPesada} actualizarAlbaran={actualizarAlbaran} usuario={usuario} />} />
        <Route path="historial"      element={<Historial albaranes={albaranes} />} />
        <Route path="estadisticas"   element={<Estadisticas albaranes={albaranes} />} />
        <Route path="administracion" element={<Administracion usuario={usuario} />} />
        <Route path="usuarios"       element={<Usuarios usuario={usuario} />} />
      </Route>
    </Routes>
  )
} 

function AppInner() {
  const { session, usuario, loading: authLoading, bloqueado, verificado, logout } = useAuth()

  if (!verificado || authLoading) return <Spinner />
  if (bloqueado) return <Bloqueado />
  if (!session) return <Login />

  return <AppConDatos usuario={usuario} logout={logout} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/campo/:id" element={<VistaCampoPublica />} />
        <Route path="/campo/:id/:roles" element={<VistaCampoPublica />} />
        <Route path="/*" element={<AppInner />} />
      </Routes>
    </BrowserRouter>
  )
}
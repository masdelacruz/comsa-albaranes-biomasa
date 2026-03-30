import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NuevoAlbaran from './pages/NuevoAlbaran'
import DetalleAlbaran from './pages/DetalleAlbaran'
import VistaCampo from './pages/VistaCampo'
import Historial from './pages/Historial'
import Estadisticas from './pages/Estadisticas'
import Administracion from './pages/Administracion'
import { useAlbaranes } from './hooks/useAlbaranes'
import { useAlbaranActions } from './hooks/useAlbaranActions'

function AppInner() {
  const { albaranes, loading, refetch } = useAlbaranes()
  const { addAlbaran, updateFirma, simularFirmaOficina, subirDocumento, subirTicketPesada } = useAlbaranActions(refetch)

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',flexDirection:'column',gap:12}}>
      <div style={{width:32,height:32,border:'3px solid #e0deda',borderTop:'3px solid #1D9E75',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <span style={{fontSize:13,color:'#9e9b94'}}>Cargando albaranes...</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <Routes>
      <Route path="/campo/:id" element={<VistaCampo albaranes={albaranes} updateFirma={updateFirma} subirTicketPesada={subirTicketPesada} />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"      element={<Dashboard    albaranes={albaranes} />} />
        <Route path="nuevo"          element={<NuevoAlbaran addAlbaran={addAlbaran} />} />
        <Route path="albaran/:id"    element={<DetalleAlbaran albaranes={albaranes} simularFirma={simularFirmaOficina} subirDocumento={subirDocumento} />} />
        <Route path="historial"      element={<Historial    albaranes={albaranes} />} />
        <Route path="estadisticas"   element={<Estadisticas albaranes={albaranes} />} />
        <Route path="administracion" element={<Administracion />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <BrowserRouter><AppInner /></BrowserRouter>
}
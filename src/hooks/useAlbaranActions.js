import { api } from '../lib/api'
import { notificarNuevoAlbaran } from '../utils/notificaciones'

export function useAlbaranActions(refetch, usuario) {

  const addAlbaran = async (form, enviarACampo = false) => {
    const { id } = await api.post('/albaranes', {
      ...form,
      enviarACampo,
      actorNombre: usuario?.nombre || 'Oficina',
    })
    notificarNuevoAlbaran({ id, ...form })
    await refetch()
    return id
  }

  const enviarACampoAlbaran = async (ids) => {
    const arr = Array.isArray(ids) ? ids : [ids]
    await api.post('/albaranes/enviar-a-campo', { ids: arr, actorNombre: usuario?.nombre || 'Oficina' })
    await refetch()
  }

  const updateFirma = async (albaranId, rol, actor, nombrePersona = null, pesadaData = null, firmaImagen = null, campoData = null, observacionesFirma = null, telefonoPersona = null) => {
    const { albaran, cerrado, humedadPendiente } = await api.post(
      `/albaranes/${albaranId}/firmas/${rol}`,
      { actor, nombrePersona, telefonoPersona, firmaImagen, pesadaData, campoData, observacionesFirma }
    )
    // Las notificaciones de firma/cierre/humedad las envía el backend directamente
    await refetch()
  }

  const simularFirmaOficina = async (albaranId, rol) => {
    await updateFirma(albaranId, rol, usuario?.nombre || 'Oficina', null)
  }

  const subirDocumento = async (albaranId, docNombre, fichero) => {
    const fd = new FormData()
    fd.append('file', fichero)
    fd.append('docNombre', docNombre)
    await api.upload(`/storage/upload/${albaranId}/doc`, fd)
    await refetch()
  }

  const subirTicketPesada = async (albaranId, fichero, actorExterno = null) => {
    const fd = new FormData()
    fd.append('file', fichero)
    if (actorExterno) fd.append('actor', actorExterno)
    await api.upload(`/storage/upload/${albaranId}/ticket`, fd)
    await refetch()
  }

  const actualizarAlbaran = async (albaranId, campos, pesadaCampos = null, descripcion = 'Datos editados manualmente') => {
    await api.patch(`/albaranes/${albaranId}`, { campos, pesadaCampos, descripcion })
    await refetch()
  }

  const borrarAlbaran = async (albaranId) => {
    await api.delete(`/albaranes/${albaranId}`)
    await refetch()
  }

  const reabrirAlbaran = async (albaranId) => {
    await api.post(`/albaranes/${albaranId}/reabrir`, {})
    await refetch()
  }

  return { addAlbaran, enviarACampoAlbaran, updateFirma, simularFirmaOficina, subirDocumento, subirTicketPesada, actualizarAlbaran, borrarAlbaran, reabrirAlbaran }
}

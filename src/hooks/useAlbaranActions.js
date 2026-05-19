import { api } from '../lib/api'
import { notificarNuevoAlbaran, notificarFirmaCompletada, notificarAlbaranCerrado } from '../utils/notificaciones'

export function useAlbaranActions(refetch, usuario) {

  const addAlbaran = async (form) => {
    const { id } = await api.post('/albaranes', {
      ...form,
      actorNombre: usuario?.nombre || 'Oficina',
    })
    await notificarNuevoAlbaran({ id, ...form })
    await refetch()
    return id
  }

  const updateFirma = async (albaranId, rol, actor, nombrePersona = null, pesadaData = null, firmaImagen = null, campoData = null, observacionesFirma = null) => {
    const { albaran, cerrado } = await api.post(
      `/albaranes/${albaranId}/firmas/${rol}`,
      { actor, nombrePersona, firmaImagen, pesadaData, campoData, observacionesFirma }
    )
    if (!cerrado) await notificarFirmaCompletada({ ...albaran, id: albaranId }, actor, rol)
    if (cerrado)  await notificarAlbaranCerrado({ ...albaran, id: albaranId })
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

  return { addAlbaran, updateFirma, simularFirmaOficina, subirDocumento, subirTicketPesada, actualizarAlbaran, borrarAlbaran, reabrirAlbaran }
}

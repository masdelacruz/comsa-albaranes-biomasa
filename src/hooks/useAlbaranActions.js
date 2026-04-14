import { supabase } from '../supabase'
import { notificarNuevoAlbaran, notificarFirmaCompletada, notificarAlbaranCerrado } from '../utils/notificaciones'

const ROL_LABEL = {
  oficina:       'Oficina',
  astilladora:   'Astilladora',
  transportista: 'Transportista',
  instalacion:   'Instalación',
  proveedor:     'Proveedor',
}

const ROLES_FIRMA = ['oficina', 'astilladora', 'transportista', 'instalacion']

async function generarId() {
  const { data } = await supabase.rpc('next_albaran_id')
  return `${data}`
}

function limpiarNombre(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function useAlbaranActions(refetch, usuario) {

  const addAlbaran = async (form) => {
    const id = await generarId()
    const fecha = new Date().toLocaleString('es-ES')
    const esOp1 = form.tipo.includes('1')
    const actorNombre = usuario?.nombre || 'Oficina'
    const docs = esOp1
      ? ['Autodeclaración', 'Acuerdo de cesión', 'Contrato prestación servicios', 'Permiso de corta']
      : ['Certificado SURE', 'Permiso de obra', 'Contrato prestación servicios']

    await supabase.from('albaranes').insert({
      id, fecha: form.fecha, hora: form.hora, num_camiones: form.numCamiones,
      tipo: form.tipo, proveedor: form.proveedor, astilladora: form.astilladora,
      transportista: form.transportista, instalacion: form.instalacion,
      especie: form.especie, tipo_biomasa: form.tipoBiomasa,
      origen: form.origen, permiso: form.permiso, observaciones: form.observaciones,
      estado: 'pendiente_campo', maps_origen: form.mapsOrigen, maps_destino: form.mapsDestino,
      matricula_tractora: form.matriculaTractora, matricula_remolque: form.matriculaRemolque,
      chofer: form.chofer, certificacion: form.certificacion,
    })

    const firmasBase = [
      { albaran_id: id, rol: 'oficina', actor: actorNombre, firmado: true, fecha },
    ]
    if (esOp1 && form.astilladora) {
      firmasBase.push({ albaran_id: id, rol: 'astilladora', actor: form.astilladora, firmado: false, fecha: null })
    }
    if (esOp1 && form.transportista) {
      firmasBase.push({ albaran_id: id, rol: 'transportista', actor: form.transportista, firmado: false, fecha: null })
    }
    firmasBase.push({ albaran_id: id, rol: 'instalacion', actor: form.instalacion, firmado: false, fecha: null })

    await supabase.from('firmas').insert(firmasBase)
    await supabase.from('pesada').insert({ albaran_id: id })
    await supabase.from('docs').insert(docs.map(d => ({ albaran_id: id, nombre: d, adjunto: false })))
    await supabase.from('actividad').insert([
      { albaran_id: id, ts: fecha, texto: 'Albarán creado', actor: actorNombre },
      { albaran_id: id, ts: fecha, texto: 'Enlace generado para campo', actor: 'Sistema' },
    ])

    await notificarNuevoAlbaran(
      { id, fecha: form.fecha, astilladora: form.astilladora, instalacion: form.instalacion, especie: form.especie, origen: form.origen, observaciones: form.observaciones },
      'mserranodelacruzfernandez@gmail.com', 'Marc Serrano'
    )
    await refetch()
    return id
  }

  const updateFirma = async (albaranId, rol, actor, pesadaData = null, firmaImagen = null, campoData = null) => {
    const fecha = new Date().toLocaleString('es-ES')
    await supabase.from('firmas')
      .update({ firmado: true, fecha, actor, firma_imagen: firmaImagen })
      .eq('albaran_id', albaranId).eq('rol', rol)
    await supabase.from('actividad').insert({
      albaran_id: albaranId, ts: fecha,
      texto: `${ROL_LABEL[rol] || rol} confirmó y firmó`, actor,
    })
    if (pesadaData) {
      await supabase.from('pesada')
        .update({
          entrada: pesadaData.entrada || null,
          salida:  pesadaData.salida  || null,
          humedad: pesadaData.humedad || null,
        })
        .eq('albaran_id', albaranId)
    }
    if (campoData) {
      const update = {}
      if (campoData.matriculaTractora !== undefined) update.matricula_tractora = campoData.matriculaTractora || null
      if (campoData.matriculaRemolque !== undefined) update.matricula_remolque = campoData.matriculaRemolque || null
      if (campoData.chofer            !== undefined) update.chofer             = campoData.chofer            || null
      if (campoData.origen            !== undefined) update.origen             = campoData.origen            || null
      if (Object.keys(update).length > 0) {
        await supabase.from('albaranes').update(update).eq('id', albaranId)
      }
    }

    const { data: firmas } = await supabase.from('firmas').select('*').eq('albaran_id', albaranId)
    const firmasRelevantes = firmas?.filter(f => ROLES_FIRMA.includes(f.rol))
    const todasFirmadas    = firmasRelevantes?.every(f => f.firmado)
    const { data: albaranData } = await supabase.from('albaranes').select('*').eq('id', albaranId).single()
    await notificarFirmaCompletada({ ...albaranData, id: albaranId }, actor)
    if (todasFirmadas) {
      await supabase.from('albaranes').update({ estado: 'cerrado' }).eq('id', albaranId)
      await supabase.from('actividad').insert({ albaran_id: albaranId, ts: fecha, texto: 'Albarán cerrado automáticamente', actor: 'Sistema' })
      const { data: pesadaFinal } = await supabase.from('pesada').select('*').eq('albaran_id', albaranId).single()
      await notificarAlbaranCerrado({ ...albaranData, id: albaranId, pesada: pesadaFinal })
    }
    await refetch()
  }

  const simularFirmaOficina = async (albaranId, rol) => {
    await updateFirma(albaranId, rol, usuario?.nombre || 'Oficina')
  }

  const subirDocumento = async (albaranId, docNombre, fichero) => {
    const ext = fichero.name.split('.').pop()
    const path = `${albaranId}/${limpiarNombre(docNombre)}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documentos').upload(path, fichero, { cacheControl: '3600', upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
    const publicUrl = urlData?.publicUrl
    await supabase.from('docs').update({ adjunto: true, url: publicUrl, nombre_fichero: fichero.name, tipo_fichero: fichero.type, tamanyo: fichero.size })
      .eq('albaran_id', albaranId).eq('nombre', docNombre)
    await supabase.from('actividad').insert({
      albaran_id: albaranId, ts: new Date().toLocaleString('es-ES'),
      texto: `Documento adjuntado: ${docNombre}`, actor: usuario?.nombre || 'Oficina',
    })
    await refetch()
  }

const subirTicketPesada = async (albaranId, fichero, actorexterno = null) => {
  const ext = fichero.name.split('.').pop()
  const path = `${albaranId}/ticket_pesada_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('documentos').upload(path, fichero, { cacheControl: '3600', upsert: true })
  if (error) throw error
  const { data: urlData2 } = supabase.storage.from('documentos').getPublicUrl(path)
  const publicUrl = urlData2?.publicUrl
  await supabase.from('pesada').update({ ticket_adjunto: true, ticket_url: publicUrl }).eq('albaran_id', albaranId)
  await supabase.from('actividad').insert({
    albaran_id: albaranId, ts: new Date().toLocaleString('es-ES'),
    texto: 'Ticket de pesada adjuntado',
    actor: actorexterno || usuario?.nombre || 'Sistema',
  })
  await refetch()
}

  const actualizarAlbaran = async (albaranId, campos, pesadaCampos = null, descripcion = 'Datos editados manualmente') => {
    const fecha = new Date().toLocaleString('es-ES')
    if (campos && Object.keys(campos).length > 0) {
      await supabase.from('albaranes').update(campos).eq('id', albaranId)
    }
    if (pesadaCampos && Object.keys(pesadaCampos).length > 0) {
      await supabase.from('pesada').update(pesadaCampos).eq('albaran_id', albaranId)
    }
    await supabase.from('actividad').insert({
      albaran_id: albaranId, ts: fecha,
      texto: descripcion, actor: usuario?.nombre || 'Oficina',
    })
    await refetch()
  }

  return { addAlbaran, updateFirma, simularFirmaOficina, subirDocumento, subirTicketPesada, actualizarAlbaran }
}
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DOCS_OP1 = ['Autodeclaración', 'Acuerdo de cesión', 'Contrato prestación servicios', 'Permiso de corta']
const DOCS_OP2 = ['Certificado SURE', 'Permiso de obra', 'Contrato prestación servicios']
const ORDEN_FIRMAS = ['oficina', 'proveedor', 'astilladora', 'camionero', 'instalacion']

export function useAlbaranes() {
  const [albaranes, setAlbaranes] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAlbaranes = async () => {
    const { data: albs } = await supabase.from('albaranes').select('*').order('created_at', { ascending: false })
    if (!albs) return

    const ids = albs.map(a => a.id)
    const [{ data: firmas }, { data: pesadas }, { data: docs }, { data: actividad }] = await Promise.all([
      supabase.from('firmas').select('*').in('albaran_id', ids),
      supabase.from('pesada').select('*').in('albaran_id', ids),
      supabase.from('docs').select('*').in('albaran_id', ids),
      supabase.from('actividad').select('*').in('albaran_id', ids).order('created_at', { ascending: true }),
    ])

    const mapped = albs.map(a => {
      const aFirmas = (firmas || []).filter(f => f.albaran_id === a.id)
      const firmasMap = {}
      aFirmas.forEach(f => {
        firmasMap[f.rol] = {
          firmado: f.firmado, fecha: f.fecha, actor: f.actor, firmaImagen: f.firma_imagen || null,
        }
      })
      const firmasObj = {}
      ORDEN_FIRMAS.forEach(rol => { if (firmasMap[rol]) firmasObj[rol] = firmasMap[rol] })

      const pesada = (pesadas || []).find(p => p.albaran_id === a.id) || {}

      const aDoc = (docs || []).filter(d => d.albaran_id === a.id)
      const docsMap = {}
      aDoc.forEach(d => {
        docsMap[d.nombre] = {
          adjunto: d.adjunto || false, url: d.url || null,
          nombreFichero: d.nombre_fichero || null, tipoFichero: d.tipo_fichero || null, tamanyo: d.tamanyo || null,
        }
      })
      const ordenDocs = a.tipo?.includes('2') ? DOCS_OP2 : DOCS_OP1
      const docsObj = {}
      ordenDocs.forEach(nombre => { if (docsMap[nombre]) docsObj[nombre] = docsMap[nombre] })
      Object.keys(docsMap).forEach(nombre => { if (!docsObj[nombre]) docsObj[nombre] = docsMap[nombre] })

      return {
        id: a.id, fecha: a.fecha, hora: a.hora, numCamiones: a.num_camiones,
        tipo: a.tipo, proveedor: a.proveedor, astilladora: a.astilladora,
        transportista: a.transportista, instalacion: a.instalacion,
        especie: a.especie, tipoBiomasa: a.tipo_biomasa,
        origen: a.origen, permiso: a.permiso, observaciones: a.observaciones,
        estado: a.estado, certificacion: a.certificacion || 'PEFC', mapsOrigen: a.maps_origen,
        matriculaTractora: a.matricula_tractora, matriculaRemolque: a.matricula_remolque,
        chofer: a.chofer,
        firmas: firmasObj,
        pesada: {
          entrada: pesada.entrada || null, salida: pesada.salida || null,
          humedad: pesada.humedad || null, ticketAdjunto: pesada.ticket_adjunto || false,
          ticketUrl: pesada.ticket_url || null,
        },
        docs: docsObj,
        actividad: (actividad || []).filter(ev => ev.albaran_id === a.id).map(ev => ({
          ts: ev.ts, texto: ev.texto, actor: ev.actor,
        })),
      }
    })

    setAlbaranes(mapped)
    setLoading(false)
  }

  useEffect(() => {
    fetchAlbaranes()
    const channel = supabase
      .channel('albaranes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchAlbaranes())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  return { albaranes, loading, refetch: fetchAlbaranes }
}
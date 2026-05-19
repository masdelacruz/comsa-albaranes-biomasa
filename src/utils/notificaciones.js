import { api } from '../lib/api'

const DEST = 'mserranodelacruzfernandez@gmail.com'

export async function notificarNuevoAlbaran(albaran) {
  try {
    await api.post('/email', { tipo: 'nuevo_albaran', albaran, destinatario: DEST })
  } catch (e) { console.error('Email error:', e) }
}

const ROL_LABELS = {
  proveedor:     'Proveedor — Origen',
  astilladora:   'Astilladora',
  transportista: 'Transportista',
  instalacion:   'Receptor — Instalación destino',
  oficina:       'Oficina',
}

export async function notificarFirmaCompletada(albaran, firmante, rol) {
  try {
    await api.post('/email', {
      tipo: 'firma_completada',
      albaran: { ...albaran, firmante, rolLabel: ROL_LABELS[rol] || rol },
      destinatario: DEST,
    })
  } catch (e) { console.error('Email error:', e) }
}

export async function notificarAlbaranCerrado(albaran) {
  try {
    const pesoNeto = albaran.pesada?.entrada && albaran.pesada?.salida
      ? ((albaran.pesada.entrada - albaran.pesada.salida) / 1000).toFixed(1) + ' t'
      : null
    await api.post('/email', {
      tipo: 'albaran_cerrado',
      albaran: { ...albaran, pesoNeto, humedad: albaran.pesada?.humedad },
      destinatario: DEST,
    })
  } catch (e) { console.error('Email error:', e) }
}

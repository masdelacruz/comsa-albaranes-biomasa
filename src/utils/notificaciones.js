import { api } from '../lib/api'

// El backend consulta la tabla usuarios para determinar los destinatarios
// según sus preferencias de notificación — no se especifica destinatario aquí.

export async function notificarNuevoAlbaran(albaran) {
  try { await api.post('/email', { tipo: 'nuevo_albaran', albaran }) }
  catch (e) { console.error('Email error:', e) }
}

export async function notificarFirmaCompletada(albaran, firmante, rol) {
  const ROL_LABELS = {
    proveedor: 'Proveedor', astilladora: 'Astilladora',
    transportista: 'Transportista', instalacion: 'Instalación', oficina: 'Oficina',
  }
  try {
    await api.post('/email', {
      tipo: 'firma_completada',
      albaran: { ...albaran, firmante, rolLabel: ROL_LABELS[rol] || rol },
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
    })
  } catch (e) { console.error('Email error:', e) }
}

export async function notificarHumedadPendiente(albaran) {
  try { await api.post('/email', { tipo: 'humedad_pendiente', albaran }) }
  catch (e) { console.error('Email error:', e) }
}

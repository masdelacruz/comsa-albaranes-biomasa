import { api } from '../lib/api'

// Notificaciones de firma/cierre/humedad se envían desde el backend
// al procesar cada firma. Solo nuevo_albaran se dispara desde aquí
// porque el usuario de oficina que lo crea siempre está autenticado.

export async function notificarNuevoAlbaran(albaran) {
  try { await api.post('/email', { tipo: 'nuevo_albaran', albaran }) }
  catch (e) { console.error('Email error:', e) }
}

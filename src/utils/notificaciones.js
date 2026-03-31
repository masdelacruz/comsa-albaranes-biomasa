import { supabase } from '../supabase'

const FUNCTION_URL = 'https://edxlcvqrddnvwzuxfjni.supabase.co/functions/v1/enviar-email'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkeGxjdnFyZGRudnd6dXhmam5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTAyNTcsImV4cCI6MjA5MDM4NjI1N30.-ZN5zHsZ0Ood-zJC3Tm8i2fk7aPGaXhCxZsbC0mfJ30'

const EMAIL_PRUEBA = 'marc.serrano@comsa.com'

async function enviarEmail(tipo, albaran, destinatario, nombreDestinatario) {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ tipo, albaran, destinatario, nombreDestinatario }),
    })
    const data = await res.json()
    console.log('Email response:', res.status, data)
  } catch (err) {
    console.error('Error enviando email:', err)
  }
}

export async function notificarNuevoAlbaran(albaran, destinatario, nombreDestinatario) {
  const campoUrl = `${window.location.origin}/campo/${albaran.id}`
  await enviarEmail('nuevo_albaran', { ...albaran, campoUrl }, EMAIL_PRUEBA, nombreDestinatario)
}

export async function notificarFirmaCompletada(albaran, firmante) {
  const campoUrl = `${window.location.href}`
  await enviarEmail('firma_completada', { ...albaran, campoUrl }, EMAIL_PRUEBA, firmante)
}

export async function notificarAlbaranCerrado(albaran) {
  const campoUrl = `${window.location.origin}/albaran/${albaran.id}`
  const pesoNeto = albaran.pesada?.entrada && albaran.pesada?.salida
    ? ((albaran.pesada.entrada - albaran.pesada.salida) / 1000).toFixed(1) + ' t' : null
  await enviarEmail('albaran_cerrado', {
    ...albaran, campoUrl, pesoNeto, humedad: albaran.pesada?.humedad,
  }, EMAIL_PRUEBA, 'Marc Serrano')
}
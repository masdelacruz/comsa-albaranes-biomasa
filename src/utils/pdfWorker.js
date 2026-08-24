import { dibujarAlbaranPDF } from './pdfDraw'

// Worker dedicado a dibujar el PDF del albarán. jsPDF/autoTable son síncronos
// y bloquean el hilo donde corren — aquí corren en SU PROPIO hilo, así que el
// hilo principal de la página (y su animación de "Generando PDF...") queda
// libre durante toda la generación en vez de congelarse.
self.onmessage = async (e) => {
  const { id, a, options, logos } = e.data
  try {
    const { buffer, nombre } = await dibujarAlbaranPDF(a, options, logos)
    self.postMessage({ id, ok: true, buffer, nombre }, [buffer])
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || 'Error generando el PDF' })
  }
}

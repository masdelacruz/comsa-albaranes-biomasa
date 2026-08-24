// Helpers puros (sin DOM, sin localStorage) — seguros tanto en el hilo
// principal como dentro de un Web Worker. Compartidos entre generarPDF.js
// (A5, que sigue en el hilo principal) y pdfDraw.js (el que corre en el
// worker para el PDF A4 normal).

export const toBase64 = (url) =>
  fetch(url)
    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob() })
    .then(b => new Promise(res => {
      const reader = new FileReader()
      reader.onloadend = () => res(reader.result)
      reader.readAsDataURL(b)
    }))

export const fmt = (b64) => {
  if (!b64) return 'PNG'
  if (b64.startsWith('data:image/jpeg') || b64.startsWith('data:image/jpg')) return 'JPEG'
  if (b64.startsWith('data:image/webp')) return 'WEBP'
  return 'PNG'
}

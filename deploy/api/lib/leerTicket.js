// Lectura automática del ticket de pesada (báscula de la instalación).
//
// Solo PDFs con capa de texto (los que genera el software de la báscula,
// p. ej. Termosolar Borges). Una foto o un PDF escaneado no tiene texto y
// devuelve null: el usuario rellena a mano como siempre.
//
// Se usa la posición de cada texto en la página, no el orden en que aparece:
// en el ticket de Borges las etiquetas "Bruto/Tara/Neto" y sus cifras salen
// como bloques separados, así que se busca la cifra a la derecha de la
// etiqueta y en la misma línea.
//
// Seguridad: el PDF ya ha pasado el filtro de extensión + firma de contenido
// (sniffMime). pdf.js se ejecuta sin evaluar JavaScript del documento
// (isEvalSupported:false), sin fuentes del sistema ni peticiones externas,
// con límite de páginas y de tiempo. Cualquier error → null, la subida sigue.

const MAX_PAGINAS = 2
const TIMEOUT_MS  = 8000

let pdfjsPromise = null
function cargarPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsPromise
}

async function extraerItems(buffer) {
  const pdfjs = await cargarPdfjs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: false,
    verbosity: 0,
  }).promise
  try {
    const items = []
    const n = Math.min(doc.numPages, MAX_PAGINAS)
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      for (const it of content.items) {
        const str = (it.str || '').trim()
        if (!str) continue
        items.push({ str, x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 10, p })
      }
    }
    return items
  } finally {
    await doc.destroy().catch(() => {})
  }
}

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Cifra entera en kg: "47120", "47.120", "47 120" → 47120
function aKg(str) {
  const limpio = str.replace(/kg\.?/i, '').replace(/[.\s]/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(limpio)) return null
  const n = Math.round(Number(limpio))
  return Number.isFinite(n) && n > 0 && n < 200000 ? n : null
}

// Valor a la derecha de la etiqueta y en la misma línea (el más cercano).
// Si la etiqueta y el valor vienen en el mismo trozo ("Bruto: 47120"), se
// toma de ahí.
function valorJunto(items, etiquetas, esValido) {
  for (const etq of etiquetas) {
    const rx = new RegExp(`^${etq}\\s*[:.]?\\s*(.*)$`, 'i')
    for (const lab of items) {
      const m = norm(lab.str).match(rx)
      if (!m) continue
      if (m[1]) {
        const v = esValido(m[1])
        if (v != null) return v
      }
      const finEtq = lab.x + lab.w
      const tol = Math.max(lab.h, 8) * 0.6
      const candidatos = items
        .filter(it => it !== lab && it.p === lab.p && Math.abs(it.y - lab.y) <= tol && it.x >= finEtq - 2)
        .sort((a, b) => a.x - b.x)
      for (const c of candidatos) {
        const v = esValido(c.str)
        if (v != null) return v
        // Una etiqueta distinta en medio corta la búsqueda ("Fecha2:" etc.)
        if (/:\s*$/.test(c.str)) break
      }
    }
  }
  return null
}

const numTicket = s => {
  const t = s.trim()
  return /^[A-Za-z0-9-/]{1,20}$/.test(t) && /\d/.test(t) ? t : null
}

async function leerTicketPesada(buffer, ext) {
  if (ext !== 'pdf') return null
  try {
    const items = await Promise.race([
      extraerItems(buffer),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
    ])
    if (!items.length) return null

    const numeroPesada = valorJunto(items, ['n\\.? ?tiquet', 'n\\.? ?ticket', 'n[ºo°]\\.? ?tiquet', 'n[ºo°]\\.? ?ticket', 'tiquet', 'ticket'], numTicket)
    let bruto = valorJunto(items, ['bruto', 'peso bruto', 'brut'], aKg)
    let tara  = valorJunto(items, ['tara', 'peso tara'], aKg)
    let neto  = valorJunto(items, ['neto', 'peso neto', 'net'], aKg)

    // Coherencia: bruto − tara = neto. Si falta uno se deduce; si los tres
    // no cuadran se descarta la tara (lo que la oficina usa es bruto y neto).
    if (bruto != null && neto != null) {
      if (tara == null || bruto - tara !== neto) tara = bruto - neto
    } else if (bruto != null && tara != null) {
      neto = bruto - tara
    } else if (neto != null && tara != null) {
      bruto = neto + tara
    }
    if (bruto != null && tara != null && (tara < 0 || tara > bruto)) { tara = null; neto = null }

    if (numeroPesada == null && bruto == null && neto == null) return null
    return { numeroPesada, bruto, tara, neto }
  } catch {
    return null
  }
}

module.exports = { leerTicketPesada }

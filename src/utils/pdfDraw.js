import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toBase64, fmt } from './pdfHelpers'

// Dibuja el albarán A4 y devuelve el PDF como ArrayBuffer (sin llamar a
// doc.save()/doc.output('bloburl'), que dependen del DOM: el Blob/URL se
// crea en el llamador, que sí tiene acceso al documento). Recibe los logos
// ya cargados (no hace fetch de /storage/logos ni toca localStorage), así
// que esta función es segura para ejecutarse dentro de un Web Worker — ver
// pdfWorker.js — manteniendo el hilo principal libre mientras jsPDF dibuja.
export async function dibujarAlbaranPDF(a, options, logos) {
  const { includeTicket = false } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = 210
  const margen   = 10
  const contentW = W - margen * 2   // 190 mm
  const grisOsc  = [80, 80, 80]
  const grisClaro = [242, 242, 242]
  const negro    = [20, 20, 20]

  // ── helpers ────────────────────────────────────────────────────────────────

  // Ajusta imagen a área manteniendo ratio. Fallback: dibuja estirado si falla getImageProperties
  const addImgFit = (b64, ax, ay, aw, ah) => {
    if (!b64) return
    try {
      const p  = doc.getImageProperties(b64)
      const r  = p.width / p.height
      let iw, ih
      if (aw / ah >= r) { ih = ah; iw = ih * r } else { iw = aw; ih = iw / r }
      doc.addImage(b64, fmt(b64), ax + (aw - iw) / 2, ay + (ah - ih) / 2, iw, ih)
    } catch {
      // Fallback sin conocer el ratio: simplemente lo pone en el área
      try { doc.addImage(b64, fmt(b64), ax, ay, aw, ah) } catch {}
    }
  }

  const { logoComsa, logoApplus1, logoApplus2, logoApplus3, logoApplus4, logoPefc, logoSure } = logos || {}

  // ═══════════════════════════════════════════════════════════════════════════
  //  CABECERA — 4 bloques simétricos + bloque TÍTULO
  //  Todos los logos a la misma altura LH, ratio preservado con addImgFit
  //  Área logos: 156mm | Título: 34mm | Total: 190mm
  // ═══════════════════════════════════════════════════════════════════════════

  const cabY  = margen
  const cabH  = 24
  const LH    = cabH - 4   // 20mm — altura fija para todos los logos

  // Borde exterior
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.4)
  doc.rect(margen, cabY, contentW, cabH)

  // ── Layout dinámico: gaps iguales entre logos reales ─────────────────────
  // Calculamos el ancho real de cada logo a altura LH usando getImageProperties,
  // luego distribuimos 5 gaps iguales. Así no hay padding visual desigual.
  const logosAreaW = 156
  const logoY      = cabY + (cabH - LH) / 2
  const AslotW     = 14   // mm por cada logo Applus (4 logos × 14mm = 56mm)

  // Ancho real de un logo renderizado a altura LH (preservando ratio)
  const logoW = (b64, maxW = 60) => {
    if (!b64) return 0
    try {
      const p = doc.getImageProperties(b64)
      return Math.min((p.width / p.height) * LH, maxW)
    } catch { return maxW }
  }

  const wComsa = logoW(logoComsa, 22)
  const wApplus = AslotW          // cada Applus ocupa exactamente su slot
  const wPefc  = logoW(logoPefc,  48)
  const wSure  = logoW(logoSure,  68)

  // 5 gaps iguales: [gap] COMSA [gap] APPLUS×4 [gap] PEFC [gap] SURE [gap]
  const totalW = wComsa + 4 * wApplus + wPefc + wSure
  const gap    = (logosAreaW - totalW) / 5
  const logoY0 = logoY   // alias para claridad

  let cx = margen + gap

  // ── COMSA ─────────────────────────────────────────────────────────────────
  addImgFit(logoComsa, cx, logoY0, wComsa, LH)
  cx += wComsa + gap

  // ── 4 × APPLUS ────────────────────────────────────────────────────────────
  ;[logoApplus1, logoApplus2, logoApplus3, logoApplus4].forEach(logo => {
    addImgFit(logo, cx, logoY0, wApplus, LH)
    cx += wApplus
  })
  cx += gap

  // ── PEFC ──────────────────────────────────────────────────────────────────
  addImgFit(logoPefc, cx, logoY0, wPefc, LH)
  cx += wPefc + gap

  // ── SURE ──────────────────────────────────────────────────────────────────
  addImgFit(logoSure, cx, logoY0, wSure, LH)

  // ── TÍTULO ─────────────────────────────────────────────────────────────────
  {
    const tituloX = margen + logosAreaW
    const sw = contentW - logosAreaW             // 34mm
    const sx = tituloX, cx = sx + sw / 2

    // Separador izquierdo suave
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.2)
    doc.line(sx, cabY + 1, sx, cabY + cabH - 1)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...negro)
    doc.text('ALBARÁN DE TRANSPORTE', cx, cabY + 5.5, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.15)
    doc.line(sx + 2, cabY + 7, sx + sw - 2, cabY + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', sx + 2, cabY + 10.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cx, cabY + 18.5, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.15)
    doc.line(sx + 2, cabY + 20, sx + sw - 2, cabY + 20)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha?.slice(0,10).split('-').reverse().join('/') : '__ / __ / ____'
    doc.text(`Fecha:  ${fechaStr}`, sx + 2, cabY + 23)
  }

  // ── TABLA DE DATOS ──────────────────────────────────────────────────────────
  let y = cabY + cabH + 4

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Transportista',      a.transportista     || '', 'Proveedor',     a.proveedor   || ''],
      ['Matrícula Tractora', a.matriculaTractora || '', 'Especie',       a.especie     || ''],
      ['Matrícula Remolque', a.matriculaRemolque || '', 'Tipo biomasa',  a.tipoBiomasa || ''],
      ['Chófer',             a.chofer            || '', 'Estella',       a.estella     || ''],
      ['Astilladora',        a.astilladora       || '', '',              ''],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: negro },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, halign: 'right', cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, halign: 'right', cellWidth: 40 },
      3: { cellWidth: 55 },
    },
    margin: { left: margen, right: margen },
  })

  y = doc.lastAutoTable.finalY + 5

  // ── PESOS ───────────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margen, y, W - margen, y)
  y += 8.5

  const pb   = a.pesada?.entrada ? Number(a.pesada.entrada).toLocaleString('es-ES') + ' kg' : '...................'
  const tara = a.pesada?.salida  ? Number(a.pesada.salida).toLocaleString('es-ES')  + ' kg' : '...................'
  const pn   = (a.pesada?.entrada && a.pesada?.salida)
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '...................'

  doc.setFontSize(9)
  const sp = 2  // separación label-valor

  // ── Peso Bruto: pegado al margen izquierdo
  doc.setFont('helvetica', 'bold')
  const pbLW = doc.getTextWidth('Peso Bruto')   // medir en bold, igual que Tara y Peso Neto
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(pb, margen + pbLW + sp, y)

  // ── Tara: grupo centrado exactamente en W/2
  doc.setFont('helvetica', 'bold')
  const taraLW = doc.getTextWidth('Tara')
  doc.setFont('helvetica', 'normal')
  const taraVW = doc.getTextWidth(tara)
  const taraTotalW = taraLW + sp + taraVW
  const taraX = W / 2 - taraTotalW / 2
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Tara', taraX, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(tara, taraX + taraLW + sp, y)

  // ── Peso Neto: pegado al margen derecho
  doc.setFont('helvetica', 'bold')
  const pnLW = doc.getTextWidth('Peso Neto')
  doc.setFont('helvetica', 'normal')
  const pnVW = doc.getTextWidth(pn)
  const pnTotalW = pnLW + sp + pnVW
  const pnX = W - margen - pnTotalW
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Peso Neto', pnX, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(pn, pnX + pnLW + sp, y)

  // Sin divisoria intermedia: Pesos / Origen / Destino / Permiso forman un
  // único bloque de datos, con el mismo ritmo vertical (8.5mm) entre líneas.
  y += 8.5

  // ── ORIGEN / DESTINO / PERMISO ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const origenLW  = doc.getTextWidth('Origen:')
  const permisoLW = doc.getTextWidth('Permiso:')
  const labelColX = margen + Math.max(origenLW, permisoLW) + sp   // valores de Origen/Permiso alineados en la misma columna

  doc.setTextColor(...grisOsc)
  doc.text('Origen:', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.origen || '.'.repeat(30), labelColX, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Destino:', 115, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.instalacion || '.'.repeat(26), 131, y)

  y += 8.5

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Permiso:', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.permiso || '.'.repeat(30), labelColX, y)

  if (a.referenciaSure) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...grisOsc)
    doc.text('Ref. SURE:', 115, y)
    const refLW = doc.getTextWidth('Ref. SURE:')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...negro)
    doc.text(a.referenciaSure, 115 + refLW + sp, y)
  }

  y += 7
  doc.setDrawColor(200, 200, 200)
  doc.line(margen, y, W - margen, y)
  y += 7

  // ── OBSERVACIONES ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Observaciones:', margen, y)
  y += 4
  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.3)
  doc.setFillColor(252, 252, 252)
  doc.rect(margen, y, contentW, 18, 'FD')
  if (a.observaciones) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...negro)
    doc.text(a.observaciones, margen + 2, y + 5, { maxWidth: contentW - 4 })
  }
  y += 23

  // ── CAJAS DE FIRMA ──────────────────────────────────────────────────────────
  const sigH    = 46
  const sigW    = contentW / 2 - 2
  const footerH = 9

  const drawSigBox = (bx, by, label, firmaData) => {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.setFillColor(255, 255, 255)
    doc.rect(bx, by, sigW, sigH, 'FD')
    const imgAreaH = sigH - footerH
    if (firmaData?.firmaImagen) {
      addImgFit(firmaData.firmaImagen, bx + 4, by + 4, sigW - 8, imgAreaH - 8)
    }
    doc.setFillColor(...grisClaro)
    doc.setDrawColor(200, 200, 200)
    doc.rect(bx, by + imgAreaH, sigW, footerH, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...grisOsc)
    doc.text(label, bx + sigW / 2, by + imgAreaH + footerH / 2 + 2.5, { align: 'center' })
  }

  const firmaOrigen  = a.firmas?.proveedor?.firmado    ? a.firmas.proveedor
                     : a.firmas?.astilladora?.firmado  ? a.firmas.astilladora
                     : null
  const firmaDestino = a.firmas?.instalacion?.firmado  ? a.firmas.instalacion : null

  drawSigBox(margen,             y, 'Firma y/o sello Proveedor',   firmaOrigen)
  drawSigBox(margen + sigW + 4,  y, 'Firma y/o sello Instalación', firmaDestino)

  y += sigH + 4

  // Registro digital de firmas: guardado en BD, consultable desde el panel — no se muestra en PDF
  y += 4

  // ── PIE DE PÁGINA ───────────────────────────────────────────────────────────
  const pageH   = 297
  const footerY = Math.max(y + 4, pageH - 10)
  doc.setFontSize(7)
  doc.setTextColor(160, 160, 160)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'C/ Vallès, 2 - Pol. Ind. Almeda · 08940 Cornellà de Llobregat',
    W / 2, footerY, { align: 'center' }
  )

  // ── TICKET DE PESADA (página adicional si se solicita) ─────────────────────
  // Un ticket en PDF (el que genera la báscula) no se puede pintar como
  // imagen: jsPDF fallaba en silencio y la página salía en blanco. Sus
  // páginas se añaden al final con pdf-lib (ver más abajo); las fotos siguen
  // como imagen.
  let ticketPdf = null
  if (includeTicket && a.pesada?.ticketUrl) {
    let ticketB64 = null
    try {
      ticketB64 = await toBase64(a.pesada.ticketUrl)
    } catch { /* se avisa en la página */ }
    if (ticketB64?.startsWith('data:application/pdf')) {
      ticketPdf = ticketB64
    } else {
      doc.addPage()
      let pintado = false
      if (ticketB64) {
        try { doc.getImageProperties(ticketB64); addImgFit(ticketB64, margen, margen, contentW, 297 - margen * 2); pintado = true } catch { /* aviso abajo */ }
      }
      if (!pintado) {
        doc.setFontSize(12)
        doc.setTextColor(150, 150, 150)
        doc.text('Ticket de pesada no disponible', W / 2, 148, { align: 'center' })
      }
    }
  }

  const nombre = includeTicket ? `${a.id}_albaran_ticket_comsa.pdf` : `${a.id}_albaran_comsa.pdf`

  // El visor de PDF del navegador muestra el título de los metadatos; sin él
  // enseña el id aleatorio de la blob URL de la vista previa.
  doc.setProperties({ title: nombre.replace(/\.pdf$/, ''), author: 'COMSA Service Bioenergía' })
  doc.viewerPreferences({ DisplayDocTitle: true })

  const buffer = doc.output('arraybuffer')
  if (!ticketPdf) return { buffer, nombre }
  return { buffer: await anexarTicketPdf(buffer, ticketPdf), nombre }
}

// Añade cada página del ticket en PDF como una página A4 del albarán,
// escalada para caber con 10 mm de margen y centrada (sin rasterizar: el
// texto del ticket sigue siendo texto). Si el PDF del ticket está dañado,
// se añade una página con el aviso en lugar de una en blanco.
async function anexarTicketPdf(albaranBuffer, ticketDataUrl) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const out = await PDFDocument.load(albaranBuffer)
  const A4 = [595.28, 841.89]          // puntos
  const M  = 28.35                     // 10 mm
  try {
    const bytes = Uint8Array.from(atob(ticketDataUrl.split(',')[1]), c => c.charCodeAt(0))
    const ticket = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const paginas = await out.embedPdf(ticket, ticket.getPageIndices())
    for (const pg of paginas) {
      const page  = out.addPage(A4)
      const escala = Math.min((A4[0] - 2 * M) / pg.width, (A4[1] - 2 * M) / pg.height)
      const w = pg.width * escala, h = pg.height * escala
      page.drawPage(pg, { x: (A4[0] - w) / 2, y: A4[1] - M - h, width: w, height: h })
    }
  } catch {
    const page = out.addPage(A4)
    const font = await out.embedFont(StandardFonts.Helvetica)
    const txt  = 'Ticket de pesada no disponible'
    page.drawText(txt, { x: (A4[0] - font.widthOfTextAtSize(txt, 12)) / 2, y: A4[1] / 2, size: 12, font, color: rgb(0.6, 0.6, 0.6) })
  }
  const bytes = await out.save()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

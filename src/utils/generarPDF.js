import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { api } from '../lib/api'

export async function generarPDF(a, options = {}) {
  const { includeTicket = false } = options
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = 210
  const margen   = 10
  const contentW = W - margen * 2   // 190 mm
  const grisOsc  = [80, 80, 80]
  const grisClaro = [242, 242, 242]
  const negro    = [20, 20, 20]

  // ── helpers ────────────────────────────────────────────────────────────────

  const toBase64 = (url) =>
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob() })
      .then(b => new Promise(res => {
        const reader = new FileReader()
        reader.onloadend = () => res(reader.result)
        reader.readAsDataURL(b)
      }))

  const fmt = (b64) => {
    if (!b64) return 'PNG'
    if (b64.startsWith('data:image/jpeg') || b64.startsWith('data:image/jpg')) return 'JPEG'
    if (b64.startsWith('data:image/webp')) return 'WEBP'
    return 'PNG'
  }

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


  // ── carga de logos ─────────────────────────────────────────────────────────

  let logoComsa, logoApplus1, logoApplus2, logoApplus3, logoApplus4, logoPefc, logoSure
  try {
    const map = await api.get('/storage/logos')
    if (map) {
      const ids = { comsa: 'logoComsa', applus_1: 'logoApplus1', applus_2: 'logoApplus2', applus_3: 'logoApplus3', applus_4: 'logoApplus4', pefc: 'logoPefc', sure: 'logoSure' }
      const assigns = { logoComsa: null, logoApplus1: null, logoApplus2: null, logoApplus3: null, logoApplus4: null, logoPefc: null, logoSure: null }
      for (const [id, varName] of Object.entries(ids)) {
        if (map[id]) {
          try { assigns[varName] = await toBase64(map[id]) } catch {}
        }
      }
      logoComsa   = assigns.logoComsa
      logoApplus1 = assigns.logoApplus1
      logoApplus2 = assigns.logoApplus2
      logoApplus3 = assigns.logoApplus3
      logoApplus4 = assigns.logoApplus4
      logoPefc    = assigns.logoPefc
      logoSure    = assigns.logoSure
    }
  } catch {}

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
    doc.setFontSize(13)
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
      ['Transportista',      a.transportista || '',     'Proveedor',       a.proveedor || ''],
      ['Matrícula Tractora', a.matriculaTractora || '',  'Tipos de madera', a.tipoBiomasa || ''],
      ['Matrícula Remolque', a.matriculaRemolque || '',  'Especie',         a.especie || ''],
      ['Chófer',             a.chofer || '',             'Astilladora',     a.astilladora || ''],
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
  y += 7

  const pb   = a.pesada?.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '...................'
  const tara = a.pesada?.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : '...................'
  const pn   = (a.pesada?.entrada && a.pesada?.salida)
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '...................'

  doc.setFontSize(9)
  const sp = 2  // separación label-valor

  // ── Peso Bruto: pegado al margen izquierdo
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(pb, margen + doc.getTextWidth('Peso Bruto') + sp, y)

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

  y += 6
  doc.setDrawColor(200, 200, 200)
  doc.line(margen, y, W - margen, y)
  y += 7

  // ── ORIGEN / DESTINO ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Origen:', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.origen || '.'.repeat(30), margen + 16, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Destino:', 115, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.instalacion || '.'.repeat(26), 131, y)

  y += 6
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
      try {
        doc.addImage(firmaData.firmaImagen, fmt(firmaData.firmaImagen),
          bx + 4, by + 4, sigW - 8, imgAreaH - 8)
      } catch {}
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

  // ── BLOQUE DE AUDITORÍA DIGITAL ─────────────────────────────────────────────
  const ORDEN_AUDIT = ['proveedor','astilladora','transportista','instalacion','oficina']
  const firmasAudit = ORDEN_AUDIT
    .map(r => ({ rol: r, ...a.firmas?.[r] }))
    .filter(f => f?.firmado)

  if (firmasAudit.length) {
    const auditH = 5 + firmasAudit.length * 5 + 4
    doc.setFillColor(248, 248, 246)
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.rect(margen, y, contentW, auditH, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(100, 100, 100)
    doc.text('REGISTRO DIGITAL DE FIRMAS', margen + 3, y + 4)

    const ROL_LABELS = { proveedor:'Proveedor', astilladora:'Astilladora', transportista:'Transportista', instalacion:'Instalación', oficina:'Oficina' }
    firmasAudit.forEach((f, i) => {
      const ly = y + 4 + (i + 1) * 5
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5)
      doc.setTextColor(60, 60, 60)
      doc.text(`${ROL_LABELS[f.rol] || f.rol}:`, margen + 3, ly)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const persona = f.nombrePersona ? ` ${f.nombrePersona} ·` : ''
      const ip      = f.ipOrigen ? ` IP ${f.ipOrigen}` : ''
      doc.text(`${f.actor || ''}${persona} ${f.fecha || ''}${ip}`, margen + 28, ly)
    })

    y += auditH + 4
  } else {
    y += 4
  }

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
  if (includeTicket && a.pesada?.ticketUrl) {
    doc.addPage()
    try {
      const ticketB64 = await toBase64(a.pesada.ticketUrl)
      addImgFit(ticketB64, margen, margen, contentW, 297 - margen * 2)
    } catch {
      doc.setFontSize(12)
      doc.setTextColor(150, 150, 150)
      doc.text('Ticket de pesada no disponible', W / 2, 148, { align: 'center' })
    }
  }

  const nombre = includeTicket ? `${a.id}_albaran_ticket_comsa.pdf` : `${a.id}_albaran_comsa.pdf`
  doc.save(nombre)
}

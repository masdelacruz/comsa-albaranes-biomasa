import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabase'

export async function generarPDF(a) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W        = 210
  const margen   = 10
  const contentW = W - margen * 2   // 190 mm
  const grisOsc  = [80, 80, 80]
  const grisClaro = [242, 242, 242]
  const negro    = [20, 20, 20]
  const verde    = [15, 110, 86]

  // ── helpers ────────────────────────────────────────────────────────────────

  const toBase64 = (url) =>
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob() })
      .then(b => new Promise(res => {
        const reader = new FileReader()
        reader.onloadend = () => res(reader.result)
        reader.readAsDataURL(b)
      }))

  const centerImg = (b64, x, y, secW, secH, maxW, maxH) => {
    // Draw image centered within a cell (x,y,secW,secH), capped at maxW×maxH
    const imgX = x + (secW - maxW) / 2
    const imgY = y + (secH - maxH) / 2
    try { doc.addImage(b64, 'PNG', imgX, imgY, maxW, maxH) } catch {}
  }

  // ── load logos ─────────────────────────────────────────────────────────────

  let logoComsa
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}

  let logoApplus, logoPefc, logoSure
  try {
    const { data } = await supabase.from('logos_config').select('id,url')
    if (data) {
      for (const row of data) {
        try {
          const b64 = await toBase64(row.url)
          if (row.id === 'applus') logoApplus = b64
          if (row.id === 'pefc')   logoPefc   = b64
          if (row.id === 'sure')   logoSure   = b64
        } catch {}
      }
    }
  } catch {}

  // ── HEADER ─────────────────────────────────────────────────────────────────
  //  Secciones (mm): COMSA=30 | Applus=36 | PEFC=54 | SURE=40 | Título=30
  //  Total = 190 mm  ✓
  const cabY = margen
  const cabH = 52
  const cabX = margen

  const secWidths = [30, 36, 54, 40, contentW - 30 - 36 - 54 - 40]
  const secX = []
  secWidths.reduce((acc, w, i) => { secX[i] = acc; return acc + w }, cabX)

  // Outer border
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.5)
  doc.rect(cabX, cabY, contentW, cabH)

  // Vertical dividers
  doc.setLineWidth(0.3)
  for (let i = 1; i < secWidths.length; i++) {
    doc.line(secX[i], cabY, secX[i], cabY + cabH)
  }

  // ── Sección 0: COMSA ────────────────────────────────────────────────────────
  {
    const sx = secX[0], sw = secWidths[0]
    if (logoComsa) {
      centerImg(logoComsa, sx, cabY, sw, cabH, 20, 20)
    } else {
      // Placeholder geométrico
      doc.setFillColor(29, 158, 117)
      doc.roundedRect(sx + sw / 2 - 9, cabY + 8, 18, 18, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(255, 255, 255)
      doc.text('C', sx + sw / 2, cabY + 19.5, { align: 'center' })
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...grisOsc)
    doc.text('COMSA', sx + sw / 2, cabY + 36, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text('SERVICE', sx + sw / 2, cabY + 41, { align: 'center' })
  }

  // ── Sección 1: Applus ───────────────────────────────────────────────────────
  {
    const sx = secX[1], sw = secWidths[1]
    if (logoApplus) {
      centerImg(logoApplus, sx, cabY, sw, cabH, 28, 22)
    }
    // Sin logo: celda vacía (esperando subida)
  }

  // ── Sección 2: PEFC ─────────────────────────────────────────────────────────
  // Logo pequeño a la izquierda + bloque de texto a la derecha
  {
    const sx = secX[2], sw = secWidths[2]
    const pad = 3

    // Logo PEFC (si existe)
    const logoW = 14, logoH = 18
    if (logoPefc) {
      try {
        doc.addImage(logoPefc, 'PNG', sx + pad, cabY + (cabH - logoH) / 2, logoW, logoH)
      } catch {}
    }

    // Bloque de texto — empieza después del logo (o desde pad si no hay logo)
    const txtX = sx + (logoPefc ? pad + logoW + 3 : pad)

    const lines = [
      { text: 'COMSA SERVICE',           bold: false, size: 5 },
      { text: 'FACILITY MANAGEMENT SAU', bold: false, size: 5 },
      { text: 'tiene una Cadena de',     bold: false, size: 5 },
      { text: 'Custodia certificada',    bold: false, size: 5 },
      { text: 'PEFC',                    bold: true,  size: 8, color: verde },
      { text: 'PEFC/14-31-00318',        bold: false, size: 5 },
      { text: 'www.pefc.es',             bold: false, size: 5 },
    ]
    const lineH   = 5.5
    const totalH  = (lines.length - 1) * lineH
    const startY  = cabY + (cabH - totalH) / 2

    lines.forEach((l, i) => {
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal')
      doc.setFontSize(l.size)
      doc.setTextColor(...(l.color || grisOsc))
      doc.text(l.text, txtX, startY + i * lineH)
    })
  }

  // ── Sección 3: SURE ─────────────────────────────────────────────────────────
  {
    const sx = secX[3], sw = secWidths[3]
    const pad = 3

    const logoW = 32, logoH = 16
    const txtLines = [
      'SUSTAINABLE RESOURCES',
      'Verification Scheme GmbH',
      'SURE EU/ES 001/ Z202 2281',
    ]
    const lineH = 5
    const totalH  = logoH + 5 + (txtLines.length - 1) * lineH  // logo + gap + text block
    const groupY  = cabY + (cabH - totalH) / 2

    if (logoSure) {
      try {
        doc.addImage(logoSure, 'PNG', sx + (sw - logoW) / 2, groupY, logoW, logoH)
      } catch {}
    }

    const txtStartY = groupY + logoH + 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5)
    doc.setTextColor(...grisOsc)
    txtLines.forEach((line, i) => {
      doc.text(line, sx + sw / 2, txtStartY + i * lineH, { align: 'center' })
    })
  }

  // ── Sección 4: Título ───────────────────────────────────────────────────────
  {
    const sx = secX[4], sw = secWidths[4]
    const cx = sx + sw / 2

    // Fondo gris muy claro para distinguir
    doc.setFillColor(248, 248, 248)
    doc.rect(sx, cabY, sw, cabH, 'F')
    // Redibujar borde derecho e interior
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(sx, cabY, sw, cabH)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...negro)
    doc.text('ALBARÁN DE', cx, cabY + 9, { align: 'center' })
    doc.text('TRANSPORTE', cx, cabY + 15, { align: 'center' })

    // Separador fino
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(sx + 3, cabY + 18, sx + sw - 3, cabY + 18)

    // Nº albarán
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', sx + 3, cabY + 24)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cx, cabY + 37, { align: 'center' })

    // Separador fino
    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(sx + 3, cabY + 40, sx + sw - 3, cabY + 40)

    // Fecha
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '___/___/______'
    doc.text(`Fecha:  ${fechaStr}`, sx + 3, cabY + 47)
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

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(pb, margen + 28, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Tara', 88, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(tara, 97, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Peso Neto', 148, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(pn, 164, y)

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
  doc.text(a.origen || '.' .repeat(30), margen + 16, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Destino:', 115, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.instalacion || '.' .repeat(26), 131, y)

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
        doc.addImage(firmaData.firmaImagen, 'PNG', bx + 4, by + 4, sigW - 8, imgAreaH - 8)
      } catch {}
    }

    // Footer gris
    doc.setFillColor(...grisClaro)
    doc.setDrawColor(200, 200, 200)
    doc.rect(bx, by + imgAreaH, sigW, footerH, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...grisOsc)
    doc.text(label, bx + sigW / 2, by + imgAreaH + footerH / 2 + 2.5, { align: 'center' })
  }

  const firmaOrigen  = a.firmas?.astilladora?.firmado ? a.firmas.astilladora
                     : a.firmas?.camionero?.firmado    ? a.firmas.camionero
                     : null
  const firmaDestino = a.firmas?.instalacion?.firmado ? a.firmas.instalacion : null

  drawSigBox(margen,             y, 'Firma y/o sello Origen',  firmaOrigen)
  drawSigBox(margen + sigW + 4,  y, 'Firma y/o sello Destino', firmaDestino)

  y += sigH + 6

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

  doc.save(`${a.id}_albaran_comsa.pdf`)
}

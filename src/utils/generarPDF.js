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

  // ── carga de logos ─────────────────────────────────────────────────────────

  let logoComsa
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}

  // 4 logos Applus + PEFC + SURE
  let logoApplus1, logoApplus2, logoApplus3, logoApplus4, logoPefc, logoSure
  try {
    const { data } = await supabase.from('logos_config').select('id,url')
    if (data) {
      for (const row of data) {
        try {
          const b64 = await toBase64(row.url)
          if (row.id === 'applus_1') logoApplus1 = b64
          if (row.id === 'applus_2') logoApplus2 = b64
          if (row.id === 'applus_3') logoApplus3 = b64
          if (row.id === 'applus_4') logoApplus4 = b64
          if (row.id === 'pefc')     logoPefc    = b64
          if (row.id === 'sure')     logoSure    = b64
        } catch {}
      }
    }
  } catch {}

  // ── CABECERA ───────────────────────────────────────────────────────────────
  //  Secciones (mm): COMSA=26 | Applus=44 | PEFC=54 | SURE=38 | Título=28
  //  Total = 190 mm  ✓
  //  Logos Applus: cuadrícula 2×2, cada uno 16×29 mm (relación 1:1.81 ≈ PNG original)
  const cabY = margen
  const cabH = 66        // altura suficiente para 2 filas de logos portrait + márgenes
  const cabX = margen

  const secWidths = [26, 44, 54, 38, contentW - 26 - 44 - 54 - 38]  // último = 28 mm
  const secX = []
  secWidths.reduce((acc, w, i) => { secX[i] = acc; return acc + w }, cabX)

  // Borde exterior
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.5)
  doc.rect(cabX, cabY, contentW, cabH)

  // Divisores verticales
  doc.setLineWidth(0.3)
  for (let i = 1; i < secWidths.length; i++) {
    doc.line(secX[i], cabY, secX[i], cabY + cabH)
  }

  // ── Sección 0: COMSA ────────────────────────────────────────────────────────
  {
    const sx = secX[0], sw = secWidths[0]
    if (logoComsa) {
      const lw = 18, lh = 18
      try {
        doc.addImage(logoComsa, 'PNG', sx + (sw - lw) / 2, cabY + (cabH - lh) / 2 - 4, lw, lh)
      } catch {}
    } else {
      doc.setFillColor(29, 158, 117)
      doc.roundedRect(sx + sw / 2 - 9, cabY + 10, 18, 18, 3, 3, 'F')
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...grisOsc)
    doc.text('COMSA', sx + sw / 2, cabY + 42, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text('SERVICE', sx + sw / 2, cabY + 47, { align: 'center' })
  }

  // ── Sección 1: Applus — cuadrícula 2×2 ─────────────────────────────────────
  {
    const sx = secX[1], sw = secWidths[1]

    // Dimensiones de cada logo: relación de aspecto ~1:1.81 (original 1500×2721 px)
    const logoW  = 16               // mm de ancho por logo
    const logoH  = logoW * (2721 / 1500)  // ≈ 29 mm de alto
    const gap    = 2                // mm entre logos
    const gridW  = logoW * 2 + gap  // 34 mm
    const gridH  = logoH * 2 + gap  // ≈ 60 mm

    const startX = sx + (sw - gridW) / 2
    const startY = cabY + (cabH - gridH) / 2

    const applusLogos = [logoApplus1, logoApplus2, logoApplus3, logoApplus4]

    applusLogos.forEach((logo, i) => {
      if (!logo) return
      const col = i % 2
      const row = Math.floor(i / 2)
      const lx = startX + col * (logoW + gap)
      const ly = startY + row * (logoH + gap)
      try { doc.addImage(logo, 'PNG', lx, ly, logoW, logoH) } catch {}
    })
  }

  // ── Sección 2: PEFC ─────────────────────────────────────────────────────────
  {
    const sx = secX[2], sw = secWidths[2]
    const pad = 3

    const logoW = 14, logoH = 22
    if (logoPefc) {
      try {
        doc.addImage(logoPefc, 'PNG', sx + pad, cabY + (cabH - logoH) / 2, logoW, logoH)
      } catch {}
    }

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
    const lineH  = 5.5
    const totalH = (lines.length - 1) * lineH
    const startY = cabY + (cabH - totalH) / 2

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

    const logoW = 32, logoH = 16
    const txtLines = [
      'SUSTAINABLE RESOURCES',
      'Verification Scheme GmbH',
      'SURE EU/ES 001/ Z202 2281',
    ]
    const lineH  = 5
    const totalH = logoH + 6 + (txtLines.length - 1) * lineH
    const groupY = cabY + (cabH - totalH) / 2

    if (logoSure) {
      try {
        doc.addImage(logoSure, 'PNG', sx + (sw - logoW) / 2, groupY, logoW, logoH)
      } catch {}
    }

    const txtStartY = groupY + logoH + 6
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

    doc.setFillColor(248, 248, 248)
    doc.rect(sx, cabY, sw, cabH, 'F')
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(sx, cabY, sw, cabH)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...negro)
    doc.text('ALBARÁN DE', cx, cabY + 9, { align: 'center' })
    doc.text('TRANSPORTE', cx, cabY + 15, { align: 'center' })

    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(sx + 2, cabY + 18, sx + sw - 2, cabY + 18)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', sx + 2, cabY + 24)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cx, cabY + 39, { align: 'center' })

    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(sx + 2, cabY + 43, sx + sw - 2, cabY + 43)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '___/___/______'
    doc.text('Fecha:', sx + 2, cabY + 50)
    doc.setTextColor(...negro)
    doc.text(fechaStr, sx + 2, cabY + 57)
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

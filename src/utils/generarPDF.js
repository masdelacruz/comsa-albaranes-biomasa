import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../supabase'

export async function generarPDF(a) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const margen = 10
  const contentW = W - margen * 2   // 190mm
  const grisOsc  = [60, 60, 60]
  const grisClaro = [240, 240, 240]
  const negro = [20, 20, 20]

  // ── helpers ────────────────────────────────────────────────────────────────

  const toBase64 = (url) =>
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.blob() })
      .then(b => new Promise(res => {
        const reader = new FileReader()
        reader.onloadend = () => res(reader.result)
        reader.readAsDataURL(b)
      }))

  // ── load logos ─────────────────────────────────────────────────────────────

  // COMSA logo from public folder
  let logoComsa
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}

  // Certification logos from Supabase table logos_config
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

  // ── HEADER BOX ─────────────────────────────────────────────────────────────
  // 5 sections with vertical dividers; total height 46mm
  const cabY   = margen        // top of header box
  const cabH   = 46            // height of header box
  const cabX   = margen        // left edge

  // Section widths (mm): COMSA=26, Applus=50, PEFC=40, SURE=33, Title=41
  const secWidths = [26, 50, 40, 33, contentW - 26 - 50 - 40 - 33]  // last fills remainder
  const secX = []
  secWidths.reduce((acc, w, i) => { secX[i] = acc; return acc + w }, cabX)

  // Outer border
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.4)
  doc.rect(cabX, cabY, contentW, cabH)

  // Vertical dividers
  for (let i = 1; i < secWidths.length; i++) {
    const x = secX[i]
    doc.line(x, cabY, x, cabY + cabH)
  }

  // ── Section 1: COMSA (x=secX[0], w=26) ────────────────────────────────────
  const s0x = secX[0]
  const s0w = secWidths[0]
  if (logoComsa) {
    // Fit logo centred, max ~18mm wide, maintain aspect
    const logoW = 18
    const logoH = 18
    doc.addImage(logoComsa, 'PNG', s0x + (s0w - logoW) / 2, cabY + 4, logoW, logoH)
  } else {
    // Fallback geometric placeholder
    doc.setFillColor(29, 158, 117)
    doc.circle(s0x + s0w / 2, cabY + 14, 7, 'F')
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...grisOsc)
  doc.text('COMSA', s0x + s0w / 2, cabY + 28, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('SERVICE', s0x + s0w / 2, cabY + 33, { align: 'center' })

  // ── Section 2: Applus (x=secX[1], w=50) ────────────────────────────────────
  const s1x = secX[1]
  const s1w = secWidths[1]
  if (logoApplus) {
    const logoW = 36
    const logoH = 20
    doc.addImage(logoApplus, 'PNG', s1x + (s1w - logoW) / 2, cabY + (cabH - logoH) / 2, logoW, logoH)
  }

  // ── Section 3: PEFC (x=secX[2], w=40) ─────────────────────────────────────
  const s2x = secX[2]
  const s2w = secWidths[2]
  const pefcLogoW = 16
  const pefcLogoH = 20
  if (logoPefc) {
    doc.addImage(logoPefc, 'PNG', s2x + 2, cabY + (cabH - pefcLogoH) / 2, pefcLogoW, pefcLogoH)
  }
  // Text block to the right of the logo
  const pefcTxtX = s2x + pefcLogoW + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...grisOsc)
  const pefcLines = [
    'COMSA SERVICE',
    'FACILITY MANAGEMENT SAU',
    'tiene una Cadena de',
    'Custodia certificada',
    'PEFC',
    'PEFC/14-31-00318',
    'www.pefc.es',
  ]
  pefcLines.forEach((line, i) => {
    if (i === 4) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.5)
    }
    doc.text(line, pefcTxtX, cabY + 10 + i * 6)
  })

  // ── Section 4: SURE (x=secX[3], w=33) ─────────────────────────────────────
  const s3x = secX[3]
  const s3w = secWidths[3]
  const sureLogoW = 29
  const sureLogoH = 14
  if (logoSure) {
    doc.addImage(logoSure, 'PNG', s3x + (s3w - sureLogoW) / 2, cabY + 3, sureLogoW, sureLogoH)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(...grisOsc)
  const sureLines = [
    'SUSTAINABLE RESOURCES',
    'Verification Scheme GmbH',
    'SURE EU/ES 001/ Z202 2281',
  ]
  sureLines.forEach((line, i) => {
    doc.text(line, s3x + s3w / 2, cabY + 22 + i * 5.5, { align: 'center' })
  })

  // ── Section 5: Title (x=secX[4]) ───────────────────────────────────────────
  const s4x = secX[4]
  const s4w = secWidths[4]
  const s4cx = s4x + s4w / 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...negro)
  doc.text('ALBARÁN DE', s4cx, cabY + 7, { align: 'center' })
  doc.text('TRANSPORTE', s4cx, cabY + 13, { align: 'center' })

  // Thin separator line inside section
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(s4x + 2, cabY + 16, s4x + s4w - 2, cabY + 16)

  // Nº albarán label + value in large red
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...grisOsc)
  doc.text('Nº albarán:', s4x + 3, cabY + 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(200, 30, 30)
  doc.text(String(a.id ?? ''), s4x + 3, cabY + 33)

  // Fecha
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...grisOsc)
  doc.text('Fecha:', s4x + 3, cabY + 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...negro)
  const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '___/___/______'
  doc.text(fechaStr, s4x + 16, cabY + 40)

  // ── DATA TABLE ──────────────────────────────────────────────────────────────
  let y = cabY + cabH + 2

  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Transportista',      a.transportista || '',    'Proveedor',       a.proveedor || ''],
      ['Matrícula Tractora', a.matriculaTractora || '', 'Tipos de madera', a.tipoBiomasa || ''],
      ['Matrícula Remolque', a.matriculaRemolque || '', 'Especie',         a.especie || ''],
      ['Chófer',             a.chofer || '',            'Astilladora',     a.astilladora || ''],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: negro },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, halign: 'right', cellWidth: 38 },
      1: { cellWidth: 57 },
      2: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, halign: 'right', cellWidth: 38 },
      3: { cellWidth: 57 },
    },
    margin: { left: margen, right: margen },
  })

  y = doc.lastAutoTable.finalY + 5

  // ── WEIGHTS LINE ────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margen, y, W - margen, y)
  y += 6

  const pb   = a.pesada?.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : null
  const tara = a.pesada?.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : null
  const pn   = (a.pesada?.entrada && a.pesada?.salida)
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : null

  const dotFill = (val, dots = 20) => val ?? ('.' .repeat(dots))

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(dotFill(pb), margen + 26, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Tara', 87, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(dotFill(tara), 97, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Peso Neto', 145, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(dotFill(pn), 163, y)

  y += 6
  doc.setDrawColor(200, 200, 200)
  doc.line(margen, y, W - margen, y)
  y += 6

  // ── ORIGEN / DESTINO LINE ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Origen:', margen, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.origen || '.' .repeat(30), margen + 16, y)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOsc)
  doc.text('Destino:', 113, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.instalacion || '.' .repeat(28), 129, y)

  y += 6
  doc.setDrawColor(200, 200, 200)
  doc.line(margen, y, W - margen, y)
  y += 6

  // ── OBSERVACIONES ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Observaciones:', margen, y)
  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.setFillColor(250, 250, 250)
  doc.rect(margen, y, contentW, 18, 'FD')
  if (a.observaciones) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...negro)
    doc.text(a.observaciones, margen + 2, y + 5, { maxWidth: contentW - 4 })
  }
  y += 23

  // ── SIGNATURE BOXES ─────────────────────────────────────────────────────────
  // Always 2 boxes: Origen (left) + Destino (right)
  const sigH      = 44
  const sigW      = contentW / 2 - 1   // 1mm gap between boxes
  const footerH   = 8                  // grey footer bar inside box

  const drawSigBox = (bx, by, label, firmaData) => {
    // Outer rect
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.setFillColor(255, 255, 255)
    doc.rect(bx, by, sigW, sigH, 'FD')

    // Signature image area (above footer)
    const imgAreaH = sigH - footerH
    if (firmaData?.firmaImagen) {
      try {
        doc.addImage(firmaData.firmaImagen, 'PNG', bx + 4, by + 4, sigW - 8, imgAreaH - 8)
      } catch {}
    }

    // Grey footer bar
    doc.setFillColor(...grisClaro)
    doc.setDrawColor(200, 200, 200)
    doc.rect(bx, by + imgAreaH, sigW, footerH, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...grisOsc)
    doc.text(label, bx + sigW / 2, by + imgAreaH + footerH / 2 + 2, { align: 'center' })
  }

  // Determine signature data
  // Origen signature: astilladora or transportista (whichever is available first)
  const firmaOrigen  = a.firmas?.astilladora?.firmado ? a.firmas.astilladora
                     : a.firmas?.camionero?.firmado    ? a.firmas.camionero
                     : null
  const firmaDestino = a.firmas?.instalacion?.firmado ? a.firmas.instalacion : null

  drawSigBox(margen,           y, 'Firma y/o sello Origen',  firmaOrigen)
  drawSigBox(margen + sigW + 2, y, 'Firma y/o sello Destino', firmaDestino)

  y += sigH + 6

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  // Pin to bottom if there's room, otherwise just use current y
  const pageH = 297
  const footerY = Math.max(y + 4, pageH - 10)

  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'C/ Vallès, 2 - Pol. Ind. Almeda · 08940 Cornellà de Llobregat',
    W / 2, footerY, { align: 'center' }
  )

  doc.save(`${a.id}_albaran_comsa.pdf`)
}

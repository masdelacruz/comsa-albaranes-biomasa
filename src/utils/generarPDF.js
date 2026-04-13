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

  // Detecta el formato real de una imagen base64 para jsPDF
  const fmt = (b64) => {
    if (!b64) return 'PNG'
    if (b64.startsWith('data:image/jpeg') || b64.startsWith('data:image/jpg')) return 'JPEG'
    if (b64.startsWith('data:image/webp')) return 'WEBP'
    if (b64.startsWith('data:image/gif'))  return 'GIF'
    return 'PNG'
  }

  // Dibuja una imagen centrada dentro de una celda (cx, cy = centro de la celda)
  const addImgCentered = (b64, cx, cy, maxW, maxH) => {
    try { doc.addImage(b64, fmt(b64), cx - maxW / 2, cy - maxH / 2, maxW, maxH) } catch {}
  }

  // ── carga de logos ─────────────────────────────────────────────────────────

  let logoComsa
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}

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
  //  Sin divisores verticales — solo borde exterior.
  //  Anchuras de zona (mm): COMSA=26 | Applus=46 | PEFC=56 | SURE=34 | Título=28
  const cabY = margen
  const cabH = 56        // altura cabecera
  const cabX = margen

  // Solo borde exterior — sin líneas divisorias internas
  doc.setDrawColor(170, 170, 170)
  doc.setLineWidth(0.4)
  doc.rect(cabX, cabY, contentW, cabH)

  const secW = [26, 46, 56, 34, 28]
  const secX = []
  secW.reduce((acc, w, i) => { secX[i] = acc; return acc + w }, cabX)

  // Helper: centro X e Y de cada sección
  const scx = (i) => secX[i] + secW[i] / 2
  const scy = cabY + cabH / 2

  // ── COMSA ──────────────────────────────────────────────────────────────────
  if (logoComsa) {
    addImgCentered(logoComsa, scx(0), scy - 4, 20, 20)
  } else {
    doc.setFillColor(29, 158, 117)
    doc.roundedRect(scx(0) - 9, scy - 13, 18, 18, 3, 3, 'F')
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...grisOsc)
  doc.text('COMSA', scx(0), cabY + cabH - 9, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  doc.text('SERVICE', scx(0), cabY + cabH - 5, { align: 'center' })

  // ── Applus — cuadrícula 2×2 ────────────────────────────────────────────────
  {
    const sx = secX[1], sw = secW[1]
    // Cada logo: 17mm ancho × 30mm alto (relación ~1:1.8, ajustada para caber bien)
    const lw = 17, lh = 30
    const gap = 2
    const gridW = lw * 2 + gap   // 36 mm
    const gridH = lh * 2 + gap   // 62 mm → si cabH=56 no caben 2 filas de 30mm
    // Con cabH=56, usamos lh ajustado: (56 - 3*2) / 2 = 25mm de alto máximo
    const lhFit = (cabH - 6) / 2          // ≈ 25 mm
    const lwFit = lhFit / 1.814            // ≈ 13.8 mm → redondeamos a 14
    const lhF   = Math.floor(lhFit)       // 25
    const lwF   = Math.round(lwFit)       // 14

    const gapF  = 2
    const gW    = lwF * 2 + gapF           // 30
    const gH    = lhF * 2 + gapF           // 52
    const ox    = sx + (sw - gW) / 2       // offset X para centrar el grid
    const oy    = cabY + (cabH - gH) / 2  // offset Y para centrar el grid

    const applusLogos = [logoApplus1, logoApplus2, logoApplus3, logoApplus4]
    applusLogos.forEach((logo, i) => {
      if (!logo) return
      const col = i % 2
      const row = Math.floor(i / 2)
      const lx = ox + col * (lwF + gapF)
      const ly = oy + row * (lhF + gapF)
      try { doc.addImage(logo, fmt(logo), lx, ly, lwF, lhF) } catch {}
    })
  }

  // ── PEFC ───────────────────────────────────────────────────────────────────
  {
    const sx = secX[2], sw = secW[2]

    // Logo PEFC pequeño a la izquierda (si existe)
    const lw = 12, lh = 15
    if (logoPefc) {
      try {
        doc.addImage(logoPefc, fmt(logoPefc), sx + 3, cabY + (cabH - lh) / 2, lw, lh)
      } catch {}
    }

    // Texto — empieza tras el logo o desde el borde
    const txtX = sx + (logoPefc ? 3 + lw + 3 : 4)

    const lines = [
      { text: 'COMSA SERVICE',           bold: false, size: 4.8 },
      { text: 'FACILITY MANAGEMENT SAU', bold: false, size: 4.8 },
      { text: 'tiene una Cadena de',     bold: false, size: 4.8 },
      { text: 'Custodia certificada',    bold: false, size: 4.8 },
      { text: 'PEFC',                    bold: true,  size: 8,   color: [0, 130, 60] },
      { text: 'PEFC/14-31-00318',        bold: false, size: 4.8 },
      { text: 'www.pefc.es',             bold: false, size: 4.8 },
    ]
    const lineH  = 5
    const totalH = (lines.length - 1) * lineH
    const startY = cabY + (cabH - totalH) / 2

    lines.forEach((l, i) => {
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal')
      doc.setFontSize(l.size)
      doc.setTextColor(...(l.color || grisOsc))
      doc.text(l.text, txtX, startY + i * lineH)
    })
  }

  // ── SURE ───────────────────────────────────────────────────────────────────
  {
    const sx = secX[3], sw = secW[3]

    const lw = 28, lh = 13
    const txtLines = [
      'SUSTAINABLE RESOURCES',
      'Verification Scheme GmbH',
      'SURE EU/ES 001/ Z202 2281',
    ]
    const lineH  = 4.8
    const groupH = lh + 5 + (txtLines.length - 1) * lineH
    const gy     = cabY + (cabH - groupH) / 2

    if (logoSure) {
      try {
        doc.addImage(logoSure, fmt(logoSure), sx + (sw - lw) / 2, gy, lw, lh)
      } catch {}
    }

    const txtY = gy + lh + 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.5)
    doc.setTextColor(...grisOsc)
    txtLines.forEach((line, i) => {
      doc.text(line, sx + sw / 2, txtY + i * lineH, { align: 'center' })
    })
  }

  // ── TÍTULO ─────────────────────────────────────────────────────────────────
  {
    const sx = secX[4], sw = secW[4]
    const cx = sx + sw / 2

    // Fondo muy suave para distinguir la sección
    doc.setFillColor(247, 247, 247)
    doc.rect(sx, cabY, sw, cabH, 'F')
    // Borde izquierdo sutil como único separador visual
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(sx, cabY, sx, cabY + cabH)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...negro)
    doc.text('ALBARÁN DE', cx, cabY + 9, { align: 'center' })
    doc.text('TRANSPORTE', cx, cabY + 14.5, { align: 'center' })

    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(sx + 2, cabY + 17, sx + sw - 2, cabY + 17)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', sx + 2, cabY + 23)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cx, cabY + 37, { align: 'center' })

    doc.setDrawColor(210, 210, 210)
    doc.setLineWidth(0.2)
    doc.line(sx + 2, cabY + 40, sx + sw - 2, cabY + 40)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '—'
    doc.text('Fecha:', sx + 2, cabY + 46)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...negro)
    doc.text(fechaStr, sx + 2, cabY + 51)
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
        doc.addImage(firmaData.firmaImagen, fmt(firmaData.firmaImagen), bx + 4, by + 4, sigW - 8, imgAreaH - 8)
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

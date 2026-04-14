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
    const { data } = await supabase.from('logos_config').select('id,url')
    if (data) {
      for (const row of data) {
        try {
          const b64 = await toBase64(row.url)
          if (row.id === 'comsa')    logoComsa   = b64
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  CABECERA — replica exacta del documento de referencia
  //  Altura: 24 mm (compacta)
  //  Zonas (mm): COMSA=18 | A9001=13 | A14001=13 | A45001=13 | A50001=13
  //              | PEFC=50 | SURE=36 | TÍTULO=34
  //  Total: 18+52+50+36+34 = 190 mm ✓
  // ═══════════════════════════════════════════════════════════════════════════

  const cabY = margen
  const cabH = 24

  // Borde exterior — sin divisores
  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.4)
  doc.rect(margen, cabY, contentW, cabH)

  // Posiciones X de cada zona
  const X = {
    comsa : margen,
    a1    : margen + 18,
    a2    : margen + 31,
    a3    : margen + 44,
    a4    : margen + 57,
    pefc  : margen + 70,
    sure  : margen + 120,
    titulo: margen + 156,
  }
  // Anchos
  const WZ = {
    comsa : 18,
    applus: 13,    // cada uno de los 4
    pefc  : 50,
    sure  : 36,
    titulo: 34,    // 190 - 156 = 34 mm
  }

  const CY = cabY + cabH / 2   // centro vertical de la cabecera

  // ── COMSA ──────────────────────────────────────────────────────────────────
  // Logo arriba + texto "COMSA / SERVICE" abajo (igual que referencia)
  const comsaLogoH = 11
  const comsaLogoW = 11
  const comsaLogoY = cabY + 2
  if (logoComsa) {
    addImgFit(logoComsa, X.comsa + (WZ.comsa - comsaLogoW) / 2, comsaLogoY, comsaLogoW, comsaLogoH)
  } else {
    // Placeholder cuadrado verde si no carga
    doc.setFillColor(29, 158, 117)
    doc.rect(X.comsa + (WZ.comsa - comsaLogoW) / 2, comsaLogoY, comsaLogoW, comsaLogoH, 'F')
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.5)
  doc.setTextColor(...grisOsc)
  doc.text('COMSA', X.comsa + WZ.comsa / 2, comsaLogoY + comsaLogoH + 3, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  doc.text('SERVICE', X.comsa + WZ.comsa / 2, comsaLogoY + comsaLogoH + 6, { align: 'center' })

  // ── 4 × APPLUS — mismo tamaño fijo para todos ──────────────────────────────
  // Ratio real logos Applus: ~1:1.82 (portrait). Altura fija = cabH - 4mm = 20mm
  const AH = cabH - 4          // 20 mm de alto
  const AW = AH * (1 / 1.82)   // ≈ 11 mm de ancho

  const drawApplus = (b64, x) => {
    if (!b64) return
    const lx = x + (WZ.applus - AW) / 2
    const ly = cabY + (cabH - AH) / 2
    try { doc.addImage(b64, fmt(b64), lx, ly, AW, AH) } catch {}
  }
  drawApplus(logoApplus1, X.a1)
  drawApplus(logoApplus2, X.a2)
  drawApplus(logoApplus3, X.a3)
  drawApplus(logoApplus4, X.a4)

  // ── PEFC — logo + bloque de texto ─────────────────────────────────────────
  {
    const sx = X.pefc, sw = WZ.pefc
    const lw = 15, lh = 18
    if (logoPefc) {
      addImgFit(logoPefc, sx + 2, cabY + (cabH - lh) / 2, lw, lh)
    }
    const tx = sx + lw + 4
    const lines = [
      { t: 'COMSA SERVICE',           b: false, s: 4.2 },
      { t: 'FACILITY MANAGEMENT SAU', b: false, s: 4.2 },
      { t: 'tiene una Cadena de',     b: false, s: 4.2 },
      { t: 'Custodia certificada',    b: false, s: 4.2 },
      { t: 'PEFC',                    b: true,  s: 6,   c: [0, 130, 60] },
      { t: 'PEFC/14-31-00318',        b: false, s: 4.2 },
      { t: 'www.pefc.es',             b: false, s: 4.2 },
    ]
    const lh2  = 2.9
    const tot  = (lines.length - 1) * lh2
    const sy   = cabY + (cabH - tot) / 2
    lines.forEach((l, i) => {
      doc.setFont('helvetica', l.b ? 'bold' : 'normal')
      doc.setFontSize(l.s)
      doc.setTextColor(...(l.c || grisOsc))
      doc.text(l.t, tx, sy + i * lh2)
    })
  }

  // ── SURE — logo + texto pequeño debajo ─────────────────────────────────────
  {
    const sx = X.sure, sw = WZ.sure
    const lw = sw - 4, lh = 12
    const ly  = cabY + 2
    if (logoSure) {
      addImgFit(logoSure, sx + 2, ly, lw, lh)
    }
    const txtLines = [
      'SUSTAINABLE RESOURCES',
      'Verification Scheme GmbH',
      'SURE EU/ES 001/ Z202 2281',
    ]
    const tsy = ly + lh + 1.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(3.8)
    doc.setTextColor(...grisOsc)
    txtLines.forEach((t, i) => doc.text(t, sx + sw / 2, tsy + i * 2.8, { align: 'center' }))
  }

  // ── TÍTULO ─────────────────────────────────────────────────────────────────
  {
    const sx = X.titulo, sw = WZ.titulo, cx = sx + sw / 2

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
    const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '__ / __ / ____'
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

  // 3 columnas iguales de 63,3mm — label derecha · valor izquierda en el centro
  const colW   = contentW / 3                // ≈ 63.3 mm
  const mid1   = margen + colW * 0.5         // centro col1
  const mid2   = margen + colW * 1.5         // centro col2
  const mid3   = margen + colW * 2.5         // centro col3
  const gap    = 1.5                         // mm entre label y valor

  const drawPesoGroup = (label, valor, midX) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...grisOsc)
    doc.text(label, midX - gap, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...negro)
    doc.text(valor, midX + gap, y, { align: 'left' })
  }

  drawPesoGroup('Peso Bruto', pb,   mid1)
  drawPesoGroup('Tara',       tara, mid2)
  drawPesoGroup('Peso Neto',  pn,   mid3)

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

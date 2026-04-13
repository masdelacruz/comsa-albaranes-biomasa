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

  // Detecta el formato real del data URL para jsPDF
  const fmt = (b64) => {
    if (!b64) return 'PNG'
    if (b64.startsWith('data:image/jpeg') || b64.startsWith('data:image/jpg')) return 'JPEG'
    if (b64.startsWith('data:image/webp')) return 'WEBP'
    return 'PNG'
  }

  // Dibuja imagen ajustada a un rectángulo (mantiene aspecto, centra dentro del área)
  const addImgFit = (b64, areaX, areaY, areaW, areaH) => {
    if (!b64) return
    try {
      // Obtener dimensiones naturales del imagen para calcular aspect ratio
      const props = doc.getImageProperties(b64)
      const ratio = props.width / props.height
      let iw, ih
      if (areaW / areaH > ratio) {
        // área más ancha que la imagen → ajustar por altura
        ih = areaH
        iw = ih * ratio
      } else {
        // área más alta que la imagen → ajustar por ancho
        iw = areaW
        ih = iw / ratio
      }
      const ix = areaX + (areaW - iw) / 2
      const iy = areaY + (areaH - ih) / 2
      doc.addImage(b64, fmt(b64), ix, iy, iw, ih)
    } catch {}
  }

  // ── carga de logos ─────────────────────────────────────────────────────────

  let logoComsa
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}

  // applus_1=ISO9001 · applus_2=ISO14001 · applus_3=ISO45001 · applus_4=ISO50001
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

  // ── CABECERA ─────────────────────────────────────────────────────────────────
  //  UNA sola fila horizontal. Sin divisores. Sin fondos. Solo borde exterior.
  //  Layout (mm): COMSA(20) | A9001(18) | A14001(18) | A45001(18) | A50001(18)
  //               | PEFC(20) | SURE(24) | Título(54) = 190 mm ✓
  const cabY = margen
  const cabH = 38     // altura: suficiente para logos portrait con padding
  const pad  = 3      // padding interior por logo

  // Solo borde exterior, fondo blanco (sin relleno = blanco)
  doc.setDrawColor(170, 170, 170)
  doc.setLineWidth(0.4)
  doc.rect(margen, cabY, contentW, cabH)

  // Zonas horizontales — cada logo en su área
  //  x0=COMSA  x1=A1  x2=A2  x3=A3  x4=A4  x5=PEFC  x6=SURE  x7=Título
  const zones = [
    { w: 20 },   // 0 COMSA
    { w: 18 },   // 1 Applus ISO 9001
    { w: 18 },   // 2 Applus ISO 14001
    { w: 18 },   // 3 Applus ISO 45001
    { w: 18 },   // 4 Applus ISO 50001
    { w: 20 },   // 5 PEFC
    { w: 24 },   // 6 SURE
    { w: contentW - 20 - 18*4 - 20 - 24 },  // 7 Título (= 54 mm)
  ]
  let zx = margen
  zones.forEach(z => { z.x = zx; zx += z.w })

  const drawLogoZone = (logo, zi) => {
    const z = zones[zi]
    addImgFit(logo, z.x + pad, cabY + pad, z.w - pad * 2, cabH - pad * 2)
  }

  // Logos: COMSA | 4×Applus (9001→50001) | PEFC | SURE
  drawLogoZone(logoComsa,   0)
  drawLogoZone(logoApplus1, 1)
  drawLogoZone(logoApplus2, 2)
  drawLogoZone(logoApplus3, 3)
  drawLogoZone(logoApplus4, 4)
  drawLogoZone(logoPefc,    5)
  drawLogoZone(logoSure,    6)

  // ── Zona Título ─────────────────────────────────────────────────────────────
  {
    const z = zones[7]
    const cx = z.x + z.w / 2

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...negro)
    doc.text('ALBARÁN DE', cx, cabY + 8, { align: 'center' })
    doc.text('TRANSPORTE', cx, cabY + 13.5, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(z.x + 2, cabY + 16, z.x + z.w - 2, cabY + 16)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', z.x + 3, cabY + 20)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cx, cabY + 30, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(z.x + 2, cabY + 32, z.x + z.w - 2, cabY + 32)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.5)
    doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '—'
    doc.text(`Fecha:  ${fechaStr}`, z.x + 3, cabY + 36)
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

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

  // Ajusta imagen a un área manteniendo aspect ratio real
  const addImgFit = (b64, ax, ay, aw, ah) => {
    if (!b64) return
    try {
      const p  = doc.getImageProperties(b64)
      const r  = p.width / p.height
      let iw, ih
      if (aw / ah >= r) { ih = ah; iw = ih * r } else { iw = aw; ih = iw / r }
      doc.addImage(b64, fmt(b64), ax + (aw - iw) / 2, ay + (ah - ih) / 2, iw, ih)
    } catch {}
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

  // ── CABECERA ─────────────────────────────────────────────────────────────────
  //  Una fila: COMSA(20) | A9001(16)×4=64 | PEFC(20) | SURE(24) | Título(62) = 190mm
  const cabY = margen
  const cabH = 44    // altura total de la cabecera
  const pad  = 2     // padding interior de cada logo

  // Borde exterior, fondo blanco
  doc.setDrawColor(170, 170, 170)
  doc.setLineWidth(0.4)
  doc.rect(margen, cabY, contentW, cabH)

  // Zonas X
  const Z_COMSA  = { x: margen,       w: 20 }
  const Z_A1     = { x: margen + 20,  w: 16 }
  const Z_A2     = { x: margen + 36,  w: 16 }
  const Z_A3     = { x: margen + 52,  w: 16 }
  const Z_A4     = { x: margen + 68,  w: 16 }
  const Z_PEFC   = { x: margen + 84,  w: 20 }
  const Z_SURE   = { x: margen + 104, w: 24 }
  const Z_TITULO = { x: margen + 128, w: 62 }  // 190 - 128 = 62 mm

  // Helper: dibuja logo en zona con padding uniforme
  const logoZone = (b64, z) => addImgFit(b64, z.x + pad, cabY + pad, z.w - pad * 2, cabH - pad * 2)

  // COMSA
  logoZone(logoComsa, Z_COMSA)

  // Applus: tamaño FIJO igual para los 4 (ratio 1:1.82 de los logos reales)
  // Calculamos una vez con el primer logo disponible, aplicamos a todos
  const applusRatio = 1 / 1.82   // ancho/alto
  const applusH = cabH - pad * 2  // 40mm
  const applusW = applusH * applusRatio  // ≈ 22mm → recortamos a la zona (16-4=12mm)
  const applusWFit = Math.min(applusW, Z_A1.w - pad * 2)  // cabe en slot
  const applusHFit = applusWFit / applusRatio

  const drawApplus = (b64, z) => {
    if (!b64) return
    const lx = z.x + (z.w - applusWFit) / 2
    const ly = cabY + (cabH - applusHFit) / 2
    try { doc.addImage(b64, fmt(b64), lx, ly, applusWFit, applusHFit) } catch {}
  }

  drawApplus(logoApplus1, Z_A1)
  drawApplus(logoApplus2, Z_A2)
  drawApplus(logoApplus3, Z_A3)
  drawApplus(logoApplus4, Z_A4)

  // PEFC y SURE
  logoZone(logoPefc, Z_PEFC)
  logoZone(logoSure, Z_SURE)

  // ── Zona Título ─────────────────────────────────────────────────────────────
  {
    const zx = Z_TITULO.x
    const zw = Z_TITULO.w
    const cx = zx + zw / 2

    // Línea separadora izquierda muy suave
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(zx, cabY + 2, zx, cabY + cabH - 2)

    // "ALBARÁN DE TRANSPORTE" — UNA SOLA LÍNEA
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...negro)
    doc.text('ALBARÁN DE TRANSPORTE', cx, cabY + 9, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(zx + 2, cabY + 12, zx + zw - 2, cabY + 12)

    // Nº albarán
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', zx + 3, cabY + 17)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cx, cabY + 30, { align: 'center' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(zx + 2, cabY + 33, zx + zw - 2, cabY + 33)

    // Fecha — tamaño visible
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha.split('-').reverse().join('/') : '—'
    doc.text(`Fecha:  ${fechaStr}`, zx + 3, cabY + 40)
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

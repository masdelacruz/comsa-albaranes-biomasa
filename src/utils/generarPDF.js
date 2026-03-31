import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export async function generarPDF(a) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const verde = [29, 158, 117]
  const grisOsc = [60, 60, 60]
  const grisClaro = [240, 240, 240]
  const negro = [20, 20, 20]

  const toBase64 = (url) => fetch(url).then(r => r.blob()).then(b => new Promise(res => {
    const reader = new FileReader()
    reader.onloadend = () => res(reader.result)
    reader.readAsDataURL(b)
  }))

  let logoPefc, logoSure
  try { logoPefc = await toBase64('/logo-pefc.png') } catch {}
  try { logoSure  = await toBase64('/logo-sure.jpg') } catch {}

  // Calcular altura cabecera según logos disponibles
  const altCab = 32

  // CABECERA fondo verde
  doc.setFillColor(...verde)
  doc.rect(0, 0, W, altCab, 'F')

  // Logo Comsa con formas geométricas (proporciones reales)
  doc.setFillColor(255, 255, 255)
  doc.circle(8, 9, 4.5, 'F')
  doc.rect(14, 4.5, 8, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('COMSA', 5, 22)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('SERVICE', 6.5, 27)

  // Texto empresa
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('COMSA SERVICE', 30, 12)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('FACILITY MANAGEMENT SAU', 30, 18)
  doc.text('C/ Vallès, 2 · Pol. Ind. Almeda · 08940 Cornellà de Llobregat', 30, 24)

  // Logos certificación — siempre ambos, tamaño natural proporcional
  // PEFC: ratio original ~1.3:1 (ancho:alto) → 28x22mm
  if (logoPefc) doc.addImage(logoPefc, 'PNG', 140, 1, 28, 30)
  // SURE: ratio original ~1.4:1 → 26x18mm
  if (logoSure) doc.addImage(logoSure, 'JPG', 170, 5, 26, 19)

  // TÍTULO
  doc.setFillColor(...grisClaro)
  doc.rect(0, altCab, W, 10, 'F')
  doc.setTextColor(...negro)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ALBARÁN DE TRANSPORTE', W / 2, altCab + 7, { align: 'center' })

  let y = altCab + 14

  // Nº albarán y fecha
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Nº albarán: ${a.id}`, 14, y)
  doc.text(`Fecha: ${a.fecha ? a.fecha.split('-').reverse().join('/') : '___/___/______'}`, 130, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...grisOsc)

  // Tipo + certificación como checkboxes visuales
  const cert = a.certificacion || ''
  const tienePEFC = cert.includes('PEFC')
  const tieneSURE = cert.includes('SURE')

  doc.text(`${a.tipo || ''}`, 14, y)

  // Checkboxes visuales PEFC y SURE
  let xCheck = 120
  doc.rect(xCheck, y - 3.5, 3.5, 3.5)
  if (tienePEFC) { doc.setFont('helvetica', 'bold'); doc.text('✓', xCheck + 0.3, y - 0.3) }
  doc.setFont('helvetica', 'normal')
  doc.text('PEFC', xCheck + 4.5, y)

  xCheck += 20
  doc.rect(xCheck, y - 3.5, 3.5, 3.5)
  if (tieneSURE) { doc.setFont('helvetica', 'bold'); doc.text('✓', xCheck + 0.3, y - 0.3) }
  doc.setFont('helvetica', 'normal')
  doc.text('SURE', xCheck + 4.5, y)

  y += 6

  // TABLA PRINCIPAL
  autoTable(doc, {
    startY: y,
    head: [],
    body: [
      ['Transportista', a.transportista || '', 'Proveedor', a.proveedor || ''],
      ['Matrícula tractora', a.matriculaTractora || '', 'Tipos de madera', a.tipoBiomasa || ''],
      ['Matrícula remolque', a.matriculaRemolque || '', 'Especie', a.especie || ''],
      ['Chófer', a.chofer || '', 'Astilladora', a.astilladora || ''],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: negro },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, cellWidth: 38 },
      1: { cellWidth: 60 },
      2: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, cellWidth: 38 },
      3: { cellWidth: 56 },
    },
    margin: { left: 14, right: 14 },
  })

  y = doc.lastAutoTable.finalY + 6

  // Línea separadora
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(14, y, W - 14, y)
  y += 6

  // Pesos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', 14, y)
  doc.text('Tara', 85, y)
  doc.text('Peso Neto', 155, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  const pb   = a.pesada?.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '_______________'
  const tara = a.pesada?.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : '_______________'
  const pn   = a.pesada?.entrada && a.pesada?.salida
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '_______________'
  doc.text(pb,   38, y)
  doc.text(tara, 100, y)
  doc.text(pn,   172, y)

  y += 8
  doc.line(14, y, W - 14, y)
  y += 6

  // Origen / Destino
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Origen:', 14, y)
  doc.text('Destino:', 110, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.origen || '___________________________', 30, y)
  doc.text(a.instalacion || '___________________________', 126, y)

  y += 8
  doc.line(14, y, W - 14, y)
  y += 6

  // Permiso / Humedad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Permiso / Ref.:', 14, y)
  doc.text('Humedad (%):', 110, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.text(a.permiso || '___________________________', 46, y)
  doc.text(a.pesada?.humedad != null ? `${a.pesada.humedad}%` : '___________', 140, y)

  y += 8
  doc.line(14, y, W - 14, y)
  y += 6

  // Observaciones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Observaciones:', 14, y)
  y += 5
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(250, 250, 250)
  doc.rect(14, y, W - 28, 18, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  doc.setFontSize(8)
  if (a.observaciones) doc.text(a.observaciones, 16, y + 5, { maxWidth: W - 32 })

  y += 24

  // FIRMAS
  const esOp1 = a.tipo?.includes('1')
  const bloquesFirma = esOp1
    ? [
        { label: 'Firma Proveedor',             key: 'proveedor',   actor: a.proveedor },
        { label: 'Firma Astilladora (Origen)',   key: 'astilladora', actor: a.astilladora },
        { label: 'Firma Transportista',          key: 'camionero',   actor: a.transportista },
        { label: 'Firma Instalación (Destino)',  key: 'instalacion', actor: a.instalacion },
      ]
    : [
        { label: 'Firma Proveedor (Origen)',     key: 'proveedor',   actor: a.proveedor },
        { label: 'Firma Instalación (Destino)',  key: 'instalacion', actor: a.instalacion },
      ]

  const numBloques  = bloquesFirma.length
  const anchoBloque = (W - 28) / numBloques
  const alturaFirma = 40

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)

  bloquesFirma.forEach((bloque, i) => {
    const x = 14 + i * anchoBloque
    doc.rect(x, y, anchoBloque, alturaFirma)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...grisOsc)
    doc.text(bloque.label, x + anchoBloque / 2, y + 5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(130, 130, 130)
    doc.text(bloque.actor || '', x + anchoBloque / 2, y + 10, { align: 'center' })

    const firma = a.firmas?.[bloque.key]
    if (firma?.firmado) {
      if (firma.firmaImagen) {
        try { doc.addImage(firma.firmaImagen, 'PNG', x + 4, y + 13, anchoBloque - 8, 18) } catch {}
      }
      doc.setTextColor(29, 158, 117)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.text('✓ FIRMADO', x + anchoBloque / 2, y + 34, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(130, 130, 130)
      doc.text(firma.fecha || '', x + anchoBloque / 2, y + 38, { align: 'center' })
    }
  })

  y += alturaFirma + 8

  // PIE
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Documento generado el ${new Date().toLocaleString('es-ES')} · COMSA SERVICE FACILITY MANAGEMENT SAU · PEFC/14-31-00318`,
    W / 2, y + 4, { align: 'center' }
  )

  doc.save(`${a.id}_albaran_comsa.pdf`)
}
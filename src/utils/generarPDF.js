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

  let logoComsa, logoPefc, logoSure
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}
  try { logoPefc  = await toBase64('/logo-pefc.png')  } catch {}
  try { logoSure  = await toBase64('/logo-sure.jpg')  } catch {}

  // CABECERA
  doc.setFillColor(...verde)
  doc.rect(0, 0, W, 28, 'F')

  if (logoComsa) {
    doc.addImage(logoComsa, 'PNG', 6, 3, 22, 22)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('COMSA SERVICE', 32, 11)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('FACILITY MANAGEMENT SAU', 32, 16)
  doc.text('C/ Vallès, 2 · Pol. Ind. Almeda · 08940 Cornellà de Llobregat', 32, 21)

  // Logos certificación
  let xLogo = 130
  const cert = a.certificacion || 'PEFC'
  if ((cert === 'PEFC' || cert === 'Ambas') && logoPefc) {
    doc.addImage(logoPefc, 'PNG', xLogo, 2, 30, 24)
    xLogo += 34
  }
  if ((cert === 'SURE' || cert === 'Ambas') && logoSure) {
    doc.addImage(logoSure, 'JPG', xLogo, 4, 22, 20)
  }

  // Título albarán
  doc.setFillColor(...grisClaro)
  doc.rect(0, 28, W, 10, 'F')
  doc.setTextColor(...negro)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ALBARÁN DE TRANSPORTE', W / 2, 35, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Nº albarán: ${a.id}`, 14, 43)
  doc.text(`Fecha: ${a.fecha ? a.fecha.split('-').reverse().join('/') : '___/___/______'}`, 120, 43)

  // Tipo operación + certificación
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...grisOsc)
  const certTexto = cert === 'Ninguna' ? '' : `Certificación: ${cert}`
  doc.text(`${a.tipo || ''}   ${certTexto}`, 14, 49)

  // TABLA PRINCIPAL
  autoTable(doc, {
    startY: 52,
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

  let y = doc.lastAutoTable.finalY + 6

  // Pesos
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(14, y, W - 14, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', 14, y)
  doc.text('Tara', 85, y)
  doc.text('Peso Neto', 155, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  const pb = a.pesada?.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '_______________'
  const tara = a.pesada?.salida ? a.pesada.salida.toLocaleString('es-ES') + ' kg' : '_______________'
  const pn = a.pesada?.entrada && a.pesada?.salida
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '_______________'
  doc.text(pb,   40, y)
  doc.text(tara, 105, y)
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
        { label: 'Firma Proveedor', key: 'proveedor', actor: a.proveedor },
        { label: 'Firma Astilladora (Origen)', key: 'astilladora', actor: a.astilladora },
        { label: 'Firma Transportista', key: 'camionero', actor: a.transportista },
        { label: 'Firma Instalación (Destino)', key: 'instalacion', actor: a.instalacion },
      ]
    : [
        { label: 'Firma Proveedor (Origen)', key: 'proveedor', actor: a.proveedor },
        { label: 'Firma Instalación (Destino)', key: 'instalacion', actor: a.instalacion },
      ]

  const numBloques = bloquesFirma.length
  const anchoBloque = (W - 28) / numBloques
  const alturaFirma = 36

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
      doc.setTextColor(29, 158, 117)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('✓ FIRMADO', x + anchoBloque / 2, y + 20, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(130, 130, 130)
      doc.text(firma.fecha || '', x + anchoBloque / 2, y + 25, { align: 'center' })

      if (firma.firmaImagen) {
        try {
          doc.addImage(firma.firmaImagen, 'PNG', x + 4, y + 14, anchoBloque - 8, 16)
        } catch {}
      }
    }
  })

  y += alturaFirma + 8

  // Pie
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text(`Documento generado el ${new Date().toLocaleString('es-ES')} · COMSA SERVICE FACILITY MANAGEMENT SAU · PEFC/14-31-00318`, W / 2, y + 4, { align: 'center' })

  doc.save(`${a.id}_albaran_comsa.pdf`)
}import jsPDF from 'jspdf'
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

  let logoComsa, logoPefc, logoSure
  try { logoComsa = await toBase64('/logo-comsa.png') } catch {}
  try { logoPefc  = await toBase64('/logo-pefc.png')  } catch {}
  try { logoSure  = await toBase64('/logo-sure.jpg')  } catch {}

  // CABECERA
  doc.setFillColor(...verde)
  doc.rect(0, 0, W, 28, 'F')

  if (logoComsa) {
    doc.addImage(logoComsa, 'PNG', 6, 3, 22, 22)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('COMSA SERVICE', 32, 11)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('FACILITY MANAGEMENT SAU', 32, 16)
  doc.text('C/ Vallès, 2 · Pol. Ind. Almeda · 08940 Cornellà de Llobregat', 32, 21)

  // Logos certificación
  let xLogo = 130
  const cert = a.certificacion || 'PEFC'
  if ((cert === 'PEFC' || cert === 'Ambas') && logoPefc) {
    doc.addImage(logoPefc, 'PNG', xLogo, 2, 30, 24)
    xLogo += 34
  }
  if ((cert === 'SURE' || cert === 'Ambas') && logoSure) {
    doc.addImage(logoSure, 'JPG', xLogo, 4, 22, 20)
  }

  // Título albarán
  doc.setFillColor(...grisClaro)
  doc.rect(0, 28, W, 10, 'F')
  doc.setTextColor(...negro)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ALBARÁN DE TRANSPORTE', W / 2, 35, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Nº albarán: ${a.id}`, 14, 43)
  doc.text(`Fecha: ${a.fecha ? a.fecha.split('-').reverse().join('/') : '___/___/______'}`, 120, 43)

  // Tipo operación + certificación
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...grisOsc)
  const certTexto = cert === 'Ninguna' ? '' : `Certificación: ${cert}`
  doc.text(`${a.tipo || ''}   ${certTexto}`, 14, 49)

  // TABLA PRINCIPAL
  autoTable(doc, {
    startY: 52,
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

  let y = doc.lastAutoTable.finalY + 6

  // Pesos
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(14, y, W - 14, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...grisOsc)
  doc.text('Peso Bruto', 14, y)
  doc.text('Tara', 85, y)
  doc.text('Peso Neto', 155, y)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...negro)
  const pb = a.pesada?.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '_______________'
  const tara = a.pesada?.salida ? a.pesada.salida.toLocaleString('es-ES') + ' kg' : '_______________'
  const pn = a.pesada?.entrada && a.pesada?.salida
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '_______________'
  doc.text(pb,   40, y)
  doc.text(tara, 105, y)
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
        { label: 'Firma Proveedor', key: 'proveedor', actor: a.proveedor },
        { label: 'Firma Astilladora (Origen)', key: 'astilladora', actor: a.astilladora },
        { label: 'Firma Transportista', key: 'camionero', actor: a.transportista },
        { label: 'Firma Instalación (Destino)', key: 'instalacion', actor: a.instalacion },
      ]
    : [
        { label: 'Firma Proveedor (Origen)', key: 'proveedor', actor: a.proveedor },
        { label: 'Firma Instalación (Destino)', key: 'instalacion', actor: a.instalacion },
      ]

  const numBloques = bloquesFirma.length
  const anchoBloque = (W - 28) / numBloques
  const alturaFirma = 36

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
      doc.setTextColor(29, 158, 117)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('✓ FIRMADO', x + anchoBloque / 2, y + 20, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(130, 130, 130)
      doc.text(firma.fecha || '', x + anchoBloque / 2, y + 25, { align: 'center' })

      if (firma.firmaImagen) {
        try {
          doc.addImage(firma.firmaImagen, 'PNG', x + 4, y + 14, anchoBloque - 8, 16)
        } catch {}
      }
    }
  })

  y += alturaFirma + 8

  // Pie
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.setFont('helvetica', 'normal')
  doc.text(`Documento generado el ${new Date().toLocaleString('es-ES')} · COMSA SERVICE FACILITY MANAGEMENT SAU · PEFC/14-31-00318`, W / 2, y + 4, { align: 'center' })

  doc.save(`${a.id}_albaran_comsa.pdf`)
}
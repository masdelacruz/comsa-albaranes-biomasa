import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generarPDF(a) {
  const doc = new jsPDF()
  const verde = [29, 158, 117]
  const gris  = [90, 88, 82]
  const negro = [26, 25, 23]

  doc.setFillColor(...verde)
  doc.rect(0, 0, 210, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('COMSA SERVICE — Albarán de biomasa', 14, 11)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${a.id}`, 196, 11, { align: 'right' })

  doc.setTextColor(...negro)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`Albarán: ${a.id}`, 14, 28)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gris)
  doc.text(`Fecha: ${a.fecha.split('-').reverse().join('/')} · ${a.hora}h`, 14, 34)
  doc.text(`Tipo operación: ${a.tipo}`, 14, 40)
  doc.text(`Nº camiones aprox.: ${a.numCamiones}`, 14, 46)

  doc.setDrawColor(220, 222, 218)
  doc.line(14, 52, 196, 52)

  autoTable(doc, {
    startY: 56,
    head: [['Campo', 'Valor']],
    body: [
      ['Astilladora',         a.astilladora],
      ['Transportista',       a.transportista],
      ['Instalación destino', a.instalacion],
      ['Especie',             a.especie],
      ['Tipo biomasa',        a.tipoBiomasa],
      ['Origen biomasa',      a.origen || '—'],
      ['Permiso / Ref.',      a.permiso || '—'],
      ['Observaciones',       a.observaciones || '—'],
    ],
    headStyles: { fillColor: verde, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: negro },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold', textColor: gris }, 1: { cellWidth: 130 } },
    margin: { left: 14, right: 14 },
  })

  const y1 = doc.lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...negro)
  doc.setFontSize(9)
  doc.text('Datos de recepción y pesada', 14, y1)

  autoTable(doc, {
    startY: y1 + 4,
    head: [['Peso entrada', 'Peso salida (tara)', 'Peso neto', 'Humedad (%)', 'Ticket adjunto']],
    body: [[
      a.pesada.entrada ? a.pesada.entrada.toLocaleString('es-ES') + ' kg' : '—',
      a.pesada.salida  ? a.pesada.salida.toLocaleString('es-ES')  + ' kg' : '—',
      a.pesada.entrada && a.pesada.salida
        ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '—',
      a.pesada.humedad != null ? `${a.pesada.humedad}%` : 'Pendiente',
      a.pesada.ticketAdjunto ? 'Sí' : 'No',
    ]],
    headStyles: { fillColor: verde, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: negro },
    margin: { left: 14, right: 14 },
  })

  const y2 = doc.lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...negro)
  doc.setFontSize(9)
  doc.text('Estado de firmas', 14, y2)

  const firmasData = [
    ['Oficina',     a.firmas.oficina?.actor     || '—', a.firmas.oficina?.firmado     ? 'FIRMADO' : 'PENDIENTE', a.firmas.oficina?.fecha     || '—'],
    ['Astilladora', a.firmas.astilladora?.actor || '—', a.firmas.astilladora?.firmado ? 'FIRMADO' : 'PENDIENTE', a.firmas.astilladora?.fecha || '—'],
    ['Camionero',   a.firmas.camionero?.actor   || '—', a.firmas.camionero?.firmado   ? 'FIRMADO' : 'PENDIENTE', a.firmas.camionero?.fecha   || '—'],
    ['Instalación', a.firmas.instalacion?.actor || '—', a.firmas.instalacion?.firmado ? 'FIRMADO' : 'PENDIENTE', a.firmas.instalacion?.fecha || '—'],
  ]

  autoTable(doc, {
    startY: y2 + 4,
    head: [['Rol', 'Actor', 'Estado', 'Fecha firma']],
    body: firmasData,
    headStyles: { fillColor: verde, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: negro },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold', textColor: gris },
      1: { cellWidth: 60 },
      2: { cellWidth: 28, fontStyle: 'bold' },
      3: { cellWidth: 64 },
    },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === 'body') {
        data.cell.styles.textColor = data.cell.raw === 'FIRMADO' ? verde : [181, 122, 16]
      }
    },
    margin: { left: 14, right: 14 },
  })

  const y3 = doc.lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...negro)
  doc.setFontSize(9)
  doc.text('Documentación adjunta', 14, y3)

  const docsData = Object.entries(a.docs).map(([k, v]) => [k, v ? 'Adjunto ✓' : 'Pendiente'])

  autoTable(doc, {
    startY: y3 + 4,
    head: [['Documento', 'Estado']],
    body: docsData,
    headStyles: { fillColor: verde, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: negro },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.column.index === 1 && data.section === 'body') {
        data.cell.styles.textColor = data.cell.raw?.includes('✓') ? verde : [181, 122, 16]
      }
    },
    margin: { left: 14, right: 14 },
  })

  const y4 = doc.lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...negro)
  doc.setFontSize(9)
  doc.text('Actividad y trazabilidad', 14, y4)

  autoTable(doc, {
    startY: y4 + 4,
    head: [['Fecha / Hora', 'Evento', 'Actor']],
    body: a.actividad.map(ev => [ev.ts, ev.texto, ev.actor]),
    headStyles: { fillColor: verde, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: negro },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 96 },
      2: { cellWidth: 46 },
    },
    margin: { left: 14, right: 14 },
  })

  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(7)
  doc.setTextColor(...gris)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Documento generado el ${new Date().toLocaleString('es-ES')} · Comsa Service · Gestión de albaranes de biomasa`,
    105, pageHeight - 8, { align: 'center' }
  )

  doc.save(`${a.id}_albaran_comsa.pdf`)
}
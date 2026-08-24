import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { api } from '../lib/api'
import { toBase64, fmt } from './pdfHelpers'
import { dibujarAlbaranPDF } from './pdfDraw'

// ── caché de logos ──────────────────────────────────────────────────────────
// Los logos institucionales (Comsa, Applus×4, PEFC, SURE) casi nunca cambian,
// pero antes se pedían a /storage/logos y se convertían a base64 EN CADA
// PDF generado — con hasta 7 fetches secuenciales por descarga. Eso hacía
// que exportar varios albaranes seguidos (p.ej. desde Historial) fuera muy
// lento. Ahora se cargan una sola vez por sesión (promesa memoizada) y las
// conversiones a base64 se hacen en paralelo, no una a una.
const LOGO_IDS = { comsa: 'logoComsa', applus_1: 'logoApplus1', applus_2: 'logoApplus2', applus_3: 'logoApplus3', applus_4: 'logoApplus4', pefc: 'logoPefc', sure: 'logoSure' }
let logosCachePromise = null

export function cargarLogos() {
  if (logosCachePromise) return logosCachePromise
  logosCachePromise = (async () => {
    const vacio = Object.fromEntries(Object.values(LOGO_IDS).map(v => [v, null]))
    try {
      const map = await api.get('/storage/logos')
      if (!map) return vacio
      const entries = await Promise.all(
        Object.entries(LOGO_IDS).map(async ([id, varName]) => {
          if (!map[id]) return [varName, null]
          try { return [varName, await toBase64(map[id])] } catch { return [varName, null] }
        })
      )
      return Object.fromEntries(entries)
    } catch {
      return vacio
    }
  })()
  // Si la carga falla del todo, no dejamos la promesa fallida en caché:
  // permite reintentar en la siguiente llamada.
  logosCachePromise.catch(() => { logosCachePromise = null })
  return logosCachePromise
}

// ── worker de dibujo ─────────────────────────────────────────────────────────
// jsPDF/autoTable dibujan de forma síncrona y bloquean el hilo donde corren.
// En el hilo principal eso deja el loader de "Generando PDF..." congelado
// mientras dura (verificado). Se ejecuta en un Web Worker dedicado (ver
// pdfDraw.js / pdfWorker.js) para que el hilo principal —y su animación—
// queden libres durante toda la generación. cargarLogos() sigue en el hilo
// principal porque necesita localStorage (token de auth), algo que un worker
// no tiene: los logos ya resueltos se le pasan al worker por mensaje.
let worker = null
let nextId = 1
const pendientes = new Map()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./pdfWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, ok, buffer, nombre, error } = e.data
      const p = pendientes.get(id)
      if (!p) return
      pendientes.delete(id)
      if (ok) p.resolve({ buffer, nombre })
      else p.reject(new Error(error))
    }
    worker.onerror = (e) => {
      // Si el worker falla al arrancar (p.ej. error de carga del script),
      // no dejamos las peticiones colgadas: cada llamador tiene su propio
      // fallback síncrono en el hilo principal (ver dibujarEnWorkerOFallback).
      for (const [, p] of pendientes) p.reject(new Error(e.message || 'Error en el worker de PDF'))
      pendientes.clear()
    }
  }
  return worker
}

function dibujarEnWorker(a, options, logos) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pendientes.set(id, { resolve, reject })
    getWorker().postMessage({ id, a, options, logos })
  })
}

// Si por lo que sea el worker no está disponible (navegador muy antiguo,
// script bloqueado...), dibuja igualmente en el hilo principal: más lento
// y sin animación fluida, pero el PDF se sigue generando.
async function dibujarEnWorkerOFallback(a, options, logos) {
  try {
    return await dibujarEnWorker(a, options, logos)
  } catch {
    return dibujarAlbaranPDF(a, options, logos)
  }
}

export async function generarPDF(a, options = {}) {
  const { preview = false } = options
  const logos = await cargarLogos()
  const { buffer, nombre } = await dibujarEnWorkerOFallback(a, options, logos)
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)

  // En modo preview devolvemos la blob URL para mostrarla embebida en un
  // <iframe> dentro de la propia página (más rápido y sin abrir pestaña
  // nueva); el llamador decide cómo mostrarla.
  if (preview) {
    return { url, nombre }
  }
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  link.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALBARÁN A5 HORIZONTAL (210 × 148 mm) — formato físico real
// ─────────────────────────────────────────────────────────────────────────────
export async function generarPDFA5(a) {
  const doc      = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' })
  const W        = 210
  const margen   = 7
  const contentW = W - margen * 2   // 196 mm
  const grisOsc  = [80, 80, 80]
  const grisClaro = [242, 242, 242]
  const negro    = [20, 20, 20]

  // ── helpers ─────────────────────────────────────────────────────────────────
  const addImgFit = (b64, ax, ay, aw, ah) => {
    if (!b64) return
    try {
      const p = doc.getImageProperties(b64)
      const r = p.width / p.height
      let iw, ih
      if (aw / ah >= r) { ih = ah; iw = ih * r } else { iw = aw; ih = iw / r }
      doc.addImage(b64, fmt(b64), ax + (aw - iw) / 2, ay + (ah - ih) / 2, iw, ih)
    } catch {
      try { doc.addImage(b64, fmt(b64), ax, ay, aw, ah) } catch {}
    }
  }

  // ── carga de logos (cacheada, ver cargarLogos arriba) ──────────────────────
  const { logoComsa, logoApplus1, logoApplus2, logoApplus3, logoApplus4, logoPefc, logoSure } = await cargarLogos()

  // ── CABECERA (16 mm) ───────────────────────────────────────────────────────
  const cabY = margen
  const cabH = 16
  const LH   = cabH - 3   // 13 mm altura logos

  doc.setDrawColor(150, 150, 150)
  doc.setLineWidth(0.4)
  doc.rect(margen, cabY, contentW, cabH)

  const logosAreaW = 156
  const logoY0     = cabY + (cabH - LH) / 2
  const AslotW     = 14

  const logoW = (b64, maxW = 60) => {
    if (!b64) return 0
    try { const p = doc.getImageProperties(b64); return Math.min((p.width / p.height) * LH, maxW) }
    catch { return maxW }
  }
  const wComsa  = logoW(logoComsa, 22)
  const wApplus = AslotW
  const wPefc   = logoW(logoPefc,  48)
  const wSure   = logoW(logoSure,  68)
  const totalW  = wComsa + 4 * wApplus + wPefc + wSure
  const gap     = (logosAreaW - totalW) / 5

  let cx = margen + gap
  addImgFit(logoComsa, cx, logoY0, wComsa, LH);  cx += wComsa + gap
  ;[logoApplus1, logoApplus2, logoApplus3, logoApplus4].forEach(l => { addImgFit(l, cx, logoY0, wApplus, LH); cx += wApplus })
  cx += gap
  addImgFit(logoPefc, cx, logoY0, wPefc, LH);  cx += wPefc + gap
  addImgFit(logoSure, cx, logoY0, wSure, LH)

  // Bloque título (derecha)
  {
    const tituloX = margen + logosAreaW
    const sw = contentW - logosAreaW   // ~40 mm
    const sx = tituloX, cxT = sx + sw / 2
    doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2)
    doc.line(sx, cabY + 1, sx, cabY + cabH - 1)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...negro)
    doc.text('ALBARÁN DE TRANSPORTE', cxT, cabY + 4, { align: 'center' })
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15)
    doc.line(sx + 2, cabY + 5.5, sx + sw - 2, cabY + 5.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5); doc.setTextColor(...grisOsc)
    doc.text('Nº albarán:', sx + 2, cabY + 8.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(200, 30, 30)
    doc.text(String(a.id ?? ''), cxT, cabY + 13.5, { align: 'center' })
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15)
    doc.line(sx + 2, cabY + 14.5, sx + sw - 2, cabY + 14.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(...grisOsc)
    const fechaStr = a.fecha ? a.fecha.slice(0,10).split('-').reverse().join('/') : '__ / __ / ____'
    doc.text(`Fecha: ${fechaStr}`, sx + 2, cabY + cabH - 1.5)
  }

  // ── TABLA DE DATOS ─────────────────────────────────────────────────────────
  let y = cabY + cabH + 3

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
    styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: negro },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, halign: 'right', cellWidth: 34 },
      1: { cellWidth: 64 },
      2: { fontStyle: 'bold', fillColor: grisClaro, textColor: grisOsc, halign: 'right', cellWidth: 34 },
      3: { cellWidth: 64 },
    },
    margin: { left: margen, right: margen },
  })

  y = doc.lastAutoTable.finalY + 3

  // ── PESOS ──────────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3)
  doc.line(margen, y, W - margen, y); y += 5

  const pb   = a.pesada?.entrada ? Number(a.pesada.entrada).toLocaleString('es-ES') + ' kg' : '...................'
  const tara = a.pesada?.salida  ? Number(a.pesada.salida).toLocaleString('es-ES')  + ' kg' : '...................'
  const pn   = (a.pesada?.entrada && a.pesada?.salida)
    ? (a.pesada.entrada - a.pesada.salida).toLocaleString('es-ES') + ' kg' : '...................'

  doc.setFontSize(8); const sp = 1.5

  doc.setFont('helvetica', 'bold'); const pbLW = doc.getTextWidth('Peso Bruto')
  doc.setTextColor(...grisOsc); doc.text('Peso Bruto', margen, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro)
  doc.text(pb, margen + pbLW + sp, y)

  doc.setFont('helvetica', 'bold'); const taraLW = doc.getTextWidth('Tara')
  doc.setFont('helvetica', 'normal'); const taraVW = doc.getTextWidth(tara)
  const taraX = W / 2 - (taraLW + sp + taraVW) / 2
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...grisOsc); doc.text('Tara', taraX, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro); doc.text(tara, taraX + taraLW + sp, y)

  doc.setFont('helvetica', 'bold'); const pnLW = doc.getTextWidth('Peso Neto')
  doc.setFont('helvetica', 'normal'); const pnVW = doc.getTextWidth(pn)
  const pnX = W - margen - (pnLW + sp + pnVW)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...grisOsc); doc.text('Peso Neto', pnX, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro); doc.text(pn, pnX + pnLW + sp, y)

  y += 4; doc.setDrawColor(200, 200, 200); doc.line(margen, y, W - margen, y); y += 5

  // ── ORIGEN / DESTINO ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...grisOsc)
  doc.text('Origen:', margen, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro)
  doc.text(a.origen || '.'.repeat(30), margen + 13, y)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...grisOsc)
  doc.text('Destino:', 113, y)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro)
  doc.text(a.instalacion || '.'.repeat(26), 126, y)

  y += 4; doc.setDrawColor(200, 200, 200); doc.line(margen, y, W - margen, y); y += 4

  // ── OBSERVACIONES ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...grisOsc)
  doc.text('Observaciones:', margen, y); y += 3
  doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3); doc.setFillColor(252, 252, 252)
  doc.rect(margen, y, contentW, 8, 'FD')
  if (a.observaciones) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...negro)
    doc.text(a.observaciones, margen + 2, y + 4, { maxWidth: contentW - 4 })
  }
  y += 11

  // ── CAJAS DE FIRMA ─────────────────────────────────────────────────────────
  const sigH    = 28
  const sigW    = contentW / 2 - 2
  const footerH = 7

  const drawSigBox = (bx, by, label, firmaData) => {
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.setFillColor(255, 255, 255)
    doc.rect(bx, by, sigW, sigH, 'FD')
    const imgAreaH = sigH - footerH
    if (firmaData?.firmaImagen) addImgFit(firmaData.firmaImagen, bx + 3, by + 3, sigW - 6, imgAreaH - 6)
    doc.setFillColor(...grisClaro); doc.setDrawColor(200, 200, 200)
    doc.rect(bx, by + imgAreaH, sigW, footerH, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...grisOsc)
    doc.text(label, bx + sigW / 2, by + imgAreaH + footerH / 2 + 2, { align: 'center' })
  }

  const firmaOrigen  = a.firmas?.proveedor?.firmado   ? a.firmas.proveedor
                     : a.firmas?.astilladora?.firmado ? a.firmas.astilladora : null
  const firmaDestino = a.firmas?.instalacion?.firmado ? a.firmas.instalacion : null

  drawSigBox(margen,            y, 'Firma y/o sello Proveedor',   firmaOrigen)
  drawSigBox(margen + sigW + 4, y, 'Firma y/o sello Instalación', firmaDestino)

  y += sigH + 3

  // ── PIE ────────────────────────────────────────────────────────────────────
  doc.setFontSize(6); doc.setTextColor(160, 160, 160); doc.setFont('helvetica', 'normal')
  doc.text('C/ Vallès, 2 - Pol. Ind. Almeda · 08940 Cornellà de Llobregat', W / 2, y, { align: 'center' })

  doc.save(`${a.id}_albaran_a5_comsa.pdf`)
}

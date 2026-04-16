const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

/** Número de semana ISO (1-53) para una fecha dada */
export function isoWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)
}

/** Año ISO de la semana (puede diferir del año natural en semanas 1 y 52-53) */
export function isoWeekYear(date) {
  const d = new Date(date)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  return d.getFullYear()
}

/** Lunes de la semana ISO que contiene `date` */
function lunesDeSemana(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7   // lun=0 … dom=6
  d.setDate(d.getDate() - day)
  return d
}

/** "S16 · 13–17 abr 2026" para el subtítulo del Dashboard */
export function labelSemanaActual() {
  const hoy = new Date()
  const lunes = lunesDeSemana(hoy)
  const viernes = new Date(lunes)
  viernes.setDate(lunes.getDate() + 4)

  const fmtDia = d => d.getDate()
  const fmtMes = d => MESES[d.getMonth()].slice(0, 3)

  const semL = fmtMes(lunes)
  const semV = fmtMes(viernes)
  const rangoMes = semL === semV ? semL : `${semL}–${semV}`

  return `Semana ${isoWeek(hoy)} · ${fmtDia(lunes)}–${fmtDia(viernes)} ${rangoMes} ${viernes.getFullYear()}`
}

/**
 * Devuelve las últimas `n` semanas ISO hasta la actual,
 * con el conteo de albaranes de cada una.
 * Cada albarán debe tener `fecha` en formato "YYYY-MM-DD".
 */
export function ultimas4Semanas(albaranes, n = 4) {
  const hoy = new Date()
  const semActual = isoWeek(hoy)
  const anioActual = isoWeekYear(hoy)

  // Agrupa albaranes por "AAAA-Wnn"
  const conteo = {}
  albaranes.forEach(a => {
    if (!a.fecha) return
    const fecha = new Date(a.fecha)
    const key = `${isoWeekYear(fecha)}-W${String(isoWeek(fecha)).padStart(2,'0')}`
    conteo[key] = (conteo[key] || 0) + 1
  })

  const semanas = []
  for (let i = n - 1; i >= 0; i--) {
    // Retroceder i semanas desde la actual
    const ref = new Date(lunesDeSemana(hoy))
    ref.setDate(ref.getDate() - i * 7)
    const w = isoWeek(ref)
    const y = isoWeekYear(ref)
    const key = `${y}-W${String(w).padStart(2,'0')}`
    semanas.push({
      label: `S${w}`,
      val:   conteo[key] || 0,
      activa: w === semActual && y === anioActual,
    })
  }
  return semanas
}

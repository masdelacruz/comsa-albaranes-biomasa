import { BadgeCheck, PenLine } from 'lucide-react'

// Indica de dónde sale un dato de pesada comparando el valor actual con lo
// que la API leyó del ticket (pesada.ticketLeido). Si coinciden → "Del ticket";
// si alguien lo ha cambiado a mano → "A mano · ticket: X". Sin lectura del
// ticket no se muestra nada (es el caso normal de dato introducido a mano).
//
// Solo color de texto, sin recuadro de fondo.

const igual = (a, b) => String(a ?? '').trim().replace(',', '.') === String(b ?? '').trim().replace(',', '.')
  || (Number.isFinite(Number(a)) && a !== '' && a != null && Number(a) === Number(b))

function estadoTicket(valor, leido) {
  if (leido == null || leido === '') return null
  if (valor == null || valor === '') return null
  return igual(valor, leido) ? 'ticket' : 'manual'
}

export default function OrigenTicket({ valor, leido, kg = false, style }) {
  const estado = estadoTicket(valor, leido)
  if (!estado) return null
  const base = { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, lineHeight: 1.2, ...style }
  if (estado === 'ticket') {
    return (
      <span style={{ ...base, color: 'var(--green-600)' }} title="Valor leído automáticamente del ticket de pesada">
        <BadgeCheck size={12} /> Del ticket
      </span>
    )
  }
  const ref = kg ? `${Number(leido).toLocaleString('es-ES')} kg` : leido
  return (
    <span style={{ ...base, color: 'var(--amber-700)' }} title="Modificado a mano: no coincide con el ticket de pesada">
      <PenLine size={12} /> A mano · ticket: {ref}
    </span>
  )
}

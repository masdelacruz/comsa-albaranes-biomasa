// Nombre de empresa ↔ segmento de URL de los paneles públicos. Los espacios
// viajan como '-' (enlaces legibles, y así siguen valiendo todos los ya
// compartidos) y un guion real del nombre como '~', para no perderlo al
// deshacer el cambio. Debe coincidir con src/utils/clientes.js.
const rutaDeNombre = nombre =>
  encodeURIComponent(String(nombre).trim().replace(/-/g, '~').replace(/\s+/g, '-'))

const nombreDeRuta = segmento =>
  decodeURIComponent(segmento).replace(/-/g, ' ').replace(/~/g, '-')

module.exports = { rutaDeNombre, nombreDeRuta }

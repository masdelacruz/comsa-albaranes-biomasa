// Comprobación de tipo real por cabecera de fichero (magic bytes), para no
// fiarnos únicamente de la extensión o el Content-Type que declara el
// cliente — ambos son controlados por quien sube el fichero.
const SIGNATURES = {
  pdf:  [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],                          // %PDF
  jpg:  [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  jpeg: [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  png:  [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  webp: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }], // RIFF....WEBP
  docx: [{ offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }],                          // zip (docx/xlsx)
  xlsx: [{ offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }],
  doc:  [{ offset: 0, bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }],   // OLE (doc/xls antiguos)
  xls:  [{ offset: 0, bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }],
}

function matches(buffer, sig) {
  return sig.every(({ offset, bytes }) =>
    bytes.every((b, i) => buffer[offset + i] === b)
  )
}

// true si el contenido real del buffer corresponde a alguna de las
// extensiones permitidas (no exige que coincida con la extensión declarada,
// solo que el fichero SEA de un tipo del allowlist).
function contentMatchesAllowlist(buffer, allowedExts) {
  return allowedExts.some(ext => {
    const sig = SIGNATURES[ext]
    return sig && matches(buffer, sig)
  })
}

module.exports = { contentMatchesAllowlist }

import { useState, useEffect } from 'react'

const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

// Logo de una empresa para la cabecera de su panel externo y el color de
// fondo derivado de él (tono medio del logo, oscurecido). Común a los
// paneles de proveedor, astilladora e instalación.
export function useLogoEmpresa(nombre) {
  const [logoUrl,       setLogoUrl]       = useState(null)
  const [headerBgColor, setHeaderBgColor] = useState(null)

  useEffect(() => {
    fetch(`/api/storage/logos/public/empresa_${slugify(nombre)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setLogoUrl(d.url) })
      .catch(() => {})
  }, [nombre])

  useEffect(() => {
    if (!logoUrl) { setHeaderBgColor(null); return }
    let objUrl = null
    fetch(logoUrl)
      .then(r => r.blob())
      .then(blob => {
        objUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const scale  = Math.min(1, 64 / Math.max(img.width || 1, img.height || 1))
            canvas.width  = Math.max(1, Math.round((img.width  || 1) * scale))
            canvas.height = Math.max(1, Math.round((img.height || 1) * scale))
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
            let r = 0, g = 0, b = 0, count = 0
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] > 128) { r += data[i]; g += data[i+1]; b += data[i+2]; count++ }
            }
            if (count > 0) {
              const nr = r / count / 255, ng = g / count / 255, nb = b / count / 255
              const max = Math.max(nr, ng, nb), min = Math.min(nr, ng, nb)
              let h = 0, s = 0
              const l = (max + min) / 2
              if (max !== min) {
                const d = max - min
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
                if (max === nr) h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6
                else if (max === ng) h = ((nb - nr) / d + 2) / 6
                else h = ((nr - ng) / d + 4) / 6
              }
              const tL = 0.18, tS = Math.max(0.35, Math.min(0.85, s))
              const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1; if (t > 1) t -= 1
                if (t < 1/6) return p + (q - p) * 6 * t
                if (t < 1/2) return q
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
                return p
              }
              const q2 = tL < 0.5 ? tL * (1 + tS) : tL + tS - tL * tS
              const p2  = 2 * tL - q2
              const fr  = Math.round(hue2rgb(p2, q2, h + 1/3) * 255)
              const fg  = Math.round(hue2rgb(p2, q2, h) * 255)
              const fb  = Math.round(hue2rgb(p2, q2, h - 1/3) * 255)
              setHeaderBgColor(`rgb(${fr},${fg},${fb})`)
            }
          } catch {}
          URL.revokeObjectURL(objUrl)
        }
        img.onerror = () => URL.revokeObjectURL(objUrl)
        img.src = objUrl
      })
      .catch(() => {})
  }, [logoUrl])

  return { logoUrl, headerBgColor }
}

import { Building2, Factory, Trees } from 'lucide-react'

export const SECCIONES_CLIENTES = [
  { tipo: 'proveedor',   titulo: 'Proveedores',   singular: 'Proveedor',   icon: Trees,     color: '#7C5CBF' },
  { tipo: 'astilladora', titulo: 'Astilladoras', singular: 'Astilladora', icon: Factory,   color: '#8B5A3C' },
  { tipo: 'instalacion', titulo: 'Instalaciones', singular: 'Instalación', icon: Building2, color: '#f5a623' },
]

export const TIPOS_CLIENTE = new Set(SECCIONES_CLIENTES.map(s => s.tipo))

export const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

// Nombre de empresa ↔ segmento de URL de los paneles: los espacios van como
// '-' (enlaces legibles y compatibles con los ya compartidos) y un guion real
// como '~'. Debe coincidir con deploy/api/lib/nombreRuta.js.
export const rutaNombre = nombre =>
  encodeURIComponent(String(nombre).trim().replace(/-/g, '~').replace(/\s+/g, '-'))
export const nombreDeRuta = segmento =>
  decodeURIComponent(segmento).replace(/-/g, ' ').replace(/~/g, '-')

export const panelUrl = (p) => {
  const base = `/campo/${p.tipo}/${rutaNombre(p.nombre)}`
  return `${window.location.origin}${base}?c=${encodeURIComponent(p.acceso_codigo || '')}`
}

// Personas de contacto de una empresa ({ nombre, telefono }); la primera es la
// principal. Las fichas antiguas solo tenían contacto/teléfono sueltos.
export function contactosEmpresa(e) {
  if (!e) return []
  if (Array.isArray(e.contactos) && e.contactos.length) return e.contactos.filter(c => c?.nombre || c?.telefono)
  if (e.contacto || e.telefono) return [{ nombre: e.contacto || '', telefono: e.telefono || '' }]
  return []
}

export const telHref = tel => tel ? `tel:${tel.replace(/[^\d+]/g, '')}` : null

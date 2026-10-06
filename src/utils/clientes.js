import { Building2, Factory, Trees } from 'lucide-react'

export const SECCIONES_CLIENTES = [
  { tipo: 'astilladora', titulo: 'Astilladoras', singular: 'Astilladora', icon: Factory,   color: '#8B5A3C' },
  { tipo: 'instalacion', titulo: 'Instalaciones', singular: 'Instalación', icon: Building2, color: '#f5a623' },
  { tipo: 'proveedor',   titulo: 'Proveedores',   singular: 'Proveedor',   icon: Trees,     color: '#1D9E75' },
]

export const TIPOS_CLIENTE = new Set(SECCIONES_CLIENTES.map(s => s.tipo))

export const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

export const panelUrl = (p) => {
  const base = `/campo/${p.tipo}/${p.nombre.replace(/\s+/g, '-')}`
  return `${window.location.origin}${base}?c=${encodeURIComponent(p.acceso_codigo || '')}`
}

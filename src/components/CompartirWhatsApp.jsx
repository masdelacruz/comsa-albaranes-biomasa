import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Check, User } from 'lucide-react'
import { api } from '../lib/api'
import { contactosEmpresa } from '../utils/clientes'
import { normalizarTelefono, toTitleCase } from './EmpresaModal'
import '../pages/Administracion.css'
import './EmpresaModal.css'
import './CompartirWhatsApp.css'

// Teléfono a formato wa.me: solo dígitos y, si es un móvil/fijo español sin
// prefijo, se le antepone el 34.
const telWhatsApp = raw => raw
  ? raw.replace(/[\s\-().]/g, '').replace(/^\+/, '').replace(/^0034/, '34').replace(/^(?=[6789]\d{8}$)/, '34')
  : ''

export const WaIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.477 2 2 6.477 2 11.99c0 1.762.476 3.411 1.305 4.83L2 22l5.335-1.391A9.953 9.953 0 0011.99 22C17.523 22 22 17.523 22 12.01 22 6.477 17.523 2 11.99 2zm0 18.002a7.966 7.966 0 01-4.073-1.113l-.29-.173-3.017.787.81-2.945-.19-.302A7.96 7.96 0 014.002 12c0-4.406 3.583-7.998 7.988-7.998 4.406 0 7.998 3.592 7.998 7.998 0 4.406-3.592 7.998-7.998 8.002z"/></svg>
)

const primerNombre = n => String(n || '').trim().split(/\s+/)[0] || ''

// Pop-up para elegir a quién de la empresa se manda el enlace por WhatsApp.
// Lista sus personas de contacto, permite añadir una nueva (y guardarla en la
// ficha) y deja revisar el mensaje antes de abrir WhatsApp.
//   empresa: fila de /empresas (puede faltar si la empresa no está dada de alta)
//   mensaje(nombre): texto del mensaje saludando a esa persona
export default function CompartirWhatsApp({ titulo, empresa, nombreEmpresa, mensaje, onClose, onContactoGuardado }) {
  const contactos = useMemo(
    () => contactosEmpresa(empresa).filter(c => telWhatsApp(c.telefono)),
    [empresa]
  )
  const [sel, setSel]           = useState(contactos.length ? 0 : 'nuevo')
  const [nuevo, setNuevo]       = useState({ nombre: '', telefono: '' })
  const [guardar, setGuardar]   = useState(!!empresa)
  // null = mensaje original (sigue a la persona elegida); texto = editado a mano
  const [editado, setEditado]   = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState('')

  const destino = sel === 'nuevo' ? nuevo : contactos[sel]
  const tel     = telWhatsApp(destino?.telefono || '')
  const telOk   = tel.replace(/\D/g, '').length >= 9

  const texto = editado ?? mensaje(primerNombre(destino?.nombre) || nombreEmpresa || '')

  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onClose])

  const abrir = async () => {
    if (!telOk || !texto.trim()) return
    setError('')
    if (sel === 'nuevo' && guardar && empresa) {
      setEnviando(true)
      try {
        const fila = await api.post(`/empresas/${empresa.id}/contactos`, {
          nombre: toTitleCase(nuevo.nombre.trim()),
          telefono: normalizarTelefono(nuevo.telefono),
        })
        onContactoGuardado?.(fila)
      } catch (e) {
        setEnviando(false)
        setError(e?.message || 'No se pudo guardar el contacto')
        return
      }
      setEnviando(false)
    }
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal em-modal cw-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="em-header">
          <div className="em-icon cw-icon"><WaIcon size={18} /></div>
          <div className="em-head-text">
            <div className="em-eyebrow">Compartir por WhatsApp</div>
            <div className="em-title">{titulo}</div>
          </div>
          <button type="button" className="em-close" onClick={onClose} title="Cerrar"><X size={16} /></button>
        </div>

        <div className="em-body">
          <div className="em-section">
            <div className="em-section-title">Enviar a · {nombreEmpresa}</div>
            <div className="cw-lista">
              {contactos.map((c, i) => (
                <button type="button" key={i} className={`cw-opcion${sel === i ? ' on' : ''}`} onClick={() => setSel(i)}>
                  <span className="cw-radio" />
                  <span className="cw-nombre">{c.nombre || <span className="cw-sin">Sin nombre</span>}</span>
                  <span className="cw-tel">{normalizarTelefono(c.telefono)}</span>
                  {i === 0 && <span className="cw-principal">Principal</span>}
                </button>
              ))}
              <button type="button" className={`cw-opcion${sel === 'nuevo' ? ' on' : ''}`} onClick={() => setSel('nuevo')}>
                <span className="cw-radio" />
                <span className="cw-nombre cw-anadir"><Plus size={13} /> Otro contacto</span>
              </button>
            </div>

            {sel === 'nuevo' && (
              <div className="cw-nuevo">
                <div className="modal-grid">
                  <div className="modal-field">
                    <label>Nombre</label>
                    <input value={nuevo.nombre} autoFocus placeholder="Persona de contacto"
                      onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} />
                  </div>
                  <div className="modal-field">
                    <label>Teléfono</label>
                    <input type="tel" value={nuevo.telefono} placeholder="600 000 000"
                      onChange={e => setNuevo(n => ({ ...n, telefono: e.target.value }))}
                      onBlur={e => setNuevo(n => ({ ...n, telefono: normalizarTelefono(e.target.value) }))} />
                  </div>
                </div>
                {empresa ? (
                  <button type="button" className={`em-check cw-guardar${guardar ? ' on' : ''}`} onClick={() => setGuardar(g => !g)}>
                    <span className="em-box">{guardar && <Check size={12} strokeWidth={3} />}</span>
                    Guardar en la ficha de {nombreEmpresa}
                  </button>
                ) : (
                  <div className="em-hint">{nombreEmpresa} no está dada de alta como empresa: el contacto no se guardará.</div>
                )}
              </div>
            )}
          </div>

          <div className="em-section">
            <div className="em-section-title">Mensaje</div>
            <textarea className="cw-texto" rows={9} value={texto}
              onChange={e => setEditado(e.target.value)} />
            {editado !== null && (
              <button type="button" className="cw-restaurar"
                onClick={() => setEditado(null)}>
                Restaurar mensaje original
              </button>
            )}
          </div>
        </div>

        <div className="em-footer">
          {error && <span className="em-error">{error}</span>}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!telOk || !texto.trim() || enviando} onClick={abrir}
            title={telOk ? undefined : 'Elige un contacto con teléfono'}>
            <WaIcon size={13} /> {enviando ? 'Guardando…' : 'Abrir WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}

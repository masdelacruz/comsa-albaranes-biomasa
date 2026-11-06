import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Check, Copy, Mail, Send } from 'lucide-react'
import { api } from '../lib/api'
import { contactosEmpresa, telWhatsApp } from '../utils/clientes'
import { useCopiar } from '../utils/copiar'
import { normalizarTelefono, toTitleCase } from './EmpresaModal'
import { WaIcon } from './CompartirWhatsApp'
import '../pages/Administracion.css'
import './EmpresaModal.css'
import './CompartirWhatsApp.css'

const primerNombre = n => String(n || '').trim().split(/\s+/)[0] || ''
const telValido = t => telWhatsApp(t).replace(/\D/g, '').length >= 9
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim())

// Pop-up único para escribir a un cliente: se elige la vía (WhatsApp o email)
// y la persona, y se ve y edita exactamente lo que se enviará (se puede copiar).
// Nada se registra por ver, editar o copiar: solo al abrir WhatsApp o el correo.
//   empresa:          fila de /empresas (puede faltar si no está dada de alta)
//   mensaje(n, via):  texto saludando a esa persona; via 'whatsapp' | 'email'
//   asunto:           asunto del email
//   onEnviado(via):   tras abrir WhatsApp o el correo (p. ej. dejar constancia)
export default function EnviarMensaje({ titulo, empresa, nombreEmpresa, mensaje, asunto: asuntoInicial = '', onClose, onContactoGuardado, onEnviado }) {
  const contactos = useMemo(() => contactosEmpresa(empresa), [empresa])
  const primeroConTel = contactos.findIndex(c => telValido(c.telefono))
  const emailEmpresa = empresa?.email || ''

  // Vía inicial: WhatsApp si hay algún móvil; si no, email si la empresa lo tiene
  const [via, setVia]         = useState(primeroConTel >= 0 || !emailEmpresa ? 'whatsapp' : 'email')
  const [sel, setSel]         = useState(() => (primeroConTel >= 0 ? primeroConTel : emailEmpresa ? (contactos.length ? 0 : null) : 'nuevo'))
  const [nuevo, setNuevo]     = useState({ nombre: '', telefono: '' })
  const [guardar, setGuardar] = useState(!!empresa)
  const [para, setPara]       = useState(emailEmpresa)
  const [asunto, setAsunto]   = useState(asuntoInicial)
  // null = mensaje original (sigue a la persona elegida); texto = editado a mano. Uno por vía.
  const [editado, setEditado] = useState({ whatsapp: null, email: null })
  const [enviando, setEnviando] = useState(false)
  const [error, setError]     = useState('')
  const [copiado, copiar]     = useCopiar()

  const esWa = via === 'whatsapp'
  const destino = sel === 'nuevo' ? nuevo : contactos[sel]
  const tel = telWhatsApp(destino?.telefono || '')
  const nombreSaludo = primerNombre(destino?.nombre) || nombreEmpresa || ''
  const texto = editado[via] ?? mensaje(nombreSaludo, via)
  const listo = esWa ? telValido(destino?.telefono) : emailValido(para)

  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onClose])

  const cambiarVia = v => {
    setVia(v); setError('')
    // En WhatsApp hace falta teléfono; en email "Otro contacto" no aplica (se escribe el email en "Para")
    if (v === 'whatsapp' && sel !== 'nuevo' && !telValido(contactos[sel]?.telefono)) setSel(primeroConTel >= 0 ? primeroConTel : 'nuevo')
    if (v === 'email' && sel === 'nuevo') setSel(contactos.length ? 0 : null)
  }

  const enviar = async () => {
    if (!listo || !texto.trim()) return
    setError('')
    if (esWa) {
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
    } else {
      window.open(`mailto:${para.trim()}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`, '_blank')
    }
    onEnviado?.(via)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal em-modal cw-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="em-header">
          <div className="em-icon"><Send size={17} /></div>
          <div className="em-head-text">
            <div className="em-eyebrow">Enviar mensaje</div>
            <div className="em-title">{titulo}</div>
          </div>
          <button type="button" className="em-close" onClick={onClose} title="Cerrar"><X size={16} /></button>
        </div>

        <div className="em-body">
          <div className="em-section">
            <div className="em-section-title">Vía</div>
            <div className="em-seg" role="radiogroup">
              <button type="button" role="radio" aria-checked={esWa} className={esWa ? 'on' : ''} onClick={() => cambiarVia('whatsapp')}>
                <WaIcon size={13} /> WhatsApp
              </button>
              <button type="button" role="radio" aria-checked={!esWa} className={!esWa ? 'on' : ''} onClick={() => cambiarVia('email')}>
                <Mail size={13} /> Email
              </button>
            </div>
          </div>

          <div className="em-section">
            <div className="em-section-title">{esWa ? `Enviar a · ${nombreEmpresa}` : `Saludar a · ${nombreEmpresa}`}</div>
            <div className="cw-lista">
              {contactos.map((c, i) => {
                const sinTel = esWa && !telValido(c.telefono)
                return (
                  <button type="button" key={i} className={`cw-opcion${sel === i ? ' on' : ''}`} disabled={sinTel}
                    onClick={() => setSel(i)} title={sinTel ? 'Sin teléfono' : undefined}>
                    <span className="cw-radio" />
                    <span className="cw-nombre">{c.nombre || <span className="cw-sin">Sin nombre</span>}</span>
                    {esWa && <span className="cw-tel">{c.telefono ? normalizarTelefono(c.telefono) : 'sin teléfono'}</span>}
                    {i === 0 && <span className="cw-principal">Principal</span>}
                  </button>
                )
              })}
              {esWa && (
                <button type="button" className={`cw-opcion${sel === 'nuevo' ? ' on' : ''}`} onClick={() => setSel('nuevo')}>
                  <span className="cw-radio" />
                  <span className="cw-nombre cw-anadir"><Plus size={13} /> Otro contacto</span>
                </button>
              )}
              {!esWa && !contactos.length && <div className="em-hint">Sin personas de contacto: el saludo irá a {nombreEmpresa}.</div>}
            </div>

            {esWa && sel === 'nuevo' && (
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

            {!esWa && (
              <div className="cw-nuevo">
                <div className="modal-field">
                  <label>Para</label>
                  <input type="email" value={para} placeholder="email@empresa.com" onChange={e => setPara(e.target.value)} />
                </div>
                {!emailEmpresa && <div className="em-hint">{nombreEmpresa} no tiene email en su ficha: escríbelo aquí para este envío.</div>}
                <div className="modal-field">
                  <label>Asunto</label>
                  <input value={asunto} onChange={e => setAsunto(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="em-section">
            <div className="em-section-title cw-titulo-mensaje">
              Mensaje · lo que se enviará
              <button type="button" className="cw-copiar" onClick={() => copiar(esWa ? texto : `${asunto}\n\n${texto}`)}>
                {copiado === 'ok' ? <><Check size={12} /> Copiado</> : copiado === 'error' ? 'No se pudo copiar' : <><Copy size={12} /> Copiar</>}
              </button>
            </div>
            <textarea className="cw-texto" rows={10} value={texto}
              onChange={e => setEditado(ed => ({ ...ed, [via]: e.target.value }))} />
            {editado[via] !== null && (
              <button type="button" className="cw-restaurar" onClick={() => setEditado(ed => ({ ...ed, [via]: null }))}>
                Restaurar mensaje original
              </button>
            )}
          </div>
        </div>

        <div className="em-footer">
          {error && <span className="em-error">{error}</span>}
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!listo || !texto.trim() || enviando} onClick={enviar}
            title={listo ? undefined : esWa ? 'Elige un contacto con teléfono' : 'Escribe un email válido'}>
            {esWa ? <><WaIcon size={13} /> {enviando ? 'Guardando…' : 'Abrir WhatsApp'}</> : <><Mail size={13} /> Abrir en el correo</>}
          </button>
        </div>
      </div>
    </div>
  )
}

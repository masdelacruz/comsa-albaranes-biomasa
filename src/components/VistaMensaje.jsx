import { useEffect } from 'react'
import { X, Copy, Check, Mail } from 'lucide-react'
import { useCopiar } from '../utils/copiar'
import { WaIcon } from './CompartirWhatsApp'
import '../pages/Administracion.css'
import './EmpresaModal.css'
import './CompartirWhatsApp.css'

// Vista previa de un mensaje al cliente: muestra exactamente lo que se enviará
// (destinatario, asunto y texto), permite copiarlo y, si se quiere, abrirlo en
// el correo o pasar a WhatsApp. Nada se envía ni se registra solo por verlo o copiarlo.
export default function VistaMensaje({ titulo, subtitulo, para, asunto, texto, onClose, onEmail, onWhatsApp }) {
  const [copiado, copiar] = useCopiar()

  useEffect(() => {
    const tecla = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [onClose])

  const textoCopia = asunto ? `${asunto}\n\n${texto}` : texto

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal em-modal cw-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="em-header">
          <div className="em-icon"><Mail size={18} /></div>
          <div className="em-head-text">
            <div className="em-eyebrow">{subtitulo || 'Vista previa del mensaje'}</div>
            <div className="em-title">{titulo}</div>
          </div>
          <button type="button" className="em-close" onClick={onClose} title="Cerrar"><X size={16} /></button>
        </div>

        <div className="em-body">
          <div className="em-section">
            {(para !== undefined || asunto) && (
              <dl className="vm-cabecera">
                {para !== undefined && <><dt>Para</dt><dd>{para || <span className="cw-sin">Sin email registrado</span>}</dd></>}
                {asunto && <><dt>Asunto</dt><dd>{asunto}</dd></>}
              </dl>
            )}
            <pre className="vm-texto">{texto}</pre>
          </div>
        </div>

        <div className="em-footer">
          <button type="button" className="btn" onClick={() => copiar(textoCopia)}>
            {copiado === 'ok' ? <><Check size={13} /> Copiado</> : copiado === 'error' ? 'No se pudo copiar' : <><Copy size={13} /> Copiar</>}
          </button>
          {onWhatsApp && (
            <button type="button" className="btn dash-cli-wa" onClick={onWhatsApp}><WaIcon size={13} /> WhatsApp…</button>
          )}
          {onEmail && (
            <button type="button" className="btn btn-primary" onClick={onEmail} disabled={!para}
              title={para ? undefined : 'La empresa no tiene email registrado'}>
              <Mail size={13} /> Abrir en el correo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

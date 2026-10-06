import { useState, useRef } from 'react'
import { Plus, Trash2, X, Check, Upload, Clock, Trees, Factory, Truck, Building2, User, Users, StickyNote, Image } from 'lucide-react'
import { api } from '../lib/api'
import '../pages/Administracion.css'
import './EmpresaModal.css'

const TIPO_ICONS = { proveedor: Trees, astilladora: Factory, transportista: Truck, instalacion: Building2 }

export function toTitleCase(str) {
  if (!str) return str
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export function normalizarTelefono(raw) {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const hasPrefix = trimmed.startsWith('+') || trimmed.startsWith('00')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed
  if (hasPrefix) {
    const ccLen = digits[0] === '1' ? 1 : 2
    const cc = digits.slice(0, ccLen)
    const rest = digits.slice(ccLen)
    const groups = []
    for (let i = 0; i < rest.length; i += 3) groups.push(rest.slice(i, i + 3))
    return `+${cc} ${groups.join(' ')}`
  }
  const groups = []
  for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3))
  return groups.join(' ')
}

export const TIPOS = ['proveedor', 'astilladora', 'transportista', 'instalacion']
export const TIPO_LABELS = { proveedor: 'Proveedor', astilladora: 'Astilladora', transportista: 'Transportista', instalacion: 'Instalación' }
const EMPTY_FORM = { nombre: '', tipo: 'proveedor', contacto: '', email: '', telefono: '', notas: '', activo: true, trabajadores: [], maquinas: [], horario: '', es_sure: false, referencia_sure: '' }
const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

// Alta/edición de una empresa. Se usa desde Configuración y desde la ficha
// de cliente, para editar sin salir de donde se está.
//  - empresa:      la empresa a editar, o null para crear una nueva
//  - tipoInicial:  tipo por defecto al crear
//  - logos:        mapa id → url de /storage/logos
//  - onLogoChange: (id, url|null) al subir o borrar el logo
//  - onSaved:      tras guardar correctamente (el modal ya se cierra solo)
export default function EmpresaModal({ empresa, tipoInicial = 'proveedor', logos = {}, onLogoChange, onClose, onSaved }) {
  const editando = empresa?.id || null
  const [form, setForm] = useState(() => empresa
    ? { nombre: empresa.nombre, tipo: empresa.tipo, contacto: empresa.contacto || '', email: empresa.email || '', telefono: empresa.telefono || '', notas: empresa.notas || '', activo: empresa.activo, trabajadores: empresa.trabajadores || [], maquinas: empresa.maquinas || [], horario: empresa.horario || '', es_sure: !!empresa.es_sure, referencia_sure: empresa.referencia_sure || '' }
    : { ...EMPTY_FORM, tipo: tipoInicial })
  const [guardando, setGuardando]                 = useState(false)
  const [subiendoLogo, setSubiendoLogo]           = useState({})
  const [dragOverLogoModal, setDragOverLogoModal] = useState(false)
  const [confirmBorrarLogo, setConfirmBorrarLogo] = useState(false)
  const logoFileRefs = useRef({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const cerrarModal = onClose

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return
    if (form.tipo === 'proveedor' && form.es_sure && !form.referencia_sure.trim()) return
    setGuardando(true)
    try {
      const datos = {
        ...form,
        nombre:      toTitleCase(form.nombre.trim()),
        contacto:    form.contacto ? toTitleCase(form.contacto.trim()) : '',
        telefono:    normalizarTelefono(form.telefono),
        trabajadores: (form.trabajadores || []).map(t => toTitleCase(t.trim())).filter(Boolean),
        maquinas:    (form.maquinas || []).filter(m => m.matricula?.trim()).map(m => ({ nombre: m.nombre?.trim() || '', matricula: m.matricula.trim().toUpperCase() })),
      }
      if (editando) {
        await api.patch(`/empresas/${editando}`, datos)
      } else {
        await api.post('/empresas', datos)
      }
      await onSaved?.()
      onClose()
    } catch (e) {
      console.error('Error guardando empresa:', e)
    } finally {
      setGuardando(false)
    }
  }

  const handleSubirLogo = async (id, file) => {
    if (!file) return
    setSubiendoLogo(s => ({ ...s, [id]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { url } = await api.upload(`/storage/upload/logos/${id}`, fd)
      onLogoChange?.(id, `${url}?t=${Date.now()}`)
    } catch (err) {
      console.error('Error subiendo logo:', err)
    } finally {
      setSubiendoLogo(s => ({ ...s, [id]: false }))
    }
  }

  const handleEliminarLogo = async (id) => {
    try {
      await api.delete(`/storage/logos/${id}`)
      onLogoChange?.(id, null)
    } catch (err) {
      console.error('Error eliminando logo:', err)
    }
  }

  const TipoIcon = TIPO_ICONS[form.tipo] || Building2

  return (
      <div className="modal-overlay" onClick={cerrarModal}>
        <div className="modal em-modal" onClick={e => e.stopPropagation()}>
          <div className="em-header">
            <div className={`em-icon ${form.tipo}`}><TipoIcon size={19} /></div>
            <div className="em-head-text">
              <div className="em-eyebrow">{editando ? 'Editar' : 'Nuevo'} {TIPO_LABELS[form.tipo].toLowerCase()}</div>
              <div className={`em-title${form.nombre.trim() ? '' : ' vacio'}`}>{form.nombre.trim() || 'Sin nombre'}</div>
            </div>
            <button type="button" className={`em-estado ${form.activo ? 'on' : 'off'}`}
              onClick={() => set('activo', !form.activo)}
              title={form.activo ? 'Aparece en los desplegables de nuevos albaranes · clic para desactivar' : 'No aparece en los desplegables · clic para activar'}>
              <span className="em-dot" /> {form.activo ? 'Activo' : 'Inactivo'}
            </button>
            <button type="button" className="em-close" onClick={cerrarModal} title="Cerrar"><X size={16} /></button>
          </div>

          <div className="em-body">
            <section className="em-section">
              <div className="em-section-title"><Building2 size={12} /> Datos generales</div>
              <div className="modal-grid">
                {!editando && (
                  <div className="modal-field full">
                    <label>Tipo</label>
                    <select value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                      {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                    </select>
                  </div>
                )}
                <div className={`modal-field${form.tipo === 'proveedor' ? '' : ' full'}`}>
                  <label>Nombre *</label>
                  <input type="text" placeholder="Nombre de la empresa" value={form.nombre} onChange={e => set('nombre', e.target.value)} onBlur={e => set('nombre', toTitleCase(e.target.value))} autoFocus />
                </div>
                {form.tipo === 'proveedor' && (
                  <div className="modal-field">
                    <label>Certificación</label>
                    <div className="em-sure">
                      <label className={`em-check${form.es_sure ? ' on' : ''}`} onClick={() => set('es_sure', !form.es_sure)}>
                        <span className="em-box">{form.es_sure && <Check size={12} strokeWidth={3} />}</span>
                        SURE
                      </label>
                      {form.es_sure && (
                        <input type="text" placeholder="Referencia" value={form.referencia_sure} autoFocus
                          className={form.referencia_sure.trim() ? '' : 'falta'}
                          onChange={e => set('referencia_sure', e.target.value)}
                          onBlur={e => set('referencia_sure', e.target.value.trim().toUpperCase())} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="em-section">
              <div className="em-section-title"><User size={12} /> Contacto</div>
              <div className="modal-grid">
                <div className="modal-field">
                  <label>Persona de contacto</label>
                  <input type="text" placeholder="Nombre y apellido" value={form.contacto} onChange={e => set('contacto', e.target.value)} onBlur={e => set('contacto', toTitleCase(e.target.value))} />
                </div>
                <div className="modal-field">
                  <label>Teléfono</label>
                  <input type="tel" placeholder="+34 600 000 000" value={form.telefono}
                    onChange={e => set('telefono', e.target.value)}
                    onBlur={e => set('telefono', normalizarTelefono(e.target.value))}
                  />
                </div>
                <div className="modal-field full">
                  <label>Email</label>
                  <input type="email" placeholder="contacto@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
            </section>

            {(form.tipo === 'astilladora' || form.tipo === 'instalacion') && (
              <section className="em-section">
                <div className="em-section-title"><Clock size={12} /> Horario</div>
                <div className="modal-field">
                  <input type="text" placeholder="Ej: L-V 8:00-14:00 y 15:00-18:00 · Sáb 8:00-13:00"
                    value={form.horario} onChange={e => set('horario', e.target.value)} />
                  <div className="em-hint">Se muestra al transportista/conductor al confirmar en campo</div>
                </div>
              </section>
            )}

            {editando && (form.tipo === 'astilladora' || form.tipo === 'instalacion') && (() => {
              const logoId  = `empresa_${slugify(form.nombre)}`
              const logoUrl = logos[logoId]
              const subiendo = !!subiendoLogo[logoId]
              return (
                <section className="em-section">
                  <div className="em-section-title"><Image size={12} /> Logo · firma y sello</div>
                  <div
                    style={{
                      border: dragOverLogoModal ? '2px dashed var(--green-400)' : '1px solid var(--gray-200)',
                      borderRadius:'var(--radius-md)', padding:12, background: dragOverLogoModal ? 'rgba(29,158,117,0.06)' : 'var(--gray-50)',
                      cursor:'pointer', transition:'border 0.15s, background 0.15s',
                    }}
                    onClick={() => logoFileRefs.current[`modal_${logoId}`]?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOverLogoModal(true) }}
                    onDragLeave={() => setDragOverLogoModal(false)}
                    onDrop={e => { e.preventDefault(); setDragOverLogoModal(false); if(e.dataTransfer.files[0]) handleSubirLogo(logoId, e.dataTransfer.files[0]) }}
                  >
                    {dragOverLogoModal ? (
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,color:'var(--green-400)',padding:'10px 0'}}>
                        <Upload size={20}/><span style={{fontSize:12}}>Soltar aquí</span>
                      </div>
                    ) : logoUrl ? (
                      <div style={{textAlign:'center',marginBottom:8}}>
                        <img src={logoUrl} alt="Logo" style={{maxHeight:70,maxWidth:'100%',objectFit:'contain'}} />
                        <div style={{fontSize:11,color:'var(--gray-400)',marginTop:4}}>Clic o arrastra para cambiar</div>
                      </div>
                    ) : (
                      <div style={{textAlign:'center',fontSize:12,color:'var(--gray-400)',marginBottom:8,padding:'8px 0'}}>
                        <Upload size={16} style={{margin:'0 auto 4px',display:'block'}}/>
                        Sin logo · clic o arrastra para subir
                      </div>
                    )}
                    {subiendo && <div style={{fontSize:11,color:'var(--gray-400)',textAlign:'center'}}>Subiendo...</div>}
                    <input ref={el => { logoFileRefs.current[`modal_${logoId}`] = el }} type="file" accept="image/*" style={{display:'none'}}
                      onChange={e => { if(e.target.files[0]) handleSubirLogo(logoId, e.target.files[0]); e.target.value='' }}
                      disabled={subiendo}
                    />
                  </div>
                  {logoUrl && (
                    confirmBorrarLogo ? (
                      <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6,padding:'6px 8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:6}}>
                        <span style={{fontSize:11,color:'var(--red-700)',fontWeight:500,flex:1}}>¿Eliminar logo?</span>
                        <button className="btn" style={{padding:'3px 8px',fontSize:11,color:'var(--red-700)',borderColor:'var(--red-200)'}}
                          onClick={e => { e.stopPropagation(); handleEliminarLogo(logoId); setConfirmBorrarLogo(false) }}><Check size={11}/> Sí</button>
                        <button className="btn btn-ghost" style={{padding:'3px 6px',fontSize:11}}
                          onClick={e => { e.stopPropagation(); setConfirmBorrarLogo(false) }}><X size={11}/></button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost" style={{marginTop:6,width:'100%',fontSize:11,color:'var(--red-400)',justifyContent:'center'}}
                        onClick={e => { e.stopPropagation(); setConfirmBorrarLogo(true) }}>
                        <Trash2 size={12}/> Eliminar logo
                      </button>
                    )
                  )}
                  <div className="em-hint" style={{marginTop:6}}>PNG, JPG o WEBP · Cabecera del panel y firma/sello al confirmar desde el campo</div>
                </section>
              )
            })()}

            {/* ── Trabajadores y máquinas (solo astilladora) ── */}
            {form.tipo === 'astilladora' && (
              <section className="em-section">
                <div className="em-section-title"><Users size={12} /> Equipo</div>
                <div className="modal-field" style={{marginBottom:14}}>
                  <label style={{marginBottom:4,display:'block'}}>Trabajadores</label>
                  {(form.trabajadores || []).map((t, i) => (
                    <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                      <input type="text" placeholder="Nombre y apellidos" value={t} style={{flex:1}}
                        onChange={e => set('trabajadores', form.trabajadores.map((x,j) => j===i ? e.target.value : x))}
                        onBlur={e => set('trabajadores', form.trabajadores.map((x,j) => j===i ? toTitleCase(e.target.value) : x))}
                      />
                      <button className="btn btn-ghost" style={{padding:'4px 6px',color:'var(--gray-400)'}}
                        onClick={() => set('trabajadores', form.trabajadores.filter((_,j) => j!==i))}>
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{fontSize:12,width:'100%',justifyContent:'center',marginTop:2}}
                    onClick={() => set('trabajadores', [...(form.trabajadores||[]), ''])}>
                    <Plus size={12}/> Añadir trabajador
                  </button>
                </div>

                <div className="modal-field">
                  <label style={{marginBottom:4,display:'block'}}>Máquinas astilladoras</label>
                  {(form.maquinas || []).map((m, i) => (
                    <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                      <input type="text" placeholder="Nombre / descripción" value={m.nombre||''} style={{flex:2}}
                        onChange={e => set('maquinas', form.maquinas.map((x,j) => j===i ? {...x, nombre: e.target.value} : x))}
                      />
                      <input type="text" placeholder="Matrícula" value={m.matricula||''} style={{flex:1,fontFamily:'var(--font-mono)',fontSize:12}}
                        onChange={e => set('maquinas', form.maquinas.map((x,j) => j===i ? {...x, matricula: e.target.value.toUpperCase()} : x))}
                      />
                      <button className="btn btn-ghost" style={{padding:'4px 6px',color:'var(--gray-400)'}}
                        onClick={() => set('maquinas', form.maquinas.filter((_,j) => j!==i))}>
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{fontSize:12,width:'100%',justifyContent:'center',marginTop:2}}
                    onClick={() => set('maquinas', [...(form.maquinas||[]), {nombre:'', matricula:''}])}>
                    <Plus size={12}/> Añadir máquina
                  </button>
                </div>
              </section>
            )}

            <section className="em-section">
              <div className="em-section-title"><StickyNote size={12} /> Notas internas</div>
              <div className="modal-field">
                <textarea placeholder="Observaciones, condiciones especiales..." value={form.notas} onChange={e => set('notas', e.target.value)} style={{ minHeight: 64 }} />
              </div>
            </section>
          </div>

          <div className="em-footer">
            <button className="btn" onClick={cerrarModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleGuardar} disabled={!form.nombre.trim() || guardando || (form.tipo === 'proveedor' && form.es_sure && !form.referencia_sure.trim())}>
              {guardando ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar cambios' : 'Crear'}</>}
            </button>
          </div>
        </div>
      </div>
  )
}

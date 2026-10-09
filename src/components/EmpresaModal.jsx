import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, X, Check, Upload, Clock, Star, Trees, Factory, Truck, Building2, User, Users, StickyNote, Image } from 'lucide-react'
import { api } from '../lib/api'
import '../pages/Administracion.css'
import { contactosEmpresa } from '../utils/clientes'
import './EmpresaModal.css'

// Contactos para editar: siempre al menos una fila
const contactosDe = (empresa) => {
  const lista = contactosEmpresa(empresa).map(c => ({ nombre: c.nombre || '', telefono: c.telefono || '' }))
  return lista.length ? lista : [CONTACTO_VACIO]
}

const TIPO_ICONS = { proveedor: Trees, astilladora: Factory, transportista: Truck, instalacion: Building2 }
const ordenarPorTipo = filas => [...filas].sort((a, b) => TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo))

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
const CONTACTO_VACIO = { nombre: '', telefono: '' }
const EMPTY_FORM = { nombre: '', tipos: ['proveedor'], contactos: [CONTACTO_VACIO], email: '', notas: '', activo: true, trabajadores: [], maquinas: [], horario: '', es_sure: false, referencia_sure: '' }
const slugify = s => s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

// Alta/edición de una empresa. Se usa desde Configuración y desde la ficha
// de cliente, para editar sin salir de donde se está.
// Una empresa puede tener varios tipos (una fila por tipo con el mismo nombre):
// el modal edita la empresa entera — nombre, contacto, notas y estado se
// guardan en todas sus filas — y permite sumarle tipos nuevos de una vez.
//  - empresa:      la fila a editar, o null para crear una nueva
//  - hermanas:     todas las filas de la empresa (incluida empresa); por defecto [empresa]
//  - tipoInicial:  tipo por defecto al crear
//  - logos:        mapa id → url de /storage/logos
//  - onLogoChange: (id, url|null) al subir o borrar el logo
//  - onSaved:      tras guardar correctamente (el modal ya se cierra solo)
export default function EmpresaModal({ empresa, hermanas, tipoInicial = 'proveedor', logos = {}, onLogoChange, onClose, onSaved }) {
  const editando = empresa?.id || null
  const filas = editando ? ordenarPorTipo(hermanas?.length ? hermanas : [empresa]) : []
  const fila = t => filas.find(f => f.tipo === t)
  const tiposExistentes = filas.map(f => f.tipo)
  const [form, setForm] = useState(() => {
    if (!empresa) return { ...EMPTY_FORM, tipos: [tipoInicial] }
    const prov = fila('proveedor'), ast = fila('astilladora'), conHorario = ast || fila('instalacion')
    return {
      nombre: empresa.nombre, tipos: tiposExistentes, contactos: contactosDe(empresa), email: empresa.email || '',
      notas: empresa.notas || '', activo: empresa.activo,
      trabajadores: ast?.trabajadores || [], maquinas: ast?.maquinas || [], horario: conHorario?.horario || '',
      es_sure: !!prov?.es_sure, referencia_sure: prov?.referencia_sure || '',
    }
  })
  const [error, setError] = useState(null)
  // Al crear, para avisar si el nombre ya existe con otros tipos (se sumará a esa empresa)
  const [todas, setTodas] = useState([])
  useEffect(() => { if (!editando) api.get('/empresas').then(d => setTodas(d || [])).catch(() => {}) }, [editando])
  const [guardando, setGuardando]                 = useState(false)
  const [subiendoLogo, setSubiendoLogo]           = useState({})
  const [dragOverLogoModal, setDragOverLogoModal] = useState(false)
  const [confirmBorrarLogo, setConfirmBorrarLogo] = useState(false)
  const logoFileRefs = useRef({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const tiene = t => form.tipos.includes(t)
  const toggleTipo = t => {
    if (tiposExistentes.includes(t)) return
    setForm(f => ({ ...f, tipos: f.tipos.includes(t) ? f.tipos.filter(x => x !== t) : TIPOS.filter(x => x === t || f.tipos.includes(x)) }))
  }
  const yaExiste = !editando && form.nombre.trim()
    ? todas.filter(e => e.nombre.toLowerCase() === toTitleCase(form.nombre.trim()).toLowerCase())
    : []
  const tiposRepetidos = yaExiste.filter(e => form.tipos.includes(e.tipo)).map(e => e.tipo)
  const faltaSure = tiene('proveedor') && form.es_sure && !form.referencia_sure.trim()
  const puedeGuardar = form.nombre.trim() && form.tipos.length && !tiposRepetidos.length && !faltaSure && !guardando

  // Personas de contacto: la primera es la principal (WhatsApp, llamadas, emails)
  const setContacto = (i, k, v) => setForm(f => ({ ...f, contactos: f.contactos.map((c, j) => j === i ? { ...c, [k]: v } : c) }))
  const quitarContacto = (i) => setForm(f => {
    const resto = f.contactos.filter((_, j) => j !== i)
    return { ...f, contactos: resto.length ? resto : [CONTACTO_VACIO] }
  })
  const hacerPrincipal = (i) => setForm(f => ({ ...f, contactos: [f.contactos[i], ...f.contactos.filter((_, j) => j !== i)] }))
  const anadirContacto = () => setForm(f => ({ ...f, contactos: [...f.contactos, CONTACTO_VACIO] }))
  const cerrarModal = onClose

  const handleGuardar = async () => {
    if (!puedeGuardar) return
    setGuardando(true)
    setError(null)
    try {
      // Datos de la empresa (iguales en todos sus tipos) y los propios de cada tipo
      const comunes = {
        nombre:    toTitleCase(form.nombre.trim()),
        contactos: form.contactos
          .map(c => ({ nombre: toTitleCase(c.nombre.trim()), telefono: normalizarTelefono(c.telefono) }))
          .filter(c => c.nombre || c.telefono),
        email: form.email, notas: form.notas, activo: form.activo,
      }
      const propios = {
        proveedor:     { es_sure: form.es_sure, referencia_sure: form.referencia_sure },
        astilladora:   {
          horario: form.horario,
          trabajadores: (form.trabajadores || []).map(t => toTitleCase(t.trim())).filter(Boolean),
          maquinas: (form.maquinas || []).filter(m => m.matricula?.trim()).map(m => ({ nombre: m.nombre?.trim() || '', matricula: m.matricula.trim().toUpperCase() })),
        },
        instalacion:   { horario: form.horario },
        transportista: {},
      }
      // La fila abierta primero: si cambia el nombre, el servidor renombra las demás
      for (const f of [...filas].sort((a, b) => (b.id === editando) - (a.id === editando))) {
        await api.patch(`/empresas/${f.id}`, { ...comunes, ...propios[f.tipo] })
      }
      const nuevos = form.tipos.filter(t => !tiposExistentes.includes(t))
      if (nuevos.length) {
        await api.post('/empresas', { ...comunes, ...Object.assign({}, ...nuevos.map(t => propios[t])), tipos: nuevos })
      }
      await onSaved?.()
      onClose()
    } catch (e) {
      console.error('Error guardando empresa:', e)
      setError(e.message || 'No se ha podido guardar')
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

  const tipoPrincipal = form.tipos[0] || tipoInicial
  const TipoIcon = TIPO_ICONS[tipoPrincipal] || Building2

  return (
      <div className="modal-overlay" onClick={cerrarModal}>
        <div className="modal em-modal" onClick={e => e.stopPropagation()}>
          <div className="em-header">
            <div className={`em-icon ${tipoPrincipal}`}><TipoIcon size={19} /></div>
            <div className="em-head-text">
              <div className="em-eyebrow">{editando ? 'Editar' : 'Nuevo'} · {form.tipos.length ? form.tipos.map(t => TIPO_LABELS[t]).join(' + ') : 'sin tipo'}</div>
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
                <div className="modal-field full">
                  <label>Tipos</label>
                  <div className="em-tipos">
                    {TIPOS.map(t => {
                      const I = TIPO_ICONS[t]
                      const fijo = tiposExistentes.includes(t)
                      return (
                        <button key={t} type="button" className={`em-tipo ${t}${tiene(t) ? ' on' : ''}${fijo ? ' fijo' : ''}`}
                          onClick={() => toggleTipo(t)}
                          title={fijo ? 'Para quitar este tipo, elimínalo desde su pestaña en Configuración' : undefined}>
                          <I size={13} /> {TIPO_LABELS[t]} {tiene(t) && <Check size={12} strokeWidth={3} />}
                        </button>
                      )
                    })}
                  </div>
                  <div className="em-hint">
                    {editando
                      ? 'Marca otro tipo para dar de alta también la misma empresa como tal: comparte nombre, contactos y notas.'
                      : 'Marca todos los tipos de la empresa: se da de alta una sola vez y queda alineada en todos.'}
                  </div>
                </div>
                <div className={`modal-field${tiene('proveedor') ? '' : ' full'}`}>
                  <label>Nombre *</label>
                  <input type="text" placeholder="Nombre de la empresa" value={form.nombre} onChange={e => set('nombre', e.target.value)} onBlur={e => set('nombre', toTitleCase(e.target.value))} autoFocus />
                  {tiposRepetidos.length > 0 ? (
                    <div className="em-hint error">Ya existe como {tiposRepetidos.map(t => TIPO_LABELS[t]).join(' y ')}: edítala desde ahí para añadirle tipos.</div>
                  ) : yaExiste.length > 0 && (
                    <div className="em-hint aviso">Ya existe como {yaExiste.map(e => TIPO_LABELS[e.tipo]).join(' y ')}: se añadirá a esa misma empresa.</div>
                  )}
                </div>
                {tiene('proveedor') && (
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
              <div className="em-contactos">
                <div className="em-contactos-head">
                  <span>Persona de contacto</span>
                  <span>Teléfono</span>
                </div>
                {form.contactos.map((c, i) => (
                  <div key={i} className={`em-contacto${i === 0 ? ' principal' : ''}`}>
                    <input type="text" placeholder="Nombre y apellido" value={c.nombre}
                      onChange={e => setContacto(i, 'nombre', e.target.value)}
                      onBlur={e => setContacto(i, 'nombre', toTitleCase(e.target.value))} />
                    <input type="tel" placeholder="+34 600 000 000" value={c.telefono}
                      onChange={e => setContacto(i, 'telefono', e.target.value)}
                      onBlur={e => setContacto(i, 'telefono', normalizarTelefono(e.target.value))} />
                    <button type="button" className="em-contacto-star" disabled={i === 0}
                      onClick={() => hacerPrincipal(i)}
                      title={i === 0 ? 'Contacto principal · se usa para WhatsApp, llamadas y emails' : 'Marcar como contacto principal'}>
                      <Star size={14} fill={i === 0 ? 'currentColor' : 'none'} />
                    </button>
                    <button type="button" className="em-contacto-quitar" onClick={() => quitarContacto(i)} title="Quitar contacto">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className="em-contacto-anadir" onClick={anadirContacto} disabled={form.contactos.length >= 10}>
                  <Plus size={13} /> Añadir contacto
                </button>
              </div>
              <div className="modal-grid" style={{ marginTop: 14 }}>
                <div className="modal-field full">
                  <label>Email</label>
                  <input type="email" placeholder="contacto@empresa.com" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </div>
            </section>

            {(tiene('astilladora') || tiene('instalacion')) && (
              <section className="em-section">
                <div className="em-section-title"><Clock size={12} /> Horario</div>
                <div className="modal-field">
                  <input type="text" placeholder="Ej: L-V 8:00-14:00 y 15:00-18:00 · Sáb 8:00-13:00"
                    value={form.horario} onChange={e => set('horario', e.target.value)} />
                  <div className="em-hint">Se muestra al transportista/conductor al confirmar en campo</div>
                </div>
              </section>
            )}

            {editando && (tiene('astilladora') || tiene('instalacion') || tiene('proveedor')) && (() => {
              const logoId  = `empresa_${slugify(form.nombre)}`
              const logoUrl = logos[logoId]
              const subiendo = !!subiendoLogo[logoId]
              return (
                <section className="em-section">
                  <div className="em-section-title"><Image size={12} /> {tiene('astilladora') || tiene('instalacion') ? 'Logo · firma y sello' : 'Logo'}</div>
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
                      <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6,padding:'6px 8px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:4}}>
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
                  <div className="em-hint" style={{marginTop:6}}>PNG, JPG o WEBP · {tiene('astilladora') || tiene('instalacion') ? 'Cabecera del panel y firma/sello al confirmar desde el campo' : 'Cabecera de su panel y su ficha de cliente'}</div>
                </section>
              )
            })()}

            {/* ── Trabajadores y máquinas (solo astilladora) ── */}
            {tiene('astilladora') && (
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
            {error && <div className="em-error">{error}</div>}
            <button className="btn" onClick={cerrarModal}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleGuardar} disabled={!puedeGuardar}>
              {guardando ? 'Guardando...' : <><Check size={14} /> {editando ? 'Guardar cambios' : 'Crear'}</>}
            </button>
          </div>
        </div>
      </div>
  )
}

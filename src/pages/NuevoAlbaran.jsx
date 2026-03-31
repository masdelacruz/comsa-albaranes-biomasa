import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '../supabase'
import { ESPECIES, TIPOS_BIOMASA } from '../data/mockData'
import '../components/shared.css'
import './NuevoAlbaran.css'

const DOCS_OP1 = ['Autodeclaración','Acuerdo de cesión','Contrato prestación servicios','Permiso de corta']
const DOCS_OP2 = ['Certificado SURE','Permiso de obra','Contrato prestación servicios']

export default function NuevoAlbaran({ addAlbaran }) {
  const navigate = useNavigate()
  const [guardado, setGuardado]             = useState(false)
  const [proveedores, setProveedores]       = useState([])
  const [astilladoras, setAstilladoras]     = useState([])
  const [transportistas, setTransportistas] = useState([])
  const [instalaciones, setInstalaciones]   = useState([])

  useEffect(() => {
    supabase.from('proveedores').select('*').eq('activo', true).order('nombre').then(({ data }) => {
      setProveedores((data || []).filter(p => p.tipo === 'proveedor').map(p => p.nombre))
      setAstilladoras((data || []).filter(p => p.tipo === 'astilladora').map(p => p.nombre))
      setTransportistas((data || []).filter(p => p.tipo === 'transportista').map(p => p.nombre))
      setInstalaciones((data || []).filter(p => p.tipo === 'instalacion').map(p => p.nombre))
    })
  }, [])

  const [form, setForm] = useState({
    tipo: 'Opció 1 — Compra en monte / plataforma',
    proveedor: '', astilladora: '', transportista: '', instalacion: '',
    especie: ESPECIES[0], tipoBiomasa: TIPOS_BIOMASA[0],
    origen: '', mapsOrigen: '', mapsDestino: '', permiso: '', observaciones: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '08:00', numCamiones: 1,
    chofer: '', matriculaTractora: '', matriculaRemolque: '',
    certificacion: '',
  })

  const esOp1 = form.tipo.includes('1')
  const set   = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const camposObligatorios = form.proveedor && form.instalacion && (!esOp1 || (form.astilladora && form.transportista))

  const handleGuardar = async () => {
    setGuardado(true)
    const id = await addAlbaran(form)
    setTimeout(() => navigate(`/albaran/${id}`), 1200)
  }

  if (guardado) return (
    <div className="nuevo-saved">
      <CheckCircle size={48} color="var(--green-400)" />
      <h2>Albarán creado</h2>
      <p>Redirigiendo al detalle...</p>
    </div>
  )

  return (
    <div className="nuevo-page">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')} style={{marginBottom:12}}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div className="page-title">Nuevo albarán</div>
        <div className="page-sub">El enlace de campo se genera automáticamente al guardar</div>
      </div>

      <div className="nuevo-content">

        <div className="form-section card">
          <div className="section-label">Tipo de operación</div>
          <div className="tipo-btns">
            {['Opció 1 — Compra en monte / plataforma','Opció 2 — Proveedor directo'].map(t => (
              <button key={t} className={`tipo-btn ${form.tipo === t ? 'active' : ''}`} onClick={() => set('tipo', t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="form-section card">
          <div className="section-label">Actores del albarán</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Proveedor *</label>
              <select value={form.proveedor} onChange={e => set('proveedor', e.target.value)}>
                <option value="">Selecciona proveedor...</option>
                {proveedores.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            {esOp1 && (
              <div className="form-field">
                <label>Astilladora *</label>
                <select value={form.astilladora} onChange={e => set('astilladora', e.target.value)}>
                  <option value="">Selecciona astilladora...</option>
                  {astilladoras.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            )}
            {esOp1 && (
              <div className="form-field">
                <label>Transportista *</label>
                <select value={form.transportista} onChange={e => set('transportista', e.target.value)}>
                  <option value="">Selecciona transportista...</option>
                  {transportistas.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div className="form-field">
              <label>Instalación destino *</label>
              <select value={form.instalacion} onChange={e => set('instalacion', e.target.value)}>
                <option value="">Selecciona instalación...</option>
                {instalaciones.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section card">
          <div className="section-label">Biomasa y logística</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Fecha de carga</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Hora estimada</label>
              <input type="time" value={form.hora} onChange={e => set('hora', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Tipo biomasa</label>
              <select value={form.tipoBiomasa} onChange={e => set('tipoBiomasa', e.target.value)}>
                {TIPOS_BIOMASA.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Especie</label>
              <select value={form.especie} onChange={e => set('especie', e.target.value)}>
                {ESPECIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <label>Origen biomasa (paraje / término municipal)</label>
              <input type="text" placeholder="Ej: Mas de les Guilles, Arbúcies (Selva)" value={form.origen} onChange={e => set('origen', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Maps origen</label>
              <input type="url" placeholder="https://maps.google.com/..." value={form.mapsOrigen} onChange={e => set('mapsOrigen', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Maps destino</label>
              <input type="url" placeholder="https://maps.google.com/..." value={form.mapsDestino} onChange={e => set('mapsDestino', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Permiso / referencia</label>
              <input type="text" placeholder="Nº permiso de corta o SURE" value={form.permiso} onChange={e => set('permiso', e.target.value)} />
            </div>
            <div className="form-field full">
              <label>Observaciones</label>
              <textarea placeholder="Ej: Piso móvil 90m³. Acceso restringido a partir de las 14h." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
        </div>

        {esOp1 && (
          <div className="form-section card">
            <div className="section-label">Datos del transporte</div>
            <div className="form-grid">
              <div className="form-field">
                <label>Chófer</label>
                <input type="text" placeholder="Nombre del chófer" value={form.chofer} onChange={e => set('chofer', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Matrícula tractora</label>
                <input type="text" placeholder="Ej: 1234 ABC" value={form.matriculaTractora} onChange={e => set('matriculaTractora', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Matrícula remolque</label>
                <input type="text" placeholder="Ej: R-1234-ABC" value={form.matriculaRemolque} onChange={e => set('matriculaRemolque', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Nº aprox. camiones</label>
                <input type="number" min="1" value={form.numCamiones} onChange={e => set('numCamiones', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className="form-section card">
          <div className="section-label">Certificación</div>
          <div style={{display:'flex',gap:24}}>
            {['SURE','PEFC'].map(cert => (
              <label key={cert} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:500,color:'var(--gray-700)'}}>
                <input
                  type="checkbox"
                  checked={form.certificacion?.includes(cert)}
                  onChange={(e) => {
                    const actual = form.certificacion ? form.certificacion.split(',').filter(Boolean) : []
                    const nueva = e.target.checked ? [...actual, cert] : actual.filter(c => c !== cert)
                    set('certificacion', nueva.join(','))
                  }}
                  style={{width:16,height:16,accentColor:'var(--green-400)',cursor:'pointer'}}
                />
                {cert}
              </label>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/dashboard')}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={!camposObligatorios}>
            <CheckCircle size={15} /> Guardar y generar enlace de campo
          </button>
        </div>

      </div>
    </div>
  )
}
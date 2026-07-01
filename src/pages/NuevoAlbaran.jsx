import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import { ESPECIES, ESPECIES_TIPO, TIPOS_BIOMASA } from '../data/mockData'
import SelectField from '../components/SelectField'
import '../components/shared.css'
import './NuevoAlbaran.css'

const DOCS_OP1 = ['Autodeclaración','Acuerdo de cesión','Contrato prestación servicios','Permiso de corta']
const DOCS_OP2 = ['Certificado SURE','Permiso de obra','Contrato prestación servicios']

export default function NuevoAlbaran({ addAlbaran }) {
  const navigate = useNavigate()
  const [guardado, setGuardado]             = useState(false)
  const [guardando, setGuardando]           = useState(false)
  const [errorGuardar, setErrorGuardar]     = useState('')
  const [numCamiones, setNumCamiones]       = useState(1)
  const [progreso, setProgreso]             = useState(0)
  const [proveedores, setProveedores]       = useState([])
  const [astilladoras, setAstilladoras]     = useState([])
  const [transportistas, setTransportistas] = useState([])
  const [instalaciones, setInstalaciones]   = useState([])
  const [tiposBiomasa, setTiposBiomasa]     = useState(TIPOS_BIOMASA)
  const [especiesTipo, setEspeciesTipo]     = useState(ESPECIES_TIPO)
  const [estellas, setEstellas]             = useState(ESPECIES)

  useEffect(() => {
    api.get('/empresas?activo=true').then(data => {
      const d = data || []
      setProveedores(   d.filter(p => p.tipo === 'proveedor'   ).map(p => p.nombre))
      setAstilladoras(  d.filter(p => p.tipo === 'astilladora' ).map(p => p.nombre))
      setTransportistas(d.filter(p => p.tipo === 'transportista').map(p => p.nombre))
      setInstalaciones( d.filter(p => p.tipo === 'instalacion' ).map(p => p.nombre))
    }).catch(() => {})
    api.get('/elementos').then(data => {
      if (data?.tipoBiomasa?.length) setTiposBiomasa(data.tipoBiomasa.map(e => e.valor))
      if (data?.especie?.length)     setEspeciesTipo(data.especie.map(e => e.valor))
      if (data?.estella?.length)     setEstellas(data.estella.map(e => e.valor))
    }).catch(() => {})
  }, [])

  const [form, setForm] = useState({
    tipo: 'Opción 1 — Compra en monte / plataforma',
    proveedor: '', astilladora: '', transportista: '', instalacion: '',
    especie: '', tipoBiomasa: '', estella: '',
    origen: '', mapsOrigen: '', mapsDestino: '', permiso: '', observaciones: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '08:00',
    certificacion: '',
  })

  const esOp1 = form.tipo.includes('1')
  const set   = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const camposObligatorios = form.proveedor && form.instalacion && form.especie && form.tipoBiomasa && (!esOp1 || (form.astilladora && form.transportista))

  const handleGuardar = async (enviarACampo = false) => {
    setGuardando(true)
    setErrorGuardar('')
    try {
      if (numCamiones === 1) {
        const id = await addAlbaran({ ...form, numCamiones: 1, grupoId: null, camionOrden: 1 }, enviarACampo)
        setGuardado(true)
        setTimeout(() => navigate(`/albaran/${id}`), 1200)
      } else {
        const grupoId = crypto.randomUUID()
        for (let i = 0; i < numCamiones; i++) {
          setProgreso(i + 1)
          await addAlbaran({ ...form, numCamiones: 1, grupoId, camionOrden: i + 1 }, enviarACampo)
        }
        setGuardado(true)
        setTimeout(() => navigate('/dashboard'), 1200)
      }
    } catch {
      setErrorGuardar('Error al guardar. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (guardado) return (
    <div className="nuevo-saved">
      <CheckCircle size={48} color="var(--green-400)" />
      {numCamiones > 1 && progreso < numCamiones ? (
        <>
          <h2>Creando albaranes...</h2>
          <p>{progreso} de {numCamiones} creados</p>
        </>
      ) : (
        <>
          <h2>{numCamiones > 1 ? `${numCamiones} albaranes creados` : 'Albarán creado'}</h2>
          <p>Redirigiendo{numCamiones > 1 ? ' al panel' : ' al detalle'}...</p>
        </>
      )}
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
            {['Opción 1 — Compra en monte / plataforma','Opción 2 — Proveedor directo'].map(t => (
              <button key={t} className={`tipo-btn ${form.tipo === t ? 'active' : ''}`} onClick={() => set('tipo', t)}>{t}</button>
            ))}
          </div>
        </div>

        <div className="form-section card">
          <div className="section-label">Actores del albarán</div>
          <div className="form-grid">
            <div className="form-field">
              <label>Proveedor *</label>
              <SelectField value={form.proveedor} onChange={v => set('proveedor', v)} options={proveedores} placeholder="Selecciona proveedor..." clearable />
            </div>
            {esOp1 && (
              <div className="form-field">
                <label>Astilladora *</label>
                <SelectField value={form.astilladora} onChange={v => set('astilladora', v)} options={astilladoras} placeholder="Selecciona astilladora..." clearable />
              </div>
            )}
            {esOp1 && (
              <div className="form-field">
                <label>Transportista *</label>
                <SelectField value={form.transportista} onChange={v => set('transportista', v)} options={transportistas} placeholder="Selecciona transportista..." clearable />
              </div>
            )}
            <div className="form-field">
              <label>Instalación *</label>
              <SelectField value={form.instalacion} onChange={v => set('instalacion', v)} options={instalaciones} placeholder="Selecciona instalación..." clearable />
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
              <label>Especie *</label>
              <SelectField value={form.especie} onChange={v => set('especie', v)} options={especiesTipo} placeholder="Selecciona especie..." clearable />
            </div>
            <div className="form-field">
              <label>Tipo biomasa *</label>
              <SelectField value={form.tipoBiomasa} onChange={v => set('tipoBiomasa', v)} options={tiposBiomasa} placeholder="Selecciona tipo biomasa..." clearable />
            </div>
            <div className="form-field">
              <label>Estella</label>
              <SelectField value={form.estella} onChange={v => set('estella', v)} options={estellas} placeholder="Selecciona estella..." clearable />
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
            <div className="form-field">
              <label>Número de camiones</label>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button type="button" className="btn" style={{padding:'4px 12px',fontSize:18,lineHeight:1}} onClick={() => setNumCamiones(n => Math.max(1, n-1))}>−</button>
                <span style={{fontSize:16,fontWeight:600,minWidth:28,textAlign:'center'}}>{numCamiones}</span>
                <button type="button" className="btn" style={{padding:'4px 12px',fontSize:18,lineHeight:1}} onClick={() => setNumCamiones(n => Math.min(20, n+1))}>+</button>
              </div>
              {numCamiones > 1 && (
                <div style={{fontSize:12,color:'var(--green-600)',marginTop:4}}>
                  Se crearán {numCamiones} albaranes independientes con los mismos datos
                </div>
              )}
            </div>
            <div className="form-field full">
              <label>Observaciones</label>
              <textarea placeholder="Ej: Piso móvil 90m³. Acceso restringido a partir de las 14h." value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
            </div>
          </div>
        </div>

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

        {errorGuardar && (
          <div style={{padding:'10px 14px',background:'var(--red-50)',border:'1px solid var(--red-100)',borderRadius:'var(--radius-md)',color:'var(--red-700)',fontSize:13,marginTop:8}}>
            {errorGuardar}
          </div>
        )}
        <div className="form-actions">
          <button className="btn" onClick={() => navigate('/dashboard')}>Cancelar</button>
          <button className="btn" onClick={() => handleGuardar(false)} disabled={!camposObligatorios || guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
          <button className="btn btn-primary" onClick={() => handleGuardar(true)} disabled={!camposObligatorios || guardando}>
            {guardando
              ? <><div style={{width:13,height:13,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> Guardando...</>
              : <><CheckCircle size={15} /> Guardar y enviar a campo</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
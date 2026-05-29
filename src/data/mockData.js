export const ASTILLADORAS = [
  'Zefferino Biomass','Fugarolas Biomassa','Talabé Manteniments',
  'Lopez & Ruibal','Bioforestal Buscail','Servimag 2019','Serveis Forestals KQ',
]
export const TRANSPORTISTAS = [
  'Transports Porqueres','Novare','Lopez & Ruibal','R&T Transports',
]
export const INSTALACIONES = [
  'Termosolar Borges','Cromogenia','Piensos Mazana Fabardo',
  'Piensos Nafosa','Ajuntament de Begues','Aigües de Vilafranca',
]
export const ESPECIES_TIPO = ['Pinus SP', 'Otros']
export const ESPECIES = [
  'Estella ACO100','Estella ACO50','Estella ACO30',
  'Estella TRO100','Estella TRO50','Estella TRO30',
  'Estella TRO100C','Estella TRO50C','Estella TRO30C',
]
export const TIPOS_BIOMASA = ['Forestal','Industrial','Agrícola']

export const mockAlbaranes = [
  {
    id: 'ALB-2025-044', fecha: '2025-03-26', hora: '08:30', numCamiones: 3,
    tipo: 'Opció 1', astilladora: 'Zefferino Biomass', transportista: 'Transports Porqueres',
    instalacion: 'Termosolar Borges', especie: 'Pi roig', tipoBiomasa: 'Astilla forestal',
    origen: 'Mas de les Guilles, Arbúcies (Selva)', permiso: 'PC-2025-0312',
    observaciones: 'Piso móvil 90m³', estado: 'en_transito',
    firmas: {
      oficina:     { firmado: true,  fecha: '26/03/2025 07:50', actor: 'Marc Marin' },
      astilladora: { firmado: true,  fecha: '26/03/2025 09:14', actor: 'Zefferino Biomass' },
      camionero:   { firmado: false, fecha: null, actor: 'Transports Porqueres' },
      instalacion: { firmado: false, fecha: null, actor: 'Termosolar Borges' },
    },
    docs: { autodeclaracion: true, acuerdoCesion: true, contratoServicios: true, permisoCorta: false },
    pesada: { entrada: null, salida: null, humedad: null, ticketAdjunto: false },
    actividad: [
      { ts: '26/03 07:50', texto: 'Albarán creado', actor: 'Marc Marin' },
      { ts: '26/03 07:51', texto: 'Enlace enviado a astilladora', actor: 'Sistema' },
      { ts: '26/03 09:14', texto: 'Astilladora confirmó y firmó', actor: 'Zefferino Biomass' },
      { ts: '26/03 09:15', texto: 'Enlace enviado a camionero', actor: 'Sistema' },
    ],
  },
  {
    id: 'ALB-2025-043', fecha: '2025-03-26', hora: '09:00', numCamiones: 2,
    tipo: 'Opció 1', astilladora: 'Fugarolas Biomassa', transportista: 'Novare',
    instalacion: 'Cromogenia', especie: 'Eucaliptus', tipoBiomasa: 'Astilla forestal',
    origen: 'Finca Can Trias, Tordera (Maresme)', permiso: 'PC-2025-0308',
    observaciones: 'Volquete 45m³', estado: 'pendiente_campo',
    firmas: {
      oficina:     { firmado: true,  fecha: '26/03/2025 08:00', actor: 'Marc Marin' },
      astilladora: { firmado: false, fecha: null, actor: 'Fugarolas Biomassa' },
      camionero:   { firmado: false, fecha: null, actor: 'Novare' },
      instalacion: { firmado: false, fecha: null, actor: 'Cromogenia' },
    },
    docs: { autodeclaracion: true, acuerdoCesion: false, contratoServicios: true, permisoCorta: false },
    pesada: { entrada: null, salida: null, humedad: null, ticketAdjunto: false },
    actividad: [
      { ts: '26/03 08:00', texto: 'Albarán creado', actor: 'Marc Marin' },
      { ts: '26/03 08:01', texto: 'Enlace enviado a astilladora', actor: 'Sistema' },
    ],
  },
  {
    id: 'ALB-2025-041', fecha: '2025-03-25', hora: '07:00', numCamiones: 4,
    tipo: 'Opció 1', astilladora: 'Zefferino Biomass', transportista: 'Transports Porqueres',
    instalacion: 'Aigües de Vilafranca', especie: 'Pi pinyer', tipoBiomasa: 'Astilla forestal',
    origen: 'Paratge el Garrofer, Vilafranca del Penedès', permiso: 'PC-2025-0299',
    observaciones: 'Piso móvil 90m³. Muestra de humedad enviada.', estado: 'humedad_pendiente',
    firmas: {
      oficina:     { firmado: true, fecha: '25/03/2025 06:45', actor: 'Marc Marin' },
      astilladora: { firmado: true, fecha: '25/03/2025 08:10', actor: 'Zefferino Biomass' },
      camionero:   { firmado: true, fecha: '25/03/2025 08:45', actor: 'Transports Porqueres' },
      instalacion: { firmado: true, fecha: '25/03/2025 11:20', actor: 'Aigües de Vilafranca' },
    },
    docs: { autodeclaracion: true, acuerdoCesion: true, contratoServicios: true, permisoCorta: true },
    pesada: { entrada: 28400, salida: 14200, humedad: null, ticketAdjunto: true },
    actividad: [
      { ts: '25/03 06:45', texto: 'Albarán creado', actor: 'Marc Marin' },
      { ts: '25/03 08:10', texto: 'Astilladora firmó', actor: 'Zefferino Biomass' },
      { ts: '25/03 08:45', texto: 'Camionero firmó', actor: 'Transports Porqueres' },
      { ts: '25/03 11:20', texto: 'Instalación confirmó recepción', actor: 'Aigües de Vilafranca' },
      { ts: '25/03 11:21', texto: 'Muestra enviada a laboratorio', actor: 'Marc Marin' },
    ],
  },
  {
    id: 'ALB-2025-040', fecha: '2025-03-25', hora: '10:00', numCamiones: 2,
    tipo: 'Opció 2', astilladora: 'Talabé Manteniments', transportista: 'R&T Transports',
    instalacion: 'Piensos Nafosa', especie: 'Acacia', tipoBiomasa: 'Astilla industrial',
    origen: 'Base Talabé, Igualada', permiso: 'SURE-2025-TAL-04',
    observaciones: 'Piso móvil 90m³', estado: 'cerrado',
    firmas: {
      oficina:     { firmado: true, fecha: '25/03/2025 09:00', actor: 'Maite (Admin)' },
      astilladora: { firmado: true, fecha: '25/03/2025 10:30', actor: 'Talabé Manteniments' },
      camionero:   { firmado: true, fecha: '25/03/2025 11:00', actor: 'R&T Transports' },
      instalacion: { firmado: true, fecha: '25/03/2025 14:15', actor: 'Piensos Nafosa' },
    },
    docs: { contratoServicios: true, certSURE: true, permisoObra: true },
    pesada: { entrada: 31200, salida: 15600, humedad: 28.4, ticketAdjunto: true },
    actividad: [
      { ts: '25/03 09:00', texto: 'Albarán creado', actor: 'Maite (Admin)' },
      { ts: '25/03 10:30', texto: 'Astilladora firmó', actor: 'Talabé Manteniments' },
      { ts: '25/03 11:00', texto: 'Camionero firmó', actor: 'R&T Transports' },
      { ts: '25/03 14:15', texto: 'Recepción confirmada', actor: 'Piensos Nafosa' },
      { ts: '25/03 14:16', texto: 'Albarán cerrado automáticamente', actor: 'Sistema' },
    ],
  },
  {
    id: 'ALB-2025-039', fecha: '2025-03-24', hora: '08:00', numCamiones: 3,
    tipo: 'Opció 1', astilladora: 'Zefferino Biomass', transportista: 'Transports Porqueres',
    instalacion: 'Ajuntament de Begues', especie: 'Pi roig', tipoBiomasa: 'Astilla forestal',
    origen: 'Mas Canyet, Begues (Baix Llobregat)', permiso: 'PC-2025-0291',
    observaciones: 'Piso móvil 90m³. Caldera nº 2.', estado: 'cerrado',
    firmas: {
      oficina:     { firmado: true, fecha: '24/03/2025 07:30', actor: 'Marc Marin' },
      astilladora: { firmado: true, fecha: '24/03/2025 08:50', actor: 'Zefferino Biomass' },
      camionero:   { firmado: true, fecha: '24/03/2025 09:15', actor: 'Transports Porqueres' },
      instalacion: { firmado: true, fecha: '24/03/2025 12:40', actor: 'Ajuntament de Begues' },
    },
    docs: { autodeclaracion: true, acuerdoCesion: true, contratoServicios: true, permisoCorta: true },
    pesada: { entrada: 29800, salida: 14900, humedad: 31.2, ticketAdjunto: true },
    actividad: [
      { ts: '24/03 07:30', texto: 'Albarán creado', actor: 'Marc Marin' },
      { ts: '24/03 08:50', texto: 'Astilladora firmó', actor: 'Zefferino Biomass' },
      { ts: '24/03 09:15', texto: 'Camionero firmó', actor: 'Transports Porqueres' },
      { ts: '24/03 12:40', texto: 'Recepción confirmada', actor: 'Ajuntament de Begues' },
      { ts: '24/03 12:41', texto: 'Albarán cerrado automáticamente', actor: 'Sistema' },
    ],
  },
]
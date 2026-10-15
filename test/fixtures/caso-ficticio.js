// Caso de prueba TOTALMENTE FICTICIO. No contiene información de pacientes reales.
// El guion responde según el identificador de la pregunta que el MOTOR elija: si el motor
// pregunta algo distinto, el guion se adapta (las respuestas no siguen una lista fija).
// Las respuestas usan los códigos de alternativa del protocolo (A Sí · B No · C Ocasionalmente ·
// D No sabe/No recuerda) o texto libre en preguntas abiertas.

export const ETIQUETA = 'Caso ficticio A (demostración)';

/** Síntomas que el apoderado ficticio refiere (presencia «A» = Sí). */
export const SINTOMAS_SI = ['R1.1', 'R1.2', 'R1.3', 'R1.4', 'R1.6', 'R1.7', 'R1.8', 'R1.9', 'R2.9'];
/** Síntoma con respuesta «No sabe / No recuerda». */
export const SINTOMA_NS = 'R1.5';

export const GUION = {
  'INI-MOTIVO': { texto: 'Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas.' },
  'INI-EDAD': { texto: '8 años' },
  'INI-INF-EXISTE': { opcion: 'A' },
  'INI-INF-DISP': { opcion: 'A' },
  BARRIDO: { opciones: ['C'] },      // Sueño → deriva la categoría D del tamizaje
  TAMIZAJE: { opciones: ['D'] },
  A52: { texto: 'Lo que más preocupa es que se está quedando atrás en lectura y se frustra.' },
};

const SIMBOLO = { A01: 'R1.1', A02: 'R1.2', A03: 'R1.3', A04: 'R1.4', A05: 'R1.4', A06: 'R1.5', A07: 'R1.6', A08: 'R1.7', A09: 'R1.8', A10: 'R1.9',
  A12: 'R2.1', A11: 'R2.2', A13: 'R2.3', A14: 'R2.4', A15: 'R2.5', A16: 'R2.6', A17: 'R2.7', A18: 'R2.8', A19: 'R2.9' };

export function respuestaPorDefecto(q) {
  if (q.tipo === 'numero') return { texto: '8' };
  if (q.tipo === 'abierta') return { texto: 'Dato de prueba ficticio.' };
  if (q.tipo === 'multiple') return { opciones: [q.opciones[0].codigo] };
  return { opcion: 'B' };
}

export function respuestaPara(q) {
  if (GUION[q.id]) return GUION[q.id];
  const s = SIMBOLO[q.id];
  if (s) return { opcion: SINTOMAS_SI.includes(s) ? 'A' : s === SINTOMA_NS ? 'D' : 'B' };
  if (/-FRECUENCIA$/.test(q.id)) return { opcion: 'A' };
  if (/-DESDE$/.test(q.id)) return { opcion: 'B' };
  if (/-CONTEXTOS$/.test(q.id)) return { opciones: ['A', 'B'] };
  if (/^BAR-C-/.test(q.id) || /^TAM-D-/.test(q.id)) return q.tipo === 'abierta' ? { texto: 'Le cuesta dormirse; ronca algunas noches.' } : { opcion: 'A' };
  if (['A22', 'A25', 'A38', 'A47', 'A50'].includes(q.id)) return { opcion: 'A' };
  return respuestaPorDefecto(q);
}

/** Informe escolar ficticio (Ruta B). */
export const INFORME_ESCOLAR = [
  'Informe de la profesora jefe (ficticio).',
  'En clases se distrae con facilidad, varias veces al día, con ruidos o compañeros.',
  'No termina las tareas que comienza y deja guías incompletas.',
  'Pierde sus útiles con frecuencia.',
  'No interrumpe a sus compañeros.',
  'Su rendimiento ha bajado este semestre, sobre todo en lenguaje.',
  'Las dificultades se observan desde primero básico.',
].join('\n');

/** Instrumentos ficticios (todos opcionales en el protocolo vigente). */
export const INSTRUMENTOS = [
  { instrumento_id: 'NESPLORA', estado: 'realizada', fecha: '2026-10-01', aplicador: 'Profesional de prueba', resultados: { atencion_sostenida: 'bajo lo esperado (ficticio)', impulsividad: 'dentro de lo esperado (ficticio)' }, observaciones: 'Resultado ficticio de demostración.' },
  { instrumento_id: 'ESCALA-DOCENTE', estado: 'no_aplica', observaciones: 'El informe escolar narrativo cubre la información del docente (ficticio).' },
];

export const INTERPRETACION = 'Texto de demostración (ficticio): el profesional integra la entrevista, el informe escolar y la evaluación complementaria; considera la discrepancia en R2.9 y la información de sueño antes de concluir.';

/** Consentimiento informado ficticio del representante legal (obligatorio para crear un caso). */
export const CONSENTIMIENTO = { acepta: true, otorgante: 'Representante ficticio (documento de consentimiento N° 0001)', relacion: 'madre', medio: 'escrito_firmado', profesional: 'Profesional de prueba' };
export const ASENTIMIENTO = { acepta: true, profesional: 'Profesional de prueba', medio: 'verbal_registrado' };

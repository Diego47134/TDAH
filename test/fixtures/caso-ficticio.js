// Caso de prueba TOTALMENTE FICTICIO. No contiene información de pacientes reales.
// El guion responde según el identificador de la pregunta que el MOTOR elija: si el motor
// pregunta algo distinto, el guion se adapta (las respuestas no siguen una lista fija).

export const ETIQUETA = 'Caso ficticio A (demostración)';

export const GUION = {
  'INI-MOTIVO': 'Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.',
  'INI-EDAD': '8 años',
  'INI-INF-EXISTE': 'Sí, la profesora jefe hizo uno',
  'INI-INF-DISP': 'Sí, el colegio lo puede enviar',
  'INA-SOST-FRECUENCIA': 'Varias veces al día',
  'INA-SOST-CONTEXTOS': 'En la casa con las tareas y también lo dicen en el colegio',
  'INA-SOST-INICIO': 'Desde los 5 o 6 años, cuando entró a kínder',
  'INA-SOST-IMPACTO': 'Las tareas le toman el doble de tiempo y hay discusiones en la casa',
  'TAM-SUENO-DESCRIPCION': 'Le cuesta dormirse y se despierta en la noche, desde hace un año',
  'TAM-SUENO-EVALUADO_PROFESIONAL': { tipo: 'no_se' },
  'INA-ORG-P1': 'Sí, siempre hay que recordarle',
  'INA-ORG-FRECUENCIA': 'Todos los días',
  'INA-ORG-CONTEXTOS': 'En la casa y en el colegio',
  'INA-ORG-INICIO': { tipo: 'no_recuerdo' },
  'INA-ORG-IMPACTO': 'Llega con tareas incompletas al colegio',
  'INA-OLV-P1': 'A veces',
  'INA-OLV-P2': 'Sí, bastantes veces',
  'INA-OLV-FRECUENCIA': 'Una o dos veces por semana',
  'INA-OLV-CONTEXTOS': 'Colegio, sobre todo con útiles y la colación',
  'INA-OLV-INICIO': 'Desde que entró al colegio',
  'INA-OLV-IMPACTO': 'Hay que reponer materiales y a veces le anotan',
  'HIP-MOT-P1': 'No, en la casa es tranquilo',
  'IMP-ESPERA-P1': 'No',
  'IMP-INTERR-P1': 'Sí',
  'IMP-INTERR-FRECUENCIA': 'Algunas veces por semana',
  'IMP-INTERR-CONTEXTOS': 'Sobre todo en la casa, en las comidas',
  'IMP-INTERR-INICIO': 'No sé',
  'IMP-INTERR-IMPACTO': 'Molesta a sus hermanos, pero no es lo principal',
  'DES-HITOS-P1': 'No, todo normal',
  'TRA-EVOL-P1': 'Sí, este año empeoró',
  'TRA-EVOL-DESCRIPCION': 'Antes se notaba menos; con más exigencia escolar aumentaron las dificultades',
  'AUT-RUTINAS-P1': 'Sí, hay que ayudarlo a vestirse y preparar la mochila',
  'AUT-RUTINAS-DESCRIPCION': 'Necesita supervisión diaria para las rutinas de la mañana',
  'FUN-FAMILIA-P1': 'Sí',
  'FUN-FAMILIA-DESCRIPCION': 'Las tareas generan tensión y discusiones casi a diario',
  'FUN-PARES-P1': 'No, tiene amigos',
  'ESC-AULA-P1': 'No que yo sepa, nunca nos han dicho nada',
  'TAM-VISION-P1': 'No',
  'TAM-AUDICION-P1': 'No',
  'TAM-MEDICO-P1': 'No',
};

export function respuestaPorDefecto(q) {
  if (q.tipo_dato === 'si_no') return { texto: 'No' };
  if (q.tipo_dato === 'numero') return { texto: '9' };
  return { texto: 'Dato de prueba (sin guion)' };
}

export function respuestaPara(q) {
  const g = GUION[q.id];
  if (g == null) return respuestaPorDefecto(q);
  return typeof g === 'string' ? { texto: g } : { texto: g.texto ?? '', tipo: g.tipo };
}

export const INFORME_ESCOLAR = `Informe de profesora jefe (documento ficticio para pruebas).
El estudiante se distrae frecuentemente durante las clases y necesita apoyo para iniciar las tareas.
Es inquieto: se para de su puesto varias veces por clase.
Presenta notas bajas en Lenguaje y Matemática durante el primer semestre.`;

export const INSTRUMENTOS = [
  { instrumento_id: 'ESCALA-APODERADO', estado: 'realizada', fecha: '2026-10-10', aplicador: 'Profesional de prueba',
    resultados: { 'Inatención (ficticio)': '18/27', 'Hiperactividad-impulsividad (ficticio)': '9/27' } },
  { instrumento_id: 'ESCALA-DOCENTE', estado: 'realizada', fecha: '2026-10-12', aplicador: 'Profesora jefe (ficticia)',
    resultados: { 'Inatención (ficticio)': '21/27', 'Hiperactividad-impulsividad (ficticio)': '14/27' } },
  { instrumento_id: 'NESPLORA', estado: 'realizada', fecha: '2026-10-14', aplicador: 'Profesional de prueba',
    resultados: { 'Omisiones (ficticio)': 'percentil 12', 'Comisiones (ficticio)': 'percentil 40' },
    observaciones: 'Valores ficticios para la demostración técnica.' },
];

export const INTERPRETACION = '[TEXTO DE DEMOSTRACIÓN — caso ficticio, sin valor clínico] El profesional responsable redacta aquí su interpretación integrando entrevista, informe escolar, instrumentos, explicaciones alternativas (p. ej. el sueño, pendiente de verificación) y la discrepancia entre contextos registrada.';

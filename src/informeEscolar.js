// Recepción y extracción estructurada del informe escolar (Etapa 7 §5.2; brief §8).
// Cada dato extraído conserva su fuente (informe_escolar) y la frase literal que lo respalda.
import { normalizar } from './protocolo.js';

const FRECUENCIA = [
  [/\b(siempre|constantemente|constante|todo el tiempo|varias veces (al|por) dia|varias veces por clase|cada clase)\b/, 'varias_al_dia'],
  [/\b(frecuentemente|con frecuencia|a menudo|diariamente|todos los dias|casi siempre|habitualmente|suele|tiende a)\b/, 'casi_todos_los_dias'],
  [/\b(a veces|ocasionalmente|en ocasiones|algunas veces)\b/, 'ocasionalmente'],
];
// Formas en que los informes escolares suelen describir cada conducta (raíces: se buscan como inicio de palabra).
// Complementan las palabras clave del protocolo, que provienen de la entrevista al apoderado.
const LEXICO_ESCOLAR = {
  'R1.1': ['errores por descuido', 'por descuido', 'no leer instrucciones', 'no lee las instrucciones', 'omision de preguntas', 'omite preguntas', 'no revisa'],
  'R1.2': ['foco atencional por periodos', 'periodos muy breves', 'periodos breves', 'mantener la atencion', 'mantener el foco', 'mantener la concentracion', 'le cuesta concentrar', 'pierde la concentracion'],
  'R1.3': ['parece no escuchar', 'no escucha cuando', 'no atiende cuando se le habla'],
  'R1.4': ['completar las tareas', 'completar sus tareas', 'completar los trabajos', 'terminar las tareas', 'terminar sus tareas', 'no termina', 'no completa', 'deja inconclus'],
  'R1.5': ['desorden', 'desorganiza', 'organizar sus', 'organizarse'],
  'R1.6': ['evita las tareas', 'evita actividades', 'rechaza las tareas', 'esfuerzo mental'],
  'R1.7': ['pierde', 'extravia'],
  'R1.8': ['se distrae', 'distraccion', 'distraible', 'distractores'],
  'R1.9': ['olvida', 'olvidos', 'olvidadiz'],
  'R2.1': ['inquietud', 'inquiet', 'se mueve en el asiento', 'se sienta de manera inadecuada', 'balancea'],
  'R2.2': ['permanecer sentado', 'permanecer sentada', 'se levanta', 'se para de su puesto', 'abandona su puesto'],
  'R2.3': ['corre por', 'trepa'],
  'R2.4': ['jugar tranquil', 'actividades tranquil'],
  'R2.5': ['no para', 'siempre en movimiento', 'como un motor'],
  'R2.6': ['habla excesiv', 'habla mucho', 'habla en exceso', 'conversa constantemente'],
  'R2.7': ['responde antes', 'contesta antes', 'responde sin esperar', 'se adelanta a responder'],
  'R2.8': ['esperar su turno', 'esperar turno', 'impacien'],
  'R2.9': ['interrump', 'invade', 'se entromete'],
};
const NEGACION = ['no', 'nunca', 'sin', 'jamas'];

const IMPACTO_ACADEMICO = ['rendimiento academico descendido', 'rendimiento descendido', 'rendimiento fluctuante', 'calificaciones no reflejan', 'rendimiento ha bajado', 'ha bajado su rendimiento', 'bajo su rendimiento', 'bajaron sus notas', 'dificultades academicas', 'se esta quedando atras', 'notas bajas', 'bajo rendimiento', 'rendimiento bajo', 'repitio', 'en riesgo de repitencia', 'calificaciones insuficientes', 'promedio bajo'];
const DESDE = /\b(desde (el|la|los|las)? ?(inicio|comienzo|primer|primero|kinder|pre ?kinder|\d+)[^.;]*|el ano pasado|este ano|este semestre)\b/;

function frases(texto) {
  return String(texto).split(/(?<=[.!?;])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

/** Extracción por reglas: solo lo afirmado explícitamente (Etapa 9 §14.1: no completar por inferencia). */
export function extraerPorReglas(protocolo, texto) {
  let hechos = [];
  const vistos = new Set();
  let desde = null;
  const lineasTexto = String(texto).split(/\n+/);
  for (const f of frases(texto)) {
    const n = ` ${normalizar(f)} `;
    // La frecuencia se busca en toda la línea (una viñeta puede tener varias oraciones separadas por «;»).
    const linea = ` ${normalizar(lineasTexto.find((l) => l.includes(f)) || f)} `;
    for (const s of protocolo.sintomas) {
      if (vistos.has(s.id)) continue;
      let kw = s.palabras_clave.find((k) => n.includes(` ${k} `));
      let i = kw ? n.indexOf(` ${kw} `) : -1;
      if (!kw) {
        kw = (LEXICO_ESCOLAR[s.id] || []).find((k) => n.includes(` ${k}`));
        i = kw ? n.indexOf(` ${kw}`) : -1;
        // «no leer instrucciones» describe la dificultad: la negación es parte de la frase clave.
        if (kw && kw.startsWith('no ')) i = n.length;
      }
      if (!kw) continue;
      const previo = i >= n.length ? [] : n.slice(Math.max(0, i - 20), i).trim().split(' ').slice(-2);
      const valor = previo.some((w) => NEGACION.includes(w)) ? 'no' : 'si';
      if (hechos.some((h) => h.dimension_id === s.id)) {
        // Ya había una mención negativa: una afirmación explícita posterior la reemplaza.
        if (valor === 'no') continue;
        hechos = hechos.filter((h) => h.dimension_id !== s.id);
      }
      if (valor === 'si') vistos.add(s.id);
      hechos.push({ dimension_id: s.id, slot: 'presencia:informe', valor, evidencia: f });
      if (valor === 'si') {
        const fr = FRECUENCIA.find(([re]) => re.test(linea));
        if (fr) hechos.push({ dimension_id: s.id, slot: 'frecuencia', valor: fr[1], evidencia: f });
      }
    }
    if (IMPACTO_ACADEMICO.some((k) => n.includes(` ${k} `)) && !hechos.some((h) => h.slot === 'impacto_academico')) {
      hechos.push({ dimension_id: 'INF', slot: 'impacto_academico', valor: 'si', evidencia: f });
    }
    const d = normalizar(f).match(DESDE);
    if (d && !desde) desde = f;
    if (d && /^desde /.test(d[0]) && !/^desde /.test(normalizar(desde).match(DESDE)[0])) desde = f; // «desde …» es más preciso que «este semestre»
  }
  if (desde) hechos.push({ dimension_id: 'INF', slot: 'desde', valor: desde, evidencia: desde });
  return hechos;
}

const lineas = (texto) => String(texto).split(/\n+/).map((l) => l.replace(/^[\s\-•·*]+/, '').trim()).filter(Boolean);

/**
 * Lectura completa de un informe escolar sin IA: conductas por síntoma (con su frase literal), datos del
 * documento (estudiante, curso, fecha, docente) y datos complementarios: apoyos ya aplicados en el aula,
 * su efectividad y fortalezas mencionadas. Nada se completa por inferencia.
 */
export function leerInformeEscolar(protocolo, texto) {
  const hechos = extraerPorReglas(protocolo, texto);
  const L = lineas(texto);
  const campo = (re) => { for (const l of L) { const m = l.match(re); if (m) return m[1].trim().replace(/\.$/, ''); } return null; };
  const documento = {
    clase: 'observacion_narrativa',
    estudiante: campo(/^(?:estudiante|alumno|alumna|nombre)\s*:\s*(.+)$/i),
    curso: campo(/^curso\s*:\s*(.+)$/i),
    fecha: campo(/^fecha\s*:\s*(.+)$/i),
    establecimiento: campo(/^(?:establecimiento|colegio)\s*:\s*(.+)$/i),
    autor: campo(/^(?:profesor(?:a)?(?:\/a)?\s*jefe|profesor\/a jefe|docente|profesor(?:a)?)\s*:\s*(.+)$/i),
    motivo: campo(/^motivo(?: del reporte| de derivaci[oó]n)?\s*:\s*(.+)$/i),
    instrumento: null,
  };
  const datos = [];
  // Apoyos ya aplicados: líneas bajo un título que hable de estrategias, apoyos o medidas.
  let enApoyos = false;
  for (const l of L) {
    const n = normalizar(l);
    if (/^(\d+\s*)?(estrategias|apoyos|medidas|adecuaciones)\b/.test(n.trim()) && l.length < 90) { enApoyos = true; continue; }
    if (enApoyos && (/^\d+[.)]\s/.test(l) || /^\(?\s*(conclusion|observacion|sugerencia|solicitud)/.test(n.trim()))) {
      if (/efectividad|resultado|funcionado|eficac/.test(n)) datos.push({ dato: 'efectividad_apoyos', valor: l.replace(/^\(|\)$/g, ''), evidencia: l });
      enApoyos = /^(observacion)/.test(n);
      if (!enApoyos) continue;
    }
    if (enApoyos && l.length > 10 && !/efectividad/.test(n)) datos.push({ dato: 'apoyo_previo', valor: l.replace(/\.$/, ''), evidencia: l });
    else if (/efectividad (baja|alta|parcial|transitoria|nula|limitada)|han mostrado una efectividad/.test(n) && !datos.some((d) => d.dato === 'efectividad_apoyos')) datos.push({ dato: 'efectividad_apoyos', valor: l.replace(/^\(|\)$/g, ''), evidencia: l });
  }
  for (const f of frases(texto)) {
    const n = normalizar(f);
    if (/(potencial|capacidades intelectuales|destaca en|fortaleza|habilidad para|le gusta|disfruta|buen(a)? (desempeno|disposicion|relacion))/.test(n)) datos.push({ dato: 'fortaleza_referida', valor: f.replace(/^[•·\-\s]+/, ''), evidencia: f });
  }
  return { hechos, datos, documento };
}

/** Extracción estructurada aportada manualmente por el profesional (JSON). */
export function validarExtraccionManual(protocolo, hechos) {
  if (!Array.isArray(hechos)) throw new Error('Se esperaba un arreglo «hechos».');
  return hechos.map((h, i) => {
    const sid = h.sintoma || h.dimension_id;
    const ev = String(h.evidencia ?? '').trim();
    if (!ev) throw new Error(`hechos[${i}]: falta la evidencia (frase del informe).`);
    if (sid === 'INF') {
      if (!['impacto_academico', 'desde'].includes(h.slot)) throw new Error(`hechos[${i}]: dato general no válido ${h.slot}`);
      return { dimension_id: 'INF', slot: h.slot, valor: String(h.valor), evidencia: ev };
    }
    if (!protocolo.sintomasPorId.has(sid)) throw new Error(`hechos[${i}]: síntoma desconocido ${sid}`);
    const slot = h.slot === 'presencia' ? 'presencia:informe' : h.slot;
    if (!['presencia:informe', 'frecuencia', 'contextos'].includes(slot)) throw new Error(`hechos[${i}]: dato no válido ${h.slot}`);
    if (slot === 'presencia:informe' && !['si', 'no'].includes(h.valor)) throw new Error(`hechos[${i}]: la presencia debe ser si/no`);
    if (slot === 'frecuencia' && !protocolo.alternativas.frecuencia.some((o) => o.valor === h.valor)) throw new Error(`hechos[${i}]: frecuencia no válida`);
    return { dimension_id: sid, slot, valor: String(h.valor), evidencia: ev };
  });
}

// Recepción y extracción estructurada del informe escolar (Etapa 7 §5.2; brief §8).
// Cada dato extraído conserva su fuente (informe_escolar) y la frase literal que lo respalda.
import { normalizar } from './protocolo.js';

const FRECUENCIA = [
  [/\b(siempre|constantemente|todo el tiempo|varias veces (al|por) dia|varias veces por clase|cada clase)\b/, 'varias_al_dia'],
  [/\b(frecuentemente|a menudo|diariamente|todos los dias|casi siempre|habitualmente)\b/, 'casi_todos_los_dias'],
  [/\b(a veces|ocasionalmente|en ocasiones|algunas veces)\b/, 'ocasionalmente'],
];
const IMPACTO_ACADEMICO = ['rendimiento ha bajado', 'ha bajado su rendimiento', 'bajo su rendimiento', 'bajaron sus notas', 'dificultades academicas', 'se esta quedando atras', 'notas bajas', 'bajo rendimiento', 'rendimiento bajo', 'repitio', 'en riesgo de repitencia', 'calificaciones insuficientes', 'promedio bajo'];
const DESDE = /\b(desde (el|la|los|las)? ?(inicio|comienzo|primer|primero|kinder|pre ?kinder|\d+)[^.;]*|el ano pasado|este ano|este semestre)\b/;

function frases(texto) {
  return String(texto).split(/(?<=[.!?;])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

/** Extracción por reglas: solo lo afirmado explícitamente (Etapa 9 §14.1: no completar por inferencia). */
export function extraerPorReglas(protocolo, texto) {
  const hechos = [];
  const vistos = new Set();
  let desde = null;
  for (const f of frases(texto)) {
    const n = ` ${normalizar(f)} `;
    for (const s of protocolo.sintomas) {
      if (vistos.has(s.id)) continue;
      const kw = s.palabras_clave.find((k) => n.includes(` ${k} `));
      if (!kw) continue;
      const i = n.indexOf(` ${kw} `);
      const previo = n.slice(Math.max(0, i - 20), i).trim().split(' ').slice(-2);
      const valor = previo.includes('no') || previo.includes('nunca') ? 'no' : 'si';
      vistos.add(s.id);
      hechos.push({ dimension_id: s.id, slot: 'presencia:informe', valor, evidencia: f });
      if (valor === 'si') {
        const fr = FRECUENCIA.find(([re]) => re.test(n));
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

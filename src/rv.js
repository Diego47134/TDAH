// Realidad virtual (Etapa 8 del proyecto; Etapas 1–7 §25; Etapa 9 §18).
// Contrato de datos para recibir mediciones del casco en tiempo real, y análisis de convergencia
// con las demás fuentes. La RV caracteriza las variables que mide: no crea ni anula criterios DSM.

/** Variables que la RV puede aportar (Etapas 1–7 §25) y su relación con dominios y áreas. */
export const VARIABLES_RV = [
  { id: 'tiempo_reaccion', nombre: 'Tiempo de reacción', dominio: 'inatencion', area: 'atencion', unidad: 'ms' },
  { id: 'variabilidad_tr', nombre: 'Variabilidad del tiempo de reacción', dominio: 'inatencion', area: 'atencion', unidad: 'ms' },
  { id: 'omisiones', nombre: 'Omisiones', dominio: 'inatencion', area: 'atencion', unidad: 'n' },
  { id: 'comisiones', nombre: 'Errores de comisión', dominio: 'hiperactividad_impulsividad', area: 'inhibicion', unidad: 'n' },
  { id: 'anticipatorias', nombre: 'Respuestas anticipatorias', dominio: 'hiperactividad_impulsividad', area: 'inhibicion', unidad: 'n' },
  { id: 'inhibicion', nombre: 'Inhibición', dominio: 'hiperactividad_impulsividad', area: 'inhibicion' },
  { id: 'mantenimiento_objetivos', nombre: 'Mantenimiento de objetivos', dominio: 'inatencion', area: 'atencion' },
  { id: 'distractibilidad', nombre: 'Distractibilidad', dominio: 'inatencion', area: 'atencion', sintoma: 'R1.8' },
  { id: 'persistencia', nombre: 'Persistencia', dominio: 'inatencion', area: 'atencion' },
  { id: 'cambio_condicion', nombre: 'Desempeño frente a cambios de condición', dominio: 'inatencion', area: 'flexibilidad' },
  { id: 'distintas_demandas', nombre: 'Desempeño frente a distintas demandas', dominio: 'inatencion', area: 'atencion' },
  { id: 'actividad_motora', nombre: 'Actividad motora', dominio: 'hiperactividad_impulsividad', area: 'actividad_motora', unidad: 'índice' },
];
const POR_ID = new Map(VARIABLES_RV.map((v) => [v.id, v]));

/**
 * Medición: { valor: número, unidad?, percentil?: 0–100, interpretacion?: 'bajo_lo_esperado' |
 * 'dentro_de_lo_esperado' | 'sobre_lo_esperado' | texto del instrumento }.
 */
export function validarMetricas(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('«metricas» debe ser un objeto { variable: medición }.');
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (!POR_ID.has(k)) throw new Error(`Variable de realidad virtual no reconocida: ${k}. Válidas: ${[...POR_ID.keys()].join(', ')}.`);
    const x = typeof v === 'number' ? { valor: v } : v;
    if (!x || typeof x !== 'object') throw new Error(`Medición no válida para ${k}.`);
    if (x.valor != null && !Number.isFinite(Number(x.valor))) throw new Error(`Valor no numérico en ${k}.`);
    if (x.percentil != null && !(Number(x.percentil) >= 0 && Number(x.percentil) <= 100)) throw new Error(`Percentil fuera de rango en ${k}.`);
    out[k] = { valor: x.valor != null ? Number(x.valor) : null, unidad: x.unidad ? String(x.unidad).slice(0, 20) : (POR_ID.get(k).unidad || null),
      percentil: x.percentil != null ? Number(x.percentil) : null, interpretacion: x.interpretacion ? String(x.interpretacion).slice(0, 120) : null, t: new Date().toISOString() };
  }
  return out;
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Clasifica un resultado como «dificultad», «esperado» o «sin interpretación», según el propio instrumento. */
export function sentidoResultado(v) {
  const t = normalizar(`${v.interpretacion_del_documento || ''} ${v.interpretacion || ''} ${v.resultado || ''}`);
  if (/(dentro de lo esperado|dentro_de_lo_esperado|normal|promedio|adecuad|sin dificultad)/.test(t)) return 'esperado';
  if (/(bajo lo esperado|bajo_lo_esperado|sobre lo esperado|sobre_lo_esperado|por sobre|por debajo|elevad|alterad|deficit|dificultad|clinic|riesgo|lento|inferior)/.test(t)) return 'dificultad';
  if (v.percentil != null) return v.percentil >= 85 || v.percentil <= 15 ? 'dificultad' : 'esperado';
  return 'sin_interpretacion';
}

function variableDe(v) {
  if (v.id && POR_ID.has(v.id)) return POR_ID.get(v.id);
  const n = normalizar(v.variable);
  const reglas = [[/variab/, 'variabilidad_tr'], [/tiempo de reac|reaction/, 'tiempo_reaccion'], [/omisi|atencion sostenida|sustained/, 'omisiones'],
    [/comisi|impulsiv/, 'comisiones'], [/anticip/, 'anticipatorias'], [/inhib/, 'inhibicion'], [/objetivo/, 'mantenimiento_objetivos'],
    [/distrac/, 'distractibilidad'], [/persist/, 'persistencia'], [/cambio/, 'cambio_condicion'], [/demanda|dividida/, 'distintas_demandas'], [/motor|movimiento|actividad/, 'actividad_motora']];
  const r = reglas.find(([re]) => re.test(n));
  return r ? POR_ID.get(r[1]) : null;
}

/**
 * Convergencia o divergencia de la RV con lo informado por el apoderado y el colegio
 * (Etapa 9 §18: se conserva y se explica, sin peso predeterminado).
 */
export function analizarRV(evaluaciones, sintomas) {
  const rv = evaluaciones.filter((e) => ['RV', 'NESPLORA'].includes(e.instrumento_id) && e.estado === 'realizada' && e.resultados);
  const hallazgos = [];
  for (const e of rv) {
    const res = typeof e.resultados === 'string' ? JSON.parse(e.resultados) : e.resultados;
    for (const v of res.variables || []) {
      const def = variableDe(v);
      const sentido = sentidoResultado(v);
      const enDominio = def ? sintomas.filter((s) => s.dominio === def.dominio) : [];
      const positivos = enDominio.filter((s) => ['APOYADO POR EVIDENCIA', 'PROBABLE'].includes(s.estado));
      const especifico = def?.sintoma ? sintomas.find((s) => s.id === def.sintoma) : null;
      let relacion;
      if (!def) relacion = 'sin_correspondencia';
      else if (sentido === 'sin_interpretacion') relacion = 'sin_interpretacion';
      else if (sentido === 'dificultad' && positivos.length) relacion = 'convergente';
      else if (sentido === 'esperado' && !positivos.length) relacion = 'convergente';
      else relacion = 'divergente';
      const dom = def?.dominio === 'inatencion' ? 'inatención' : 'hiperactividad/impulsividad';
      const explicacion = !def ? 'La variable no tiene correspondencia definida con un dominio; se informa como dato complementario.'
        : sentido === 'sin_interpretacion' ? 'El instrumento no informa interpretación normativa; se registra sin contrastar.'
          : relacion === 'convergente'
            ? (sentido === 'dificultad' ? `Desempeño con dificultad que converge con ${positivos.length} síntoma(s) de ${dom} respaldados por entrevista/colegio.` : `Desempeño esperado, coherente con la ausencia de síntomas respaldados de ${dom}.`)
            : (sentido === 'dificultad' ? `Desempeño con dificultad sin síntomas de ${dom} respaldados por otras fuentes: revisar condiciones de evaluación y contexto.` : `Desempeño esperado pese a ${positivos.length} síntoma(s) de ${dom} respaldados por otras fuentes: puede reflejar que la tarea no captura las demandas del contexto cotidiano.`);
      hallazgos.push({ instrumento: e.instrumento_id, variable: v.variable, resultado: v.resultado, sentido, relacion, dominio: def?.dominio || null, area: def?.area || null,
        sintoma_relacionado: especifico ? { id: especifico.id, estado: especifico.estado } : null, explicacion });
    }
  }
  const limitaciones = rv.flatMap((e) => (typeof e.resultados === 'string' ? JSON.parse(e.resultados) : e.resultados).limitaciones || []);
  return { disponible: rv.length > 0, hallazgos, limitaciones,
    regla: 'La realidad virtual caracteriza las variables que mide; no crea ni anula criterios diagnósticos ni tiene peso numérico predeterminado (Etapa 9 §18).' };
}

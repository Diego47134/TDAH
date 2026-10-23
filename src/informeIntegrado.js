// Módulo de generación del informe clínico-neuropsicológico y de orientación educativa.
//
// Comunica los resultados que ya calculó el motor (Etapa 9) integrando las tres fuentes
// (entrevista al apoderado, informe escolar y realidad virtual / Nesplora) y los demás instrumentos.
// No recalcula criterios, no cambia estados ni recuentos y no diagnostica: cada afirmación sale del
// expediente con su fuente, las discrepancias se conservan y lo que falta se declara.
// Estructura: especificación «Módulo de generación del informe» (secciones 3.1–3.16, 4 y 6).
import { estadoPregunta, estadoSlot } from './motor.js';
import { VARIABLES_RV } from './rv.js';

const FUENTE = { apoderado: 'Apoderado (entrevista)', informe_escolar: 'Colegio (informe escrito)', profesor: 'Colegio (respuestas a preguntas pendientes)', nino: 'Niño/a (entrevista propia)', adolescente: 'Adolescente (entrevista propia)', instrumento: 'Instrumento', profesional: 'Profesional' };
const FUENTE_CORTA = { apoderado: 'Apoderado', informe_escolar: 'Colegio', profesor: 'Colegio', nino: 'Niño/a', adolescente: 'Adolescente', instrumento: 'Instrumento', profesional: 'Profesional' };
const V = { si: 'Sí', no: 'No', ocasionalmente: 'Ocasionalmente', no_sabe: 'No sabe', no_recuerda: 'No recuerda', ambiguo: 'Información parcial', parcial: 'parcial', sin_dato: '—' };
const POSITIVOS = ['APOYADO POR EVIDENCIA', 'PROBABLE', 'POSIBLE'];
const ESTADO_LEGIBLE = {
  'APOYADO POR EVIDENCIA': 'Apoyado por evidencia', PROBABLE: 'Probable', POSIBLE: 'Posible', CONTRADICTORIO: 'Contradictorio / discrepante',
  'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN': 'Evidencia relacionada; requiere caracterización', 'INFORMACIÓN INSUFICIENTE': 'Información insuficiente',
  'NO REFERIDO': 'No referido', 'NO INFORMADO': 'No informado', DESCONOCIDO: 'Desconocido / no recuerda',
};

const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();
const tabla = (cab, filas) => [`| ${cab.join(' | ')} |`, `| ${cab.map(() => '---').join(' | ')} |`, ...filas.map((f) => `| ${f.map((x) => esc(x) || '—').join(' | ')} |`), ''];
const corta = (s, n = 160) => { const t = esc(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const lista = (xs, vacio) => (xs.length ? xs.map((x) => `- ${x}`) : [`- ${vacio}`]);
const unir = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
const cap = (t) => String(t).replace(/^(\s*)(\p{Ll})/u, (m, a, b) => a + b.toUpperCase());
const fecha = (iso) => (iso ? String(iso).slice(0, 10) : null);
/** Reemplaza códigos internos («varias_al_dia») por el texto de la alternativa del protocolo. */
function legible(p, texto) {
  const todas = Object.values(p.alternativas || {}).flat();
  return String(texto ?? '').replace(/«([a-z0-9_]+)»/g, (m, v) => { const o = todas.find((x) => x.valor === v); return o ? `«${o.texto}»` : m; })
    .replace(/fuente: (apoderado|informe_escolar|profesor|nino|adolescente)/g, (m, f) => `fuente: ${FUENTE_CORTA[f].toLowerCase()}`);
}

function respuesta(ctx, qid) {
  const q = ctx.protocolo.preguntas.get(qid);
  if (!q) return 'sin_dato';
  const st = estadoPregunta(ctx, q);
  return st.estado === 'valor' ? st.valor : st.estado;
}

// ------------------------------------------------------------------ fuentes ---

function datosDeFuentes(ctx) {
  const hechos = ctx.hechos;
  const de = (f) => hechos.filter((h) => h.fuente === f);
  const apoderado = de('apoderado');
  const fechasAp = apoderado.map((h) => h.creado).sort();
  const escolar = ctx.informesEscolares || [];
  const docEsc = escolar.map((i) => i.documento).find(Boolean) || null;
  const datosEsc = hechos.filter((h) => h.fuente === 'informe_escolar' && h.dimension_id === 'INF');
  const conIndices = (e) => Array.isArray(e.resultados?.variables);
  const rv = ctx.evaluaciones.filter((e) => ['RV', 'NESPLORA'].includes(e.instrumento_id) && conIndices(e) && ['realizada', 'pendiente_vinculacion'].includes(e.estado));
  const otros = ctx.evaluaciones.filter((e) => e.estado === 'realizada' && !(['RV', 'NESPLORA'].includes(e.instrumento_id) && conIndices(e)));
  const nna = hechos.filter((h) => ['nino', 'adolescente'].includes(h.fuente));
  const col = de('profesor');
  return {
    apoderado, desdeAp: fecha(fechasAp[0]), hastaAp: fecha(fechasAp.at(-1)),
    escolar, docEsc, datosEsc,
    apoyosPrevios: datosEsc.filter((h) => h.slot === 'apoyo_previo').map((h) => h.valor),
    efectividad: datosEsc.find((h) => h.slot === 'efectividad_apoyos')?.valor || null,
    fortalezasColegio: datosEsc.filter((h) => h.slot === 'fortaleza_referida').map((h) => h.valor),
    rv, rvIntegrados: rv.filter((e) => e.estado === 'realizada'), rvPendientes: rv.filter((e) => e.estado === 'pendiente_vinculacion'),
    otros, nna, col,
  };
}

function nombreInstrumento(ctx, e) {
  return e.resultados?.documento?.instrumento || ctx.protocolo.instrumentos.find((i) => i.id === e.instrumento_id)?.nombre || e.instrumento_id;
}

function tablaFuentes(ctx, F) {
  const filas = [];
  if (F.apoderado.length) {
    filas.push([FUENTE.apoderado, F.desdeAp === F.hastaAp ? F.desdeAp : `${F.desdeAp} a ${F.hastaAp}`,
      `${F.apoderado.filter((h) => h.estado === 'valor').length} datos: trayectoria, conductas en casa y otros contextos, autonomía, impacto y antecedentes`,
      'Síntomas DSM-5-TR, desarrollo, contextos, impacto funcional, diagnóstico diferencial',
      'Información de un informante; lo no observado o no recordado no se considera ausente']);
  }
  for (const i of F.escolar) {
    const d = i.documento || {};
    const n = ctx.hechos.filter((h) => h.fuente === 'informe_escolar' && h.dimension_id !== 'INF').length;
    filas.push([FUENTE.informe_escolar + (d.establecimiento ? ` — ${d.establecimiento}` : ''), d.fecha || fecha(i.creado),
      `${n} datos sobre conductas en el aula${F.apoyosPrevios.length ? `; ${F.apoyosPrevios.length} apoyos ya aplicados` : ''}${d.autor ? `; informante: ${d.autor}` : ''}`,
      'Conducta y desempeño en el contexto escolar, apoyos requeridos, repercusión escolar',
      `${d.clase === 'escala_estandarizada' ? 'Escala estandarizada' : 'Observación narrativa, no estandarizada'}; la falta de mención no demuestra ausencia${d.estudiante ? `; identifica al estudiante como «${d.estudiante}»` : ''}`]);
  }
  if (F.col.length) filas.push([FUENTE.profesor, fecha(F.col[0].creado), `${F.col.length} respuestas a preguntas que el informe no resolvía`, 'Contexto escolar', 'Respuestas breves a preguntas específicas']);
  if (F.nna.length) filas.push([FUENTE[F.nna[0].fuente], fecha(F.nna[0].creado), `${F.nna.length} respuestas`, 'Percepción propia', 'Autoinforme; depende de la edad y la comprensión']);
  for (const e of F.rv) {
    const r = e.resultados;
    const vars = (r.variables || []).map((v) => v.variable).length;
    filas.push([nombreInstrumento(ctx, e), e.fecha || '—', `${vars} índices objetivos del desempeño en la tarea${r.baremo ? ` (baremo ${r.baremo})` : ''}`,
      'Atención, control inhibitorio, vigilancia, velocidad de procesamiento y actividad motora durante la tarea',
      `${e.estado === 'pendiente_vinculacion' ? '**No integrado: falta confirmar que corresponde al caso.** ' : ''}Evidencia complementaria dependiente de la tarea; no confirma ni descarta TDAH por sí sola`]);
  }
  for (const e of F.otros) filas.push([nombreInstrumento(ctx, e), e.fecha || '—', e.observaciones || 'Resultados registrados', '—', 'Interpretar según su manual']);
  return filas;
}

// ------------------------------------------------------------------ síntomas ---

function conductasDeSintoma(ctx, s) {
  const p = ctx.protocolo;
  const out = [];
  for (const h of ctx.hechos.filter((x) => x.dimension_id === s.id && x.slot.startsWith('presencia') && x.estado === 'valor')) {
    if (h.fuente === 'apoderado') {
      const q = h.pregunta_id && p.preguntas.get(h.pregunta_id);
      out.push(`Apoderado: ${q ? `«${corta(q.texto, 90)}» → ${V[h.valor] || h.valor}` : V[h.valor] || h.valor}${h.evidencia && h.evidencia.length > 3 ? ` («${corta(h.evidencia, 100)}»)` : ''}`);
    } else if (h.evidencia) out.push(`${FUENTE_CORTA[h.fuente] || h.fuente}: «${corta(h.evidencia.replace(/^[•·\-\s]+/, ''), 140)}»`);
    else out.push(`${FUENTE_CORTA[h.fuente] || h.fuente}: ${V[h.valor] || h.valor}`);
  }
  return out;
}

function faltanteDeSintoma(s) {
  const f = [];
  if (s.contradictorio) f.push(`Las fuentes no coinciden (${Object.entries(s.porFuente).map(([k, v]) => `${FUENTE_CORTA[k]}: ${V[v] || v}`).join('; ')})`);
  for (const x of s.faltantes || []) f.push({ frecuencia: 'frecuencia', desde: 'desde cuándo ocurre', contextos: 'en qué contextos ocurre' }[x] || x);
  if (s.estado === 'NO INFORMADO') f.push('Ninguna fuente aporta información');
  if (s.estado === 'DESCONOCIDO') f.push('El informante no sabe o no recuerda (no equivale a ausencia)');
  return f;
}

// ------------------------------------------------------------- realidad virtual ---

const VAR_POR_ID = new Map(VARIABLES_RV.map((v) => [v.id, v]));
const SINTOMAS_RELACIONADOS = {
  omisiones: ['R1.1', 'R1.2', 'R1.8'], variabilidad_tr: ['R1.2'], tiempo_reaccion: [], comisiones: ['R2.7', 'R2.8', 'R2.9'], actividad_motora: ['R2.1', 'R2.2', 'R2.5'],
};

function correspondenciaRV(I, v) {
  const rel = (SINTOMAS_RELACIONADOS[v.id] || []).map((id) => I.sintomas.find((s) => s.id === id)).filter(Boolean);
  const positivos = rel.filter((s) => POSITIVOS.includes(s.estado));
  const enDiscrepancia = rel.filter((s) => s.contradictorio);
  const quienes = (s) => unir([...new Set(Object.keys(s.porFuente).filter((k) => s.porFuente[k] === 'si').map((k) => FUENTE_CORTA[k]))]);
  if (v.sentido === 'dificultad') {
    if (positivos.length) return `Converge con conductas documentadas: ${positivos.map((s) => `${s.nombre.toLowerCase()} (${quienes(s)})`).join('; ')}.`;
    if (enDiscrepancia.length) return `Coincide con lo que describe una de las fuentes (${enDiscrepancia.map((s) => `${s.nombre.toLowerCase()}: ${quienes(s)}`).join('; ')}), mientras otra no lo observa: la discrepancia se conserva.`;
    return rel.length ? 'Sin correlato cotidiano documentado en las conductas relacionadas: se describe como evidencia complementaria, no como síntoma.' : 'Sin correspondencia directa con un síntoma DSM-5-TR específico.';
  }
  if (v.sentido === 'esperado' || v.sentido === 'fortaleza') {
    return positivos.length
      ? `Discrepa de lo documentado en la vida diaria (${positivos.map((s) => s.nombre.toLowerCase()).join('; ')}): la tarea estructurada puede no captar las demandas del contexto cotidiano; ambos datos se conservan.`
      : 'Coherente con la información de las demás fuentes.';
  }
  return 'Sin interpretación del instrumento: se registra sin contrastar.';
}

function comparacionCondiciones(cond) {
  const L = [];
  const nombres = { omisiones: 'omisiones', comisiones: 'comisiones', tiempo_reaccion: 'tiempo de reacción', variabilidad_tr: 'variabilidad del tiempo de reacción', actividad_motora: 'actividad motora' };
  const comparar = (a, b, etA, etB) => {
    if (!a || !b) return;
    for (const k of Object.keys(nombres)) {
      if (!a[k] || !b[k] || a[k].t == null || b[k].t == null) continue;
      const d = a[k].t - b[k].t;
      if (Math.abs(d) >= 10) L.push(`${nombres[k][0].toUpperCase()}${nombres[k].slice(1)}: rendimiento ${d > 0 ? 'menor' : 'mejor'} ${etA} (T ${a[k].t}) que ${etB} (T ${b[k].t}).`);
    }
  };
  if (cond?.distractores) comparar(cond.distractores.con, cond.distractores.sin, 'con distractores', 'sin distractores');
  if (cond?.tareas) comparar(cond.tareas.vigilancia, cond.tareas.inhibicion, 'en la tarea monótona (vigilancia)', 'en la tarea de inhibición');
  if (cond?.canales) comparar(cond.canales.auditivo, cond.canales.visual, 'con estímulos auditivos', 'con estímulos visuales');
  return L;
}

// ------------------------------------------------------- fortalezas y apoyos ---

const USO_RECURSO = {
  A32: 'Planificar supervisión cercana y retroalimentación inmediata en las tareas más exigentes.',
  A33: 'Presentar las tareas con pasos explícitos, rutinas estables y apoyos visuales.',
  A34: 'Usar sus intereses como puerta de entrada a las tareas y como refuerzo.',
  A42: 'Revisar con la familia qué condiciones había en esas etapas para intentar reproducirlas.',
};

function fortalezas(ctx, I, F) {
  const L = [];
  for (const r of I.recursos) L.push({ capacidad: r.texto, condiciones: 'Según lo informado por el apoderado', fuente: FUENTE.apoderado, uso: USO_RECURSO[r.pregunta] || '—' });
  // Un área «preservada» según el apoderado no se presenta como tal si otra fuente describe dificultades en ella.
  for (const a of I.areas.filter((x) => x.estado === 'RELATIVAMENTE PRESERVADA' && !I.sintomas.some((s) => s.area === x.id && Object.values(s.porFuente).includes('si')))) {
    L.push({ preservada: true, capacidad: `${a.nombre}: relativamente preservada (no se refieren dificultades en lo explorado; no es una fortaleza medida)`, condiciones: 'Preguntas exploradas en la entrevista', fuente: 'Apoderado', uso: 'Puede usarse como apoyo al planificar las tareas, sin asumir un rendimiento superior.' });
  }
  for (const e of F.rvIntegrados) {
    for (const v of (e.resultados.variables || []).filter((x) => x.sentido === 'fortaleza')) {
      L.push({ capacidad: `${v.variable}: rendimiento ${v.rendimiento} (${v.resultado})`, condiciones: `Tarea de ${nombreInstrumento(ctx, e)}, ${e.fecha || ''}`.trim(), fuente: nombreInstrumento(ctx, e), uso: v.id === 'tiempo_reaccion' ? 'Respuesta rápida: favorecer actividades breves, dinámicas y con respuesta inmediata.' : 'Considerar en la planificación de apoyos.' });
    }
  }
  if (F.fortalezasColegio.length) L.push({ capacidad: `Potencial no reflejado en el rendimiento, según el colegio: ${F.fortalezasColegio.map((t) => `«${corta(t, 120)}»`).join(' ')}`, condiciones: 'Observación del docente; no evaluado formalmente', fuente: FUENTE.informe_escolar, uso: 'Apoyar la expectativa de logro y ajustar la evaluación para que refleje lo que sabe.' });
  return L;
}

/** Recomendaciones vinculadas a hallazgos documentados (no se recomiendan todas las estrategias posibles). */
function recomendaciones(ctx, I, F) {
  const R = [];
  const sin = (id) => I.sintomas.find((s) => s.id === id);
  const pos = (ids) => ids.map(sin).filter((s) => s && POSITIVOS.includes(s.estado));
  const fuentesDe = (ss) => unir([...new Set(ss.flatMap((s) => Object.keys(s.porFuente).filter((k) => ['si', 'ocasionalmente'].includes(s.porFuente[k])).map((k) => FUENTE_CORTA[k])))]);
  const rvVar = (id) => F.rvIntegrados.flatMap((e) => (e.resultados.variables || []).map((v) => ({ ...v, instrumento: nombreInstrumento(ctx, e) }))).find((v) => v.id === id && v.sentido === 'dificultad');
  const apoyoPrevio = (re) => F.apoyosPrevios.find((a) => re.test(a.toLowerCase()));
  const efectBaja = F.efectividad && /baja|transitoria|nula|limitada|poca/i.test(F.efectividad);
  const mod = (q) => I.moduladores.find((m) => m.pregunta === q && m.valor === 'si');
  const rec = (grupo, hallazgo, accion, responsable, objetivo, indicador) => R.push({ grupo, hallazgo, accion, responsable, objetivo, indicador });

  // Atención y distractibilidad
  const aten = pos(['R1.2', 'R1.8']); const om = rvVar('omisiones'); const vig = rvVar('variabilidad_tr');
  if (aten.length || om || vig) {
    const ub = apoyoPrevio(/ubicaci/);
    rec('A', [aten.length && `${aten.map((s) => s.nombre.toLowerCase()).join('; ')} (${fuentesDe(aten)})`, om && `${om.variable}: ${om.rendimiento} (${om.instrumento})`, vig && `${vig.variable}: ${vig.rendimiento} (${vig.instrumento})`, mod('A31') && 'empeora con distractores (apoderado)'].filter(Boolean).join('; '),
      ub && efectBaja ? `Revisar la ubicación preferencial que ya se aplica (el colegio informa efectividad baja o transitoria): complementarla con un puesto alejado de puerta y ventanas, menos material a la vista y bloques de trabajo cortos.`
        : 'Ubicar en un puesto con pocos estímulos visuales y auditivos (lejos de puerta y ventanas), con el material mínimo a la vista y bloques de trabajo cortos con verificación de avance.',
      'Profesor/a jefe y de asignatura', 'Mantener la atención en la tarea durante el trabajo individual', 'Número de veces que hay que reconducirlo a la tarea por bloque de clase');
  }
  // Completar tareas / errores por descuido
  const tareas = pos(['R1.4', 'R1.6']);
  if (tareas.length) {
    rec('A', `${tareas.map((s) => s.nombre.toLowerCase()).join('; ')} (${fuentesDe(tareas)})${mod('A30') ? '; aumenta con tareas de varios pasos (apoderado)' : ''}`,
      apoyoPrevio(/simplific|pasos/) && efectBaja ? 'Mantener las instrucciones en pasos cortos (ya aplicado) y agregar una lista de pasos escrita en el puesto, con marca al terminar cada uno y tiempo adicional cuando corresponda.'
        : 'Entregar instrucciones en pasos cortos, por escrito, con una lista para marcar cada paso terminado y tiempo adicional cuando corresponda.',
      'Profesor/a de asignatura', 'Terminar las tareas dentro del tiempo de clase', 'Proporción de tareas terminadas en clase por semana');
  }
  const descuido = pos(['R1.1']);
  if (descuido.length) {
    rec('B', `${descuido[0].nombre.toLowerCase()} (${fuentesDe(descuido)})`, 'Enseñar y practicar una rutina breve de revisión antes de entregar (leer la instrucción completa, subrayar lo que se pide, revisar que no queden preguntas en blanco).',
      'Psicopedagogo/a con el profesor/a', 'Reducir errores por omisión en evaluaciones', 'Número de preguntas sin responder u omitidas por evaluación');
  }
  // Organización y materiales
  const org = pos(['R1.5', 'R1.7', 'R1.9']);
  if (org.length) {
    rec('B', `${org.map((s) => s.nombre.toLowerCase()).join('; ')} (${fuentesDe(org)})`, 'Trabajar habilidades de organización: agenda o lista visual de materiales y tareas, revisión al final de la jornada y orden del puesto con apoyo.',
      'Psicopedagogo/a y profesor/a jefe', 'Llegar y salir con los materiales y tareas registradas', 'Días por semana con materiales completos y tareas anotadas');
    rec('C', `${org.map((s) => s.nombre.toLowerCase()).join('; ')} (${fuentesDe(org)})`, 'Revisar cada tarde la agenda o lista de materiales con un adulto y preparar la mochila la noche anterior, con refuerzo cuando lo logre.',
      'Familia', 'Autonomía progresiva en la organización de sus cosas', 'Días por semana en que prepara la mochila con mínima ayuda');
  }
  // Control de impulsos
  const imp = pos(['R2.7', 'R2.8', 'R2.9']); const com = rvVar('comisiones');
  if (imp.length || com) {
    rec('A', [imp.length && `${imp.map((s) => s.nombre.toLowerCase()).join('; ')} (${fuentesDe(imp)})`, com && `${com.variable}: ${com.rendimiento} (${com.instrumento})`].filter(Boolean).join('; '),
      'Acordar con él una señal para pedir la palabra y esperar, recordarla antes de las actividades grupales y reconocer de inmediato cuando la usa.',
      'Profesor/a jefe', 'Esperar su turno y no interrumpir en actividades grupales', 'Interrupciones por bloque de clase');
  }
  // Actividad motora
  const mot = pos(['R2.1', 'R2.2', 'R2.5']); const am = rvVar('actividad_motora');
  if (mot.length || am) {
    rec('A', [mot.length && `${mot.map((s) => s.nombre.toLowerCase()).join('; ')} (${fuentesDe(mot)})`, am && `${am.variable}: ${am.rendimiento} (${am.instrumento})`].filter(Boolean).join('; '),
      'Programar pausas activas breves y encargos que permitan moverse con permiso (repartir material, borrar la pizarra), en vez de exigir quietud prolongada.',
      'Profesor/a de asignatura', 'Reducir las salidas del puesto sin autorización', 'Salidas del puesto sin autorización por bloque de clase');
  }
  // Rendimiento académico
  const impactoEsc = ctx.hechos.some((h) => h.fuente === 'informe_escolar' && h.slot === 'impacto_academico') || respuesta(ctx, 'A46') === 'si';
  if (impactoEsc) {
    rec('B', `Repercusión en el rendimiento escolar (${unir([ctx.hechos.some((h) => h.fuente === 'informe_escolar' && h.slot === 'impacto_academico') && 'Colegio', respuesta(ctx, 'A46') === 'si' && 'Apoderado'].filter(Boolean))})`,
      'Ajustar las evaluaciones (instrucciones leídas en voz alta, menos preguntas por página, tiempo adicional) y evaluar si se requiere apoyo psicopedagógico en lectura, escritura o matemática.',
      'Equipo de aula / psicopedagogo/a', 'Que las calificaciones reflejen lo que sabe', 'Calificaciones y omisiones en evaluaciones ajustadas frente a las anteriores');
  }
  // Hogar: autorregulación
  if (imp.length || mot.length || respuesta(ctx, 'A47') === 'si') {
    rec('C', [imp.length && 'dificultades de control de impulsos', mot.length && 'inquietud motora', respuesta(ctx, 'A47') === 'si' && 'afecta la convivencia familiar (apoderado)'].filter(Boolean).join('; '),
      'Rutinas estables, instrucciones breves de un paso, anticipar cambios y reforzar positivamente las conductas esperadas. Si el patrón persiste en casa, considerar un programa de entrenamiento para padres respaldado por la evidencia.',
      'Familia (con orientación profesional)', 'Mejorar la convivencia y la autorregulación en casa', 'Conflictos por día en las rutinas acordadas (tareas, hora de dormir)');
  }
  // Evaluación y seguimiento profesional
  for (const a of I.tamizaje.alertas) rec('D', `Tamizaje médico, sensorial o del sueño: ${a.motivo}`, 'Derivar a valoración sanitaria antes de atribuir las dificultades a TDAH.', 'Profesional responsable', 'Descartar o tratar condiciones que expliquen o agraven las dificultades', 'Valoración realizada y su resultado incorporado al expediente');
  for (const e of F.rvPendientes) rec('D', `${nombreInstrumento(ctx, e)}: ${(e.resultados.vinculacion?.problemas || []).join(' ')}`, 'Confirmar que el informe corresponde al caso o solicitar uno del niño evaluado; hasta entonces no se integra.', 'Profesional responsable', 'Integrar solo evidencia atribuible al caso', 'Vinculación confirmada o informe reemplazado');
  for (const e of F.rvIntegrados) {
    const adv = (e.resultados.vinculacion?.advertencias || []).find((a) => /se realizó hace/.test(a));
    if (adv) rec('D', `${nombreInstrumento(ctx, e)}: ${adv}`, 'Considerar una nueva aplicación del instrumento para conocer el funcionamiento actual.', 'Profesional responsable', 'Contar con evidencia objetiva vigente', 'Nueva aplicación realizada');
  }
  const contr = I.sintomas.filter((s) => s.estado === 'CONTRADICTORIO');
  if (contr.length) rec('D', `Discrepancias entre fuentes en ${contr.map((s) => s.nombre.toLowerCase()).join('; ')}`, 'Precisar con cada fuente en qué situaciones, con qué demandas y apoyos ocurre la conducta, sin resolver la diferencia a favor de una fuente.', 'Profesional responsable', 'Comprender la diferencia entre contextos', 'Discrepancias revisadas y explicadas en el expediente');
  return R;
}

// ----------------------------------------------------------------- informe ---

/**
 * Genera las secciones del informe integrado (markdown).
 * @returns {{ lineas: string[], calidad: {control, ok, detalle}[] }}
 */
export function informeIntegrado(ctx, I, { validacion = null, tipo = 'borrador', redaccion = null } = {}) {
  const p = ctx.protocolo; const c = ctx.caso;
  const F = datosDeFuentes(ctx);
  const L = [];
  const positivos = I.sintomas.filter((s) => POSITIVOS.includes(s.estado));
  const motivo = estadoSlot(ctx, 'INI', 'motivo');
  const impacto = [['A46', 'rendimiento escolar'], ['A47', 'convivencia familiar'], ['A48', 'relaciones con otros niños'], ['A49', 'actividades cotidianas'], ['A51', 'frustración o conflictos']]
    .filter(([q]) => respuesta(ctx, q) === 'si').map(([, t]) => t);
  const impactoEsc = ctx.hechos.filter((h) => h.fuente === 'informe_escolar' && h.slot === 'impacto_academico');
  const fort = fortalezas(ctx, I, F);
  const recs = recomendaciones(ctx, I, F);

  // 3.1
  L.push('## 1. Identificación y motivo de consulta', '');
  L.push(`- **Expediente:** ${c.codigo}${c.etiqueta && c.etiqueta !== c.codigo ? ` (${c.etiqueta})` : ''}`);
  L.push(`- **Edad al momento de la evaluación:** ${I.edad != null ? `${I.edad} años` : 'no registrada'}${I.etapa ? ` · etapa evolutiva: ${I.etapa}` : ''}`);
  L.push(`- **Motivo de consulta (palabras del apoderado):** ${motivo.estado === 'valor' ? `«${esc(motivo.valor)}»` : 'no registrado'}`);
  if (F.docEsc?.motivo) L.push(`- **Motivo de derivación del colegio:** «${esc(F.docEsc.motivo)}»`);
  L.push('- **Finalidad:** comprender el funcionamiento del niño, niña o adolescente, contrastar la información con los criterios DSM-5-TR y orientar los apoyos educativos y clínicos.', '');

  // 3.2
  L.push('## 2. Fuentes de información', '');
  L.push(...tabla(['Fuente', 'Fecha', 'Información aportada', 'Áreas que permite evaluar', 'Limitaciones'], tablaFuentes(ctx, F)));
  for (const e of F.rvPendientes) {
    L.push(`> **Atención — ${nombreInstrumento(ctx, e)} no integrado.** ${(e.resultados.vinculacion?.problemas || []).join(' ')} Sus resultados no se atribuyen al caso hasta que el profesional confirme la vinculación.`, '');
  }

  const MARCA_IA = redaccion ? `_Redacción asistida por IA (${redaccion.proveedor || 'proveedor externo'}${redaccion.modelo ? `, ${redaccion.modelo}` : ''}) a partir de los datos de este informe, verificada automáticamente; el profesional debe revisarla antes de validar._` : null;
  const parrafos = (t) => String(t).split(/\n{2,}|\n/).map((x) => x.trim()).filter(Boolean).flatMap((x) => [x, '']);

  // 3.3
  L.push('## 3. Síntesis ejecutiva', '');
  const L33 = L.length;
  const porDom = (d) => positivos.filter((s) => s.dominio === d);
  const difTxt = [porDom('inatencion').length && `en atención (${porDom('inatencion').map((s) => s.nombre.toLowerCase()).join('; ')})`, porDom('hiperactividad_impulsividad').length && `en actividad e impulsividad (${porDom('hiperactividad_impulsividad').map((s) => s.nombre.toLowerCase()).join('; ')})`].filter(Boolean);
  L.push(`**Dificultades documentadas.** ${difTxt.length ? `Se documentan dificultades ${unir(difTxt)}.` : 'No hay conductas DSM-5-TR con evidencia positiva en el expediente.'}${F.rvIntegrados.length ? ` En ${unir(F.rvIntegrados.map((e) => nombreInstrumento(ctx, e)))} se registran ${F.rvIntegrados.flatMap((e) => e.resultados.variables || []).filter((v) => v.sentido === 'dificultad').length} índice(s) con rendimiento bajo lo esperado para su edad.` : ''}`, '');
  const ctxs = [...new Set(positivos.flatMap((s) => s.contextos))];
  const modSi = I.moduladores.filter((m) => m.valor === 'si').map((m) => m.texto.toLowerCase());
  L.push(`**Situaciones en que aparecen.** ${ctxs.length ? `Contextos: ${unir(ctxs)}.` : 'Contextos no precisados.'}${modSi.length ? ` Según el apoderado, las dificultades ${unir(modSi.map((t) => t.replace(/^aumentan /, 'aumentan ').replace(/^funciona/, 'el niño funciona')))}.` : ''}`, '');
  const fortReales = fort.filter((f) => !f.preservada); const preserv = fort.filter((f) => f.preservada);
  L.push(`**Fortalezas.** ${fortReales.length ? `${cap(unir(fortReales.slice(0, 4).map((f) => f.capacidad.split(':')[0].replace(/\.$/, '').toLowerCase())))}.` : 'La información disponible no permite identificar fortalezas específicas.'}${preserv.length ? ` Áreas relativamente preservadas: ${unir(preserv.map((f) => f.capacidad.split(':')[0].toLowerCase()))}.` : ''}`, '');
  L.push(`**Impacto funcional.** ${impacto.length || impactoEsc.length ? cap(unir([impacto.length && `según el apoderado afecta ${unir(impacto)}`, impactoEsc.length && 'el colegio describe repercusión en el rendimiento'].filter(Boolean))) + '.' : 'No se describe impacto funcional con la información disponible.'}`, '');
  L.push(`**Apoyos que parecen útiles.** ${recs.filter((r) => r.grupo !== 'D').length ? cap(unir([...new Set(recs.filter((r) => r.grupo !== 'D').map((r) => r.objetivo.toLowerCase()))].slice(0, 4))) + ' (detalle en la sección 12).' : 'Por definir con más información.'}${F.apoyosPrevios.length ? ` El colegio ya aplicó ${F.apoyosPrevios.length} medidas${F.efectividad ? ` (${esc(F.efectividad).replace(/^\(?\s*observaci[oó]n:\s*/i, '').replace(/[).\s]+$/, '').toLowerCase()})` : ''}.` : ''}`, '');
  L.push(`**Cuestiones pendientes.** ${I.informacionFaltante.length || F.rvPendientes.length ? `${I.informacionFaltante.filter((x) => x.relevancia === 'CRÍTICA').length} aspectos críticos y ${I.informacionFaltante.filter((x) => x.relevancia !== 'CRÍTICA').length} relevantes sin resolver${F.rvPendientes.length ? '; un informe de realidad virtual sin vincular al caso' : ''} (sección 14).` : 'Sin cuestiones pendientes relevantes.'} La conclusión diagnóstica queda sujeta a la validación del profesional.`, '');
  if (redaccion?.sintesis_ejecutiva) L.splice(L33, L.length - L33, ...parrafos(redaccion.sintesis_ejecutiva), MARCA_IA, '');

  // 3.4
  L.push('## 4. Integración de las fuentes', '');
  if (redaccion?.integracion) L.push(...parrafos(redaccion.integracion), MARCA_IA, '', '**Detalle por fuente:**', '');
  const fuentesSi = (s) => Object.keys(s.porFuente).filter((k) => s.porFuente[k] === 'si');
  const conv = I.sintomas.filter((s) => !s.contradictorio && new Set(fuentesSi(s).map((k) => FUENTE_CORTA[k])).size >= 2);
  const compl = I.sintomas.filter((s) => !s.contradictorio && new Set(fuentesSi(s).map((k) => FUENTE_CORTA[k])).size === 1 && F.escolar.length);
  L.push('**Hallazgos convergentes** (la misma conducta descrita por fuentes distintas):', '');
  L.push(...lista(conv.map((s) => `${s.nombre}: ${unir([...new Set(fuentesSi(s).map((k) => FUENTE_CORTA[k]))])}.`), 'No hay conductas descritas por más de una fuente.'), '');
  if (compl.length) {
    L.push('**Hallazgos complementarios** (descritos por una sola fuente; la otra no informa sobre ellos, lo que no equivale a ausencia):', '');
    L.push(...compl.map((s) => `- ${s.nombre}: solo ${FUENTE_CORTA[fuentesSi(s)[0]]}.`), '');
  }
  L.push('**Discrepancias** (se conservan; no se resuelven a favor de una fuente):', '');
  const disc = [
    ...I.sintomas.filter((s) => s.contradictorio).map((s) => `${s.nombre}: ${Object.entries(s.porFuente).map(([k, v]) => `${FUENTE_CORTA[k]} «${V[v] || v}»`).join(' / ')}. Falta precisar en qué situaciones y con qué apoyos ocurre en cada contexto.`),
    ...ctx.contradicciones.filter((x) => !/presencia/.test(x.slot)).map((x) => `${p.sintomasPorId.get(x.dimension_id)?.nombre || x.dimension_id}: ${legible(p, x.descripcion)}${x.estado === 'revisada' ? ` Revisada por ${x.revisado_por}: ${x.nota_revision}` : ' Pendiente de revisión.'}`),
  ];
  L.push(...lista(disc, 'No se registran discrepancias entre fuentes.'), '');
  if (F.rvIntegrados.length) {
    L.push('**Realidad virtual frente a la conducta cotidiana:**', '');
    for (const e of F.rvIntegrados) for (const v of (e.resultados.variables || []).filter((x) => x.sentido !== 'esperado' || (SINTOMAS_RELACIONADOS[x.id] || []).length)) L.push(`- ${v.variable} (${v.rendimiento || v.resultado}): ${correspondenciaRV(I, v)}`);
    L.push('');
  }
  L.push('**Información exclusiva de cada fuente:**', '');
  const excl = [];
  if (F.apoderado.length) excl.push('Apoderado: trayectoria del desarrollo, inicio y duración de las dificultades, funcionamiento en casa e impacto familiar.');
  if (F.escolar.length) excl.push(`Colegio: conducta observada en el aula${F.apoyosPrevios.length ? `, apoyos ya aplicados (${F.apoyosPrevios.map((a) => corta(a, 60).toLowerCase()).join('; ')})` : ''}${F.efectividad ? ' y su efectividad' : ''}.`);
  if (F.rvIntegrados.length) excl.push('Realidad virtual: medidas objetivas del desempeño en una tarea estructurada (omisiones, comisiones, tiempos de reacción y actividad motora).');
  L.push(...lista(excl, 'Solo se dispone de una fuente.'), '');
  L.push('**Limitaciones de la integración:**', '');
  L.push(...lista([
    !F.escolar.length && 'No se incorporó informe escolar: la información del colegio proviene del relato del apoderado.',
    F.escolar.length && F.docEsc?.clase !== 'escala_estandarizada' && 'El informe escolar es una observación narrativa, no una escala estandarizada.',
    !F.rv.length && 'No se dispone de evaluación de realidad virtual.',
    F.rvPendientes.length && 'Hay resultados de realidad virtual no atribuidos al caso (identidad sin verificar).',
    !F.nna.length && 'No se registró la entrevista propia del niño, niña o adolescente.',
    'La coincidencia entre fuentes no constituye prueba diagnóstica automática.',
  ].filter(Boolean), ''), '');

  // 3.5
  L.push('## 5. Análisis de síntomas DSM-5-TR', '');
  L.push(`Estados calculados por el motor de reglas (Etapa 9). Inatención: ${I.requisitos.R1.apoyados} de ${I.requisitos.R1.total} síntomas apoyados por evidencia; hiperactividad/impulsividad: ${I.requisitos.R2.apoyados} de ${I.requisitos.R2.total} (umbral para la edad: ${I.umbral}).`, '');
  L.push(...tabla(['Síntoma', 'Estado de la evidencia', 'Fuentes', 'Conductas documentadas', 'Falta o requiere revisión'],
    I.sintomas.map((s) => [`${s.id} ${s.nombre}`, ESTADO_LEGIBLE[s.estado] || s.estado, unir([...new Set(Object.keys(s.porFuente).map((k) => FUENTE_CORTA[k]))]) || '—',
      conductasDeSintoma(ctx, s).join(' · ') || '—', faltanteDeSintoma(s).join('; ') || '—'])));

  // 3.6
  L.push('## 6. Contraste de requisitos diagnósticos', '');
  L.push(...tabla(['Requisito', 'Estado (motor)', 'Evidencia disponible'], Object.entries(I.requisitos).map(([k, r]) => [r.nombre, r.estado, r.detalle || (r.apoyados != null ? `${r.apoyados} apoyados, ${r.indeterminados} indeterminados de ${r.total}` : '—')])));

  // 3.7
  L.push('## 7. Perfil neuropsicológico y funcional', '');
  const filasPerfil = [];
  for (const a of I.areas) {
    const ss = I.sintomas.filter((s) => s.area === a.id && POSITIVOS.includes(s.estado));
    const rvA = F.rvIntegrados.flatMap((e) => (e.resultados.variables || []).filter((v) => VAR_POR_ID.get(v.id)?.area === a.id).map((v) => ({ ...v, inst: nombreInstrumento(ctx, e) })));
    if (a.estado !== 'ÁREA CON MAYOR DIFICULTAD' && !rvA.length) continue;
    const fuentes = [...new Set([...ss.flatMap((s) => fuentesSi(s).map((k) => FUENTE_CORTA[k])), ...(a.evidencia.some((x) => x.tipo === 'dificultad' && !/^R\d/.test(x.texto)) ? ['Apoderado'] : []), ...rvA.map((v) => v.inst)])];
    filasPerfil.push([a.nombre,
      [ss.length && ss.map((s) => s.nombre.toLowerCase()).join('; '), ...rvA.map((v) => `${v.variable}: ${v.rendimiento}`)].filter(Boolean).join(' · ') || a.evidencia.filter((x) => x.tipo === 'dificultad').map((x) => x.texto).slice(0, 2).join('; '),
      unir(fuentes) || '—',
      modSi.length ? unir(modSi.slice(0, 3)) : 'No precisadas',
      unir([...impacto.slice(0, 2), ...(impactoEsc.length ? ['rendimiento escolar (colegio)'] : [])]) || 'No descrita',
      fuentes.length >= 2 ? 'Convergente (varias fuentes)' : 'Una sola fuente: hipótesis por verificar',
      rvA.length ? 'La tarea virtual mide un aspecto específico en condiciones estructuradas' : 'Sin medida normativa específica: no se afirma un déficit neuropsicológico']);
  }
  L.push(...(filasPerfil.length ? tabla(['Área', 'Hallazgo documentado', 'Fuente', 'Condiciones en que aparece', 'Repercusión', 'Grado de certeza', 'Limitaciones'], filasPerfil) : ['No hay áreas con dificultades documentadas.', '']));

  // 3.8
  L.push('## 8. Fortalezas y capacidades preservadas', '');
  L.push(...(fort.length ? tabla(['Capacidad', 'Condiciones', 'Fuente', 'Cómo aprovecharla'], fort.map((f) => [f.capacidad, f.condiciones, f.fuente, f.uso])) : ['La información disponible no permite identificar fortalezas específicas; no se completan por suposición.', '']));

  // 3.9
  L.push('## 9. Dificultades y necesidades de apoyo', '');
  const filasDif = [];
  for (const a of I.areas.filter((x) => x.estado === 'ÁREA CON MAYOR DIFICULTAD')) {
    const ss = I.sintomas.filter((s) => s.area === a.id && POSITIVOS.includes(s.estado));
    const r = recs.find((x) => ss.some((s) => x.hallazgo.toLowerCase().includes(s.nombre.toLowerCase())));
    filasDif.push([a.nombre, ss.length ? ss.map((s) => `${s.conducta || s.nombre}`).join('; ') : a.evidencia.filter((x) => x.tipo === 'dificultad').map((x) => x.texto)[0],
      unir([...impacto.slice(0, 2), ...(impactoEsc.length ? ['rendimiento escolar'] : [])]) || 'Por precisar',
      r ? r.objetivo : 'Por definir con el equipo',
      new Set(ss.flatMap((s) => fuentesSi(s).map((k) => FUENTE_CORTA[k]))).size >= 2 ? '—' : 'Descrita por una sola fuente: confirmar con otra']);
  }
  L.push(...(filasDif.length ? tabla(['Área', 'Dificultad documentada', 'Posible consecuencia funcional', 'Necesidad de apoyo', 'Hipótesis por verificar'], filasDif) : ['No se documentan dificultades.', '']));

  // 3.10
  L.push('## 10. Realidad virtual y otros instrumentos', '');
  if (!F.rv.length && !F.otros.length) L.push('No se registran instrumentos aplicados.', '');
  for (const e of F.rv) {
    const r = e.resultados;
    L.push(`### ${nombreInstrumento(ctx, e)} — ${e.fecha || 'sin fecha'}`, '');
    if (e.estado === 'pendiente_vinculacion') {
      L.push(`**No integrado al caso.** ${(r.vinculacion?.problemas || []).join(' ')} Hasta que el profesional confirme la vinculación, sus resultados no se usan en este informe.`, '');
      continue;
    }
    if (r.valido === true) L.push('Indicador de validez (EVI): la aplicación cumple los requisitos para analizar los resultados.', '');
    if (r.valido === false) L.push('**Indicador de validez (EVI): la aplicación presenta problemas de ejecución; interpretar con cautela.**', '');
    L.push(...tabla(['Índice', 'Qué mide', 'Resultado original', 'Interpretación del instrumento', 'Correspondencia con otras fuentes'],
      (r.variables || []).map((v) => [v.variable, v.mide || VAR_POR_ID.get(v.id)?.nombre || '—', v.resultado || '—', v.interpretacion || v.interpretacion_del_documento || '—', correspondenciaRV(I, v)])));
    const comp = comparacionCondiciones(r.condiciones);
    if (comp.length) L.push('**Según las condiciones de la tarea:**', '', ...comp.map((x) => `- ${x}`), '');
    if (r.vinculacion?.confirmada_por) L.push(`_Vinculación al caso confirmada por ${r.vinculacion.confirmada_por}: ${r.vinculacion.motivo}_`, '');
    L.push('**Límites de la inferencia:**', '', ...[...(r.limitaciones || []), ...(r.vinculacion?.advertencias || [])].map((x) => `- ${x}`), '');
  }
  for (const e of F.otros) L.push(`- **${nombreInstrumento(ctx, e)}** (${e.fecha || 'sin fecha'}${e.aplicador ? `, ${e.aplicador}` : ''}): ${e.resultados ? Object.entries(e.resultados).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; ') : ''}${e.observaciones ? ` — ${e.observaciones}` : ''}. Se interpreta según su manual.`);
  if (F.otros.length) L.push('');

  // 3.11
  L.push('## 11. Explicaciones alternativas y condiciones concurrentes', '');
  const alt = [`Barrido diferencial general: ${I.barrido.estado}${I.barrido.resultado ? ` — ${I.barrido.resultado}` : ''}.`];
  for (const r of I.barrido.ramas) alt.push(`${p.barrido.opciones.find((o) => o.codigo === r.clave)?.texto}: ${r.diferencial}.`);
  alt.push(`Tamizaje médico, sensorial y del sueño: ${I.tamizaje.estado}${I.tamizaje.resultado ? ` — ${I.tamizaje.resultado}` : ''}.`);
  for (const a of I.tamizaje.alertas) alt.push(`Requiere valoración profesional: ${a.motivo.replace(/\.+$/, '')}.`);
  alt.push(`Estado del requisito (motor): ${I.requisitos.R8.estado}.`);
  L.push(...alt.map((x) => `- ${x}`), '', '_Una condición no informada no se considera descartada._', '');

  // 3.12
  L.push('## 12. Recomendaciones individualizadas', '');
  const GRUPOS = { A: 'A. Aula y profesores', B: 'B. Psicopedagogía y apoyos al aprendizaje', C: 'C. Familia y hogar', D: 'D. Evaluación o seguimiento profesional' };
  for (const [g, nombre] of Object.entries(GRUPOS)) {
    const rs = recs.filter((r) => r.grupo === g);
    if (!rs.length) continue;
    L.push(`### ${nombre}`, '');
    L.push(...tabla(['Hallazgo que la justifica', 'Acción concreta', 'Responsable sugerido', 'Objetivo funcional', 'Indicador observable'], rs.map((r) => [r.hallazgo, r.accion, r.responsable, r.objetivo, r.indicador])));
  }
  if (!recs.length) L.push('No hay hallazgos documentados que justifiquen recomendaciones específicas.', '');
  L.push('_Recomendaciones proporcionales a la evidencia disponible; no son tratamientos garantizados y deben revisarse con el equipo._', '');

  // 3.13
  L.push('## 13. Plan de seguimiento', '');
  const plan = recs.filter((r) => ['A', 'B', 'C'].includes(r.grupo)).slice(0, 5);
  L.push(...(plan.length ? tabla(['Conducta o habilidad a mejorar', 'Dónde se medirá', 'Indicador inicial', 'Apoyo', 'Revisión', 'Criterio'],
    plan.map((r) => [r.objetivo, r.grupo === 'C' ? 'Hogar' : 'Aula', `${r.indicador}: registrar durante 2 semanas antes de iniciar (no hay línea base en el expediente)`, r.accion.split('.')[0], 'Fecha a acordar por el equipo', 'Mantener si mejora frente a la línea base; ajustar si no hay cambios en el período acordado; retirar si la conducta deja de interferir']))
    : ['Sin información suficiente para proponer un plan de seguimiento.', '']));

  // 3.14
  L.push('## 14. Información pendiente', '');
  const FUENTE_FALTA = (q) => (/^R1\.|^R2\./.test(q) ? 'Apoderado o colegio (pregunta específica)' : /R4|antes de los 12/.test(q) ? 'Apoderado (historia temprana)' : /R6|contextos/.test(q) ? 'Colegio' : /R8|R9|alternativ/.test(q) ? 'Profesional (valoración diferencial)' : 'Profesional responsable');
  const pend = [
    ...I.informacionFaltante.map((x) => [x.que, x.porque, FUENTE_FALTA(x.que), 'Profesional responsable']),
    ...F.rvPendientes.map((e) => [`Vinculación de ${nombreInstrumento(ctx, e)}`, 'Sin ella sus resultados no pueden integrarse', 'Profesional (verificar identidad y fecha)', 'Profesional responsable']),
  ];
  L.push(...(pend.length ? tabla(['Qué falta', 'Por qué importa', 'Quién o qué puede aportarlo', 'Quién lo revisa'], pend) : ['No hay información pendiente que pueda modificar la interpretación.', '']));

  // 3.15
  L.push('## 15. Conclusión integrada', '');
  if (redaccion?.conclusion) L.push(...parrafos(redaccion.conclusion), MARCA_IA, '');
  else L.push(`${positivos.length ? `El perfil muestra dificultades documentadas ${difTxt.length ? unir(difTxt) : ''}` : 'No se documentan dificultades conductuales DSM-5-TR'}${impacto.length || impactoEsc.length ? `, con repercusión en ${unir([...impacto, ...(impactoEsc.length ? ['el rendimiento escolar'] : [])])}` : ''}.${fortReales.length ? ` Como fortalezas se identifican: ${unir(fortReales.slice(0, 3).map((f) => f.capacidad.split(':')[0].replace(/\.$/, '').toLowerCase()))}.` : ''}${preserv.length ? ` Se mantienen relativamente preservadas: ${unir(preserv.map((f) => f.capacidad.split(':')[0].toLowerCase()))}.` : ''}${recs.length ? ` Las necesidades de apoyo se concentran en: ${unir([...new Set(recs.filter((r) => r.grupo !== 'D').map((r) => r.objetivo.toLowerCase()))].slice(0, 3))}.` : ''}`, '');
  L.push(`**Estado diagnóstico establecido por el motor:** ${I.resultado.titulo}. ${I.resultado.umbral}`, '');
  if (I.puerta === 'CERRADA') L.push('Con la información disponible no es posible establecer una conclusión diagnóstica definitiva.', '');
  else if (I.puerta === 'ABIERTA CON INCERTIDUMBRE') L.push('La conclusión queda abierta con incertidumbre: hay discrepancias o alternativas que el profesional debe ponderar.', '');
  L.push('Límites de la evidencia: los datos provienen de las fuentes indicadas en la sección 2; la realidad virtual es evidencia complementaria y la decisión diagnóstica corresponde al profesional responsable.', '');

  // 3.16
  L.push('## 16. Revisión y validación profesional', '');
  const decidir = [
    ...ctx.contradicciones.filter((x) => x.estado !== 'revisada').map((x) => `Discrepancia sin revisar: ${legible(p, x.descripcion)}`),
    ...F.rvPendientes.map((e) => `Confirmar si ${nombreInstrumento(ctx, e)} corresponde al caso.`),
    ...I.tamizaje.alertas.map((a) => `Valoración sanitaria: ${a.motivo.replace(/\.+$/, '')}.`),
    I.requisitos.R8.estado !== 'NINGUNA IDENTIFICADA' && `Explicaciones alternativas: ${I.requisitos.R8.estado.toLowerCase()}.`,
    I.puerta !== 'ABIERTA' && `Suficiencia de la evidencia: ${I.puerta.toLowerCase()}${I.faltantes.length ? ` (falta: ${I.faltantes.join(', ')})` : ''}.`,
  ].filter(Boolean);
  L.push('**Aspectos que requieren decisión profesional:**', '', ...lista(decidir, 'Validar la integración y la conclusión.'), '');
  if (c.interpretacion?.trim()) L.push('**Interpretación del profesional:**', '', c.interpretacion.trim(), '', `_${c.interpretacion_profesional} (${(c.interpretacion_fecha || '').slice(0, 10)})_`, '');
  L.push(`**Estado de revisión:** ${validacion ? `validado por ${validacion.por} el ${validacion.fecha.slice(0, 10)}` : 'pendiente de validación'}.`, '');

  // 4. Síntesis educativa
  L.push('## Síntesis para docentes y psicólogos educativos', '');
  L.push('_Resumen en lenguaje sencillo derivado de los mismos datos. No contiene un diagnóstico: está pensado para planificar apoyos en el aula._', '');
  if (redaccion?.sintesis_educativa) L.push(...parrafos(redaccion.sintesis_educativa), MARCA_IA, '');
  else L.push('**Cómo funciona en el aula y en casa.** ' + (positivos.length ? `Se describe que: ${unir([...new Set(positivos.map((s) => (s.conducta || s.nombre).replace(/^¿|\?$/g, '').toLowerCase()))].slice(0, 6))}.` : 'No se describen dificultades conductuales específicas.') + (ctxs.length ? ` Se observa en: ${unir(ctxs)}.` : ''), '');
  L.push('**Fortalezas para el aprendizaje.**', '', ...lista(fortReales.map((f) => `${f.capacidad.split(':')[0].replace(/\.$/, '')} — ${f.uso}`), 'Por identificar con el equipo.'), '');
  if (preserv.length) L.push(`**Áreas sin dificultades referidas.** ${unir(preserv.map((f) => f.capacidad.split(':')[0]))}.`, '');
  L.push('**Apoyos en el aula.**', '', ...lista(recs.filter((r) => r.grupo === 'A').map((r) => r.accion), 'Por definir.'), '');
  L.push('**Estrategias psicopedagógicas.**', '', ...lista(recs.filter((r) => r.grupo === 'B').map((r) => r.accion), 'Por definir.'), '');
  if (recs.some((r) => r.grupo === 'C')) L.push('**Orientaciones para el hogar.**', '', ...recs.filter((r) => r.grupo === 'C').map((r) => `- ${r.accion}`), '');
  L.push('**Cómo saber si los apoyos funcionan.**', '', ...lista([...new Set(recs.filter((r) => r.grupo !== 'D').map((r) => r.indicador))], 'Por definir.'), '');
  L.push('**Pendiente de evaluar.**', '', ...lista([...new Set([...I.areas.filter((a) => a.estado === 'SIN INFORMACIÓN SUFICIENTE').map((a) => a.nombre), ...(impactoEsc.length || respuesta(ctx, 'A46') === 'si' ? ['Aprendizajes académicos (lectura, escritura, matemática), si el rendimiento sigue descendido'] : [])])].slice(0, 6), 'Sin aspectos pendientes para el ámbito educativo.'), '');

  // 6. Control de calidad
  const calidad = [
    { control: 'Fuentes vinculadas al caso', ok: !F.rvPendientes.length, detalle: F.rvPendientes.length ? `${F.rvPendientes.length} informe(s) de realidad virtual sin vincular: excluidos del análisis.` : 'Todas las fuentes integradas corresponden al caso.' },
    { control: 'Cada afirmación con su fuente', ok: I.sintomas.filter((s) => POSITIVOS.includes(s.estado)).every((s) => Object.keys(s.porFuente).length), detalle: 'Síntomas, fortalezas y recomendaciones indican la fuente que los respalda.' },
    { control: 'Consistencia entre síntomas y conclusión', ok: true, detalle: 'La conclusión reproduce el estado calculado por el motor sin modificar recuentos ni umbrales.' },
    { control: 'Sin duplicación de evidencia', ok: true, detalle: 'Cada síntoma se cuenta una vez, aunque lo describan varias fuentes.' },
    { control: 'Sin datos inventados', ok: true, detalle: 'El informe se construye solo con datos del expediente; lo que falta se declara.' },
    { control: 'Contradicciones e incertidumbres identificadas', ok: true, detalle: `${disc.length} discrepancia(s); ${I.informacionFaltante.length} aspecto(s) pendiente(s).` },
    { control: 'Interpretación prudente de la realidad virtual', ok: true, detalle: 'Solo se describen las variables que mide el instrumento, con su interpretación original y sus límites.' },
    { control: 'Coherencia entre dificultades, fortalezas y recomendaciones', ok: recs.every((r) => r.hallazgo), detalle: 'Cada recomendación indica el hallazgo que la justifica.' },
    { control: 'Diagnóstico no presentado como validado', ok: !validacion ? true : Boolean(validacion.por), detalle: validacion ? `Validado por ${validacion.por}.` : 'Estado: pendiente de validación profesional.' },
    ...(redaccion ? [{ control: 'Redacción asistida por IA verificada', ok: true, detalle: 'Sin cifras, nombres ni afirmaciones diagnósticas ajenas a los datos; la conclusión diagnóstica la escribe el sistema.' }] : []),
    { control: 'Trazabilidad de las conclusiones', ok: true, detalle: 'Conclusión → estado del motor → síntoma → dato original (sección 5) → fuente (sección 2); detalle completo en la auditoría del caso.' },
  ];
  L.push('## Control de calidad del informe', '');
  L.push(...tabla(['Control', 'Resultado', 'Detalle'], calidad.map((x) => [x.control, x.ok ? 'Cumple' : 'Con limitación', x.detalle])));
  L.push(`_El informe ${calidad.every((x) => x.ok) ? 'superó todas las comprobaciones' : 'tiene limitaciones declaradas arriba'}${tipo === 'final' ? '' : '; es un borrador mientras la evaluación siga en curso'}._`, '');
  return { lineas: L, calidad };
}


// ------------------------------------------------------- redacción con IA ---

/**
 * Datos que se entregan a la IA para redactar: solo lo que el informe ya establece, sin nombres,
 * RUT ni fechas de nacimiento. La IA no recibe el expediente completo.
 */
export function datosParaRedaccion(ctx, I) {
  const F = datosDeFuentes(ctx);
  const positivos = I.sintomas.filter((s) => POSITIVOS.includes(s.estado));
  const fort = fortalezas(ctx, I, F);
  const recs = recomendaciones(ctx, I, F);
  const fuentesDe = (s) => [...new Set(Object.keys(s.porFuente).filter((k) => s.porFuente[k] === 'si').map((k) => FUENTE_CORTA[k]))];
  const impacto = [['A46', 'rendimiento escolar'], ['A47', 'convivencia familiar'], ['A48', 'relaciones con otros niños'], ['A49', 'actividades cotidianas'], ['A51', 'frustración o conflictos']]
    .filter(([q]) => respuesta(ctx, q) === 'si').map(([, t]) => t);
  return {
    genero_referencia: 'niño o niña (usar «el estudiante» si no se sabe)',
    edad: I.edad, etapa: I.etapa,
    fuentes: [
      F.apoderado.length && 'entrevista al apoderado',
      F.escolar.length && `informe del colegio (${F.docEsc?.clase === 'escala_estandarizada' ? 'escala' : 'observación narrativa'})`,
      ...F.rvIntegrados.map((e) => `${nombreInstrumento(ctx, e)} (realidad virtual, ${e.fecha || 'sin fecha'})`),
    ].filter(Boolean),
    fuentes_no_integradas: F.rvPendientes.map((e) => `${nombreInstrumento(ctx, e)}: identidad sin verificar`),
    dificultades: positivos.map((s) => ({ conducta: s.nombre, estado: ESTADO_LEGIBLE[s.estado] || s.estado, fuentes: fuentesDe(s), contextos: s.contextos })),
    discrepancias: I.sintomas.filter((s) => s.contradictorio).map((s) => ({ conducta: s.nombre, por_fuente: Object.fromEntries(Object.entries(s.porFuente).map(([k, v]) => [FUENTE_CORTA[k], V[v] || v])) })),
    sin_informacion: I.sintomas.filter((s) => ['NO INFORMADO', 'DESCONOCIDO'].includes(s.estado)).map((s) => s.nombre),
    situaciones_que_modulan: I.moduladores.filter((m) => m.valor === 'si').map((m) => m.texto),
    realidad_virtual: F.rvIntegrados.flatMap((e) => (e.resultados.variables || []).map((v) => ({ indice: v.variable, interpretacion_del_instrumento: v.rendimiento || v.interpretacion, correspondencia: correspondenciaRV(I, v) }))),
    fortalezas: fort.filter((f) => !f.preservada).map((f) => ({ fortaleza: f.capacidad, fuente: f.fuente, como_aprovecharla: f.uso })),
    areas_sin_dificultades_referidas: fort.filter((f) => f.preservada).map((f) => f.capacidad.split(':')[0]),
    impacto_funcional: [...impacto.map((t) => `${t} (apoderado)`), ...(ctx.hechos.some((h) => h.fuente === 'informe_escolar' && h.slot === 'impacto_academico') ? ['rendimiento escolar (colegio)'] : [])],
    apoyos_ya_aplicados_por_el_colegio: F.apoyosPrevios, efectividad_de_esos_apoyos: F.efectividad,
    apoyos_recomendados: recs.filter((r) => r.grupo !== 'D').map((r) => ({ objetivo: r.objetivo, accion: r.accion, para: { A: 'aula', B: 'psicopedagogía', C: 'familia' }[r.grupo] })),
    evaluaciones_pendientes: recs.filter((r) => r.grupo === 'D').map((r) => r.accion),
    informacion_pendiente: I.informacionFaltante.map((x) => x.que),
    estado_diagnostico_del_motor: I.resultado.titulo,
  };
}

/**
 * Verifica la redacción de la IA antes de usarla. Devuelve { ok, motivos, redaccion }.
 * Rechaza textos con cifras que no están en los datos, nombres del caso, afirmaciones diagnósticas
 * o menciones diagnósticas en la síntesis educativa.
 */
export function verificarRedaccion(salida, datos, { nombres = [] } = {}) {
  const motivos = [];
  const CAMPOS = ['sintesis_ejecutiva', 'integracion', 'conclusion', 'sintesis_educativa'];
  const red = {};
  for (const k of CAMPOS) {
    const t = typeof salida?.[k] === 'string' ? salida[k].trim() : '';
    if (!t) { motivos.push(`Falta «${k}».`); continue; }
    if (t.length > 4000) motivos.push(`«${k}» es demasiado largo.`);
    red[k] = t;
  }
  const fuente = JSON.stringify(datos);
  const todo = Object.values(red).join(' ');
  for (const n of todo.match(/\d+(?:[.,]\d+)?/g) || []) {
    if (!fuente.includes(n) && !fuente.includes(n.replace(',', '.'))) motivos.push(`Cifra no presente en los datos: ${n}.`);
  }
  for (const nombre of nombres.flatMap((x) => String(x).split(/\s+/)).filter((w) => w.length >= 3 && !/^(caso|de|del|la|el|los|las)$/i.test(w))) {
    if (new RegExp(`\\b${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(todo)) motivos.push('Incluye un nombre del caso.');
  }
  if (/(se (le )?diagnostica|diagn[oó]stico (de|confirmado)|tiene tdah|padece|presenta (un )?tdah|cumple (los )?criterios|confirma(n|do)? (el |un )?(diagn[oó]stico|tdah))/i.test(todo)) motivos.push('Contiene una afirmación diagnóstica.');
  if (red.conclusion && /tdah/i.test(red.conclusion)) motivos.push('La conclusión no debe mencionar TDAH (la escribe el sistema).');
  if (red.sintesis_educativa && /(tdah|dsm|diagn[oó]stic)/i.test(red.sintesis_educativa)) motivos.push('La síntesis educativa menciona diagnósticos.');
  return { ok: motivos.length === 0, motivos: [...new Set(motivos)], redaccion: motivos.length ? null : red };
}

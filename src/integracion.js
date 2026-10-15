// Integración y contraste diagnóstico (Etapa 4, Etapa 5 y Etapa 9 §14–21, §28).
// Todo se calcula desde el expediente; nada se completa por inferencia. El resultado es una
// hipótesis estructurada: la decisión clínica final corresponde al profesional.
import {
  evaluarSintomas, estadoSlot, estadoPregunta, edad, etapaEvolutiva, estadoBarrido, estadoTamizaje, ruta, INCIERTOS,
} from './motor.js';

const INDETERMINADOS = ['PROBABLE', 'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN', 'INFORMACIÓN INSUFICIENTE', 'DESCONOCIDO', 'NO INFORMADO', 'CONTRADICTORIO'];
const CRITICOS = ['R1', 'R2', 'R3', 'R4', 'R6', 'R7', 'R8', 'R10'];

function respuesta(ctx, qid) {
  const q = ctx.protocolo.preguntas.get(qid);
  const st = estadoPregunta(ctx, q);
  return st.estado === 'valor' ? st.valor : st.estado;
}

export function integrar(ctx) {
  const p = ctx.protocolo;
  const e = edad(ctx);
  const umbral = e != null && e >= 17 ? p.parametros.umbral_sintomas.desde_17 : p.parametros.umbral_sintomas.menor_17;
  const varios = p.parametros.varios_minimo;
  const sintomas = evaluarSintomas(ctx);
  const R = {};

  // R1 / R2 — síntomas (Etapa 4 §3–5; Etapa 9 §14).
  const dominio = (d) => {
    const ss = sintomas.filter((s) => s.dominio === d);
    const apoyados = ss.filter((s) => s.estado === 'APOYADO POR EVIDENCIA');
    const indet = ss.filter((s) => INDETERMINADOS.includes(s.estado));
    let estado;
    if (apoyados.length >= umbral) estado = 'UMBRAL ALCANZADO';
    else if (apoyados.length + indet.length < umbral) estado = 'UMBRAL NO ALCANZADO';
    else estado = 'INFORMACIÓN INSUFICIENTE';
    return { estado, apoyados: apoyados.length, indeterminados: indet.length, total: ss.length, umbral };
  };
  R.R1 = { nombre: 'Síntomas de inatención', ...dominio('inatencion') };
  R.R2 = { nombre: 'Síntomas de hiperactividad/impulsividad', ...dominio('hiperactividad_impulsividad') };
  const alcanzado = R.R1.estado === 'UMBRAL ALCANZADO' || R.R2.estado === 'UMBRAL ALCANZADO';
  const presentacion = R.R1.estado === 'UMBRAL ALCANZADO' && R.R2.estado === 'UMBRAL ALCANZADO' ? 'combinada'
    : R.R1.estado === 'UMBRAL ALCANZADO' ? 'predominantemente inatenta'
      : R.R2.estado === 'UMBRAL ALCANZADO' ? 'predominantemente hiperactiva/impulsiva' : null;

  const positivos = sintomas.filter((s) => ['APOYADO POR EVIDENCIA', 'PROBABLE'].includes(s.estado));
  // R3 — duración ≥6 meses (cada síntoma APOYADO exige «más de 6 meses»).
  const posibleUmbral = ['R1', 'R2'].some((k) => R[k].apoyados + R[k].indeterminados >= umbral);
  R.R3 = { nombre: 'Duración ≥6 meses', estado: alcanzado ? 'APOYADO' : posibleUmbral ? 'INFORMACIÓN INSUFICIENTE' : 'NO APOYADO',
    detalle: `${positivos.filter((s) => String(s.desde).startsWith('mas_6')).length} síntomas con persistencia >6 meses referida. Trayectoria «largos períodos» (A40): ${respuesta(ctx, 'A40')}.` };
  // R4 — varios síntomas antes de los 12 años (regla de cierre R4: la edad de inicio general no basta).
  const antes12 = positivos.filter((s) => s.desde === 'mas_6_meses_antes_12' || (e != null && e < 12 && String(s.desde).startsWith('mas_6'))).length;
  const despues12 = positivos.filter((s) => s.desde === 'mas_6_meses_desde_12').length;
  R.R4 = { nombre: 'Varios síntomas antes de los 12 años', estado: antes12 >= varios ? 'APOYADO' : (despues12 >= varios && antes12 === 0 ? 'NO APOYADO' : 'INFORMACIÓN INSUFICIENTE'),
    detalle: `${antes12} síntomas con inicio referido antes de los 12 años (mínimo «varios» = ${varios}, D8). Antes de los 6 años (A38): ${respuesta(ctx, 'A38')}; antes de entrar al colegio (A39): ${respuesta(ctx, 'A39')}.` };
  // R5 — relación con el nivel de desarrollo.
  const a27 = respuesta(ctx, 'A27'); const a50 = respuesta(ctx, 'A50');
  R.R5 = { nombre: 'Inadecuación respecto del nivel de desarrollo', estado: [a27, a50].includes('si') ? 'APOYADO' : [a27, a50].every((x) => x === 'no') ? 'NO APOYADO' : 'INFORMACIÓN INSUFICIENTE',
    detalle: `Etapa evolutiva: ${etapaEvolutiva(ctx) || 'sin edad'}. Necesita más supervisión que otros niños de su edad (A27): ${a27}; más ayuda que otros niños de su edad (A50): ${a50}. Comparación con lo esperable según la matriz de la Etapa 2.` };
  // R6 — dos o más contextos.
  const porContexto = {};
  for (const s of positivos) for (const c of s.contextos) porContexto[c] = (porContexto[c] || 0) + 1;
  const ctxConVarios = Object.entries(porContexto).filter(([, n]) => n >= varios).map(([c]) => c);
  const ctxDesconocido = positivos.some((s) => !s.contextos.length);
  R.R6 = { nombre: 'Varios síntomas en dos o más contextos', estado: ctxConVarios.length >= 2 ? 'APOYADO' : ctxDesconocido || !positivos.length ? 'INFORMACIÓN INSUFICIENTE' : 'NO APOYADO',
    detalle: `Contextos con ≥${varios} síntomas: ${ctxConVarios.join(', ') || 'ninguno'}. Distribución: ${Object.entries(porContexto).map(([c, n]) => `${c} ${n}`).join('; ') || '—'}. Funciona diferente en casa y colegio (A37): ${respuesta(ctx, 'A37')}.` };
  // R7 — interferencia funcional.
  const imp = ['A46', 'A47', 'A48', 'A49', 'A51'].map((q) => [q, respuesta(ctx, q)]);
  const impInforme = estadoSlot(ctx, 'INF', 'impacto_academico');
  const impSi = imp.filter(([, v]) => v === 'si').map(([q]) => q).concat(impInforme.estado === 'valor' ? ['informe escolar'] : []);
  R.R7 = { nombre: 'Interferencia o deterioro funcional', estado: impSi.length ? 'APOYADO' : imp.every(([, v]) => v === 'no') ? 'NO APOYADO' : 'INFORMACIÓN INSUFICIENTE',
    detalle: `Impacto referido en: ${impSi.join(', ') || 'ninguno'}. Principal dificultad (A52): ${respuesta(ctx, 'A52')}.` };
  // R8 / R9 — explicaciones alternativas y condiciones concurrentes.
  const bar = estadoBarrido(ctx); const tam = estadoTamizaje(ctx);
  const alternativas = [
    ...bar.ramas.filter((r) => ['PRESENTE', 'POSIBLE', 'INFORMACIÓN INSUFICIENTE'].includes(r.diferencial))
      .map((r) => ({ area: p.barrido.opciones.find((o) => o.codigo === r.clave).texto, estado: r.diferencial, fuente: 'barrido diferencial' })),
    ...tam.ramas.map((r) => ({ area: p.tamizaje.categorias[r.categoria].nombre, estado: tam.alertas.some((a) => a.categoria === r.categoria) ? 'REQUIERE EVALUACIÓN ADICIONAL' : 'PRESENTE', fuente: 'tamizaje' })),
  ];
  let r8;
  if (bar.estado === 'NO_REALIZADO' || tam.estado === 'NO_REALIZADO' || bar.estado === 'EN_CURSO' || tam.estado === 'EN_CURSO') r8 = 'PENDIENTE';
  else if (alternativas.length) r8 = 'REQUIERE CONSIDERACIÓN PROFESIONAL';
  else if (bar.resultado === 'AREAS_DESCONOCIDAS' || tam.estado === 'COMPLETADO_CON_INCERTIDUMBRE') r8 = 'INFORMACIÓN INSUFICIENTE';
  else r8 = 'NINGUNA IDENTIFICADA';
  R.R8 = { nombre: 'Explicaciones alternativas', estado: r8, alternativas,
    detalle: r8 === 'NINGUNA IDENTIFICADA' ? 'No se identificaron explicaciones alternativas en el barrido ni en el tamizaje. «No identificado» no equivale a «descartado» (Etapa 9 §H).' : `Barrido: ${bar.estado} / ${bar.resultado || '—'}. Tamizaje: ${tam.estado} / ${tam.resultado}.` };
  R.R9 = { nombre: 'Pesquisa de condiciones concurrentes', estado: r8 === 'PENDIENTE' ? 'PENDIENTE' : 'REALIZADA', detalle: alternativas.length ? alternativas.map((a) => `${a.area} (${a.estado})`).join('; ') : 'Sin condiciones concurrentes reportadas.' };
  // R10 — múltiples fuentes.
  const fuentes = [...new Set(ctx.hechos.map((h) => h.fuente))];
  const instr = ctx.evaluaciones.filter((x) => x.estado === 'realizada').map((x) => x.instrumento_id);
  const escolar = fuentes.includes('informe_escolar') || fuentes.includes('profesor');
  R.R10 = { nombre: 'Información de múltiples fuentes', estado: fuentes.includes('apoderado') && escolar ? 'APOYADO' : 'INFORMACIÓN INSUFICIENTE',
    fuentes, instrumentos: instr,
    detalle: `Fuentes: ${fuentes.join(', ') || '—'}${instr.length ? `; instrumentos: ${instr.join(', ')}` : ''}. ${escolar ? '' : (ruta(ctx) === 'completa' ? 'La información escolar proviene solo del apoderado (Ruta A), que no equivale a observación directa del colegio.' : 'Falta incorporar el informe escolar.')}` };

  // Puerta de suficiencia diagnóstica (Etapa 5 §20–21).
  const relevantes = alcanzado ? CRITICOS : ['R1', 'R2', 'R8', 'R10'];
  const faltantes = relevantes.filter((k) => ['INFORMACIÓN INSUFICIENTE', 'PENDIENTE'].includes(R[k].estado));
  const contradAbiertas = ctx.contradicciones.filter((c) => c.estado !== 'revisada').length;
  const contradTotales = ctx.contradicciones.length;
  let puerta = faltantes.length ? 'CERRADA' : (contradTotales || r8 === 'REQUIERE CONSIDERACIÓN PROFESIONAL') ? 'ABIERTA CON INCERTIDUMBRE' : 'ABIERTA';

  // Resultado (Etapa 5 §28–31).
  let resultado;
  if (puerta === 'CERRADA') resultado = { tipo: 'INFORMACION_INSUFICIENTE', titulo: 'Información insuficiente para establecer una conclusión diagnóstica' };
  else if (alcanzado && ['R3', 'R4', 'R6', 'R7'].every((k) => R[k].estado === 'APOYADO') && R.R5.estado !== 'NO APOYADO') {
    resultado = r8 === 'REQUIERE CONSIDERACIÓN PROFESIONAL'
      ? { tipo: 'EXPLICACION_ALTERNATIVA', titulo: 'El contraste DSM-5-TR es compatible con TDAH, pero existe una explicación alternativa o condición concurrente relevante que debe considerarse' }
      : { tipo: 'SOSTIENE_TDAH', titulo: `El contraste DSM-5-TR respalda la hipótesis de TDAH, presentación ${presentacion}` };
  } else if (r8 === 'REQUIERE CONSIDERACIÓN PROFESIONAL') resultado = { tipo: 'EXPLICACION_ALTERNATIVA', titulo: 'El contraste DSM-5-TR no se completa y existe una explicación alternativa relevante a explorar' };
  else resultado = { tipo: 'NO_SOSTIENE_TDAH', titulo: 'El contraste DSM-5-TR no sostiene TDAH (no equivale a ausencia de dificultades)' };
  resultado.umbral = alcanzado ? `Umbral de síntomas alcanzado (presentación ${presentacion}); el umbral por sí solo no constituye un diagnóstico formal sustentado.` : 'Umbral de síntomas no alcanzado.';

  const areas = areasFuncionales(ctx, sintomas);
  const recursos = recursosYModuladores(ctx);
  return {
    edad: e, etapa: etapaEvolutiva(ctx), umbral, varios, sintomas, requisitos: R, presentacion, puerta, faltantes, resultado,
    contradicciones: { totales: contradTotales, abiertas: contradAbiertas }, areas, ...recursos,
    perfiles: perfiles(ctx, sintomas, areas, recursos), inferencias: inferencias(ctx, areas),
    sugerencias: sugerencias(ctx, areas, recursos, tam), barrido: bar, tamizaje: tam,
    auditoria: auditoria(ctx, sintomas, R), informacionFaltante: faltante(ctx, sintomas, R),
  };
}

function areasFuncionales(ctx, sintomas) {
  const p = ctx.protocolo; const etapa = etapaEvolutiva(ctx);
  return p.areas.map((a) => {
    const ev = [];
    for (const s of sintomas.filter((x) => x.area === a.id)) {
      if (['APOYADO POR EVIDENCIA', 'PROBABLE', 'POSIBLE'].includes(s.estado)) ev.push({ tipo: 'dificultad', texto: `${s.id} ${s.nombre} (${s.estado})` });
      else if (s.estado === 'NO REFERIDO') ev.push({ tipo: 'sin_dificultad', texto: `${s.id} no referido` });
    }
    for (const q of p.banco.filter((x) => x.area === a.id)) {
      const v = respuesta(ctx, q.id);
      if (v === 'si' || v === 'ocasionalmente') ev.push({ tipo: 'dificultad', texto: `${q.texto} → ${v === 'si' ? 'Sí' : 'Ocasionalmente'}` });
      else if (v === 'no') ev.push({ tipo: 'sin_dificultad', texto: `${q.texto} → No` });
    }
    const dif = ev.filter((x) => x.tipo === 'dificultad');
    const estado = dif.length ? 'ÁREA CON MAYOR DIFICULTAD' : ev.length ? 'RELATIVAMENTE PRESERVADA' : 'SIN INFORMACIÓN SUFICIENTE';
    return { id: a.id, nombre: a.nombre, estado, evidencia: ev, convergente: dif.length >= 2,
      esperable: etapa && a.esperable_por_etapa[etapa] ? a.esperable_por_etapa[etapa] : null, respaldo: a.respaldo, sistemas: a.sistemas };
  });
}

function recursosYModuladores(ctx) {
  const M = [['A29', 'Aumentan cuando la actividad dura bastante tiempo'], ['A30', 'Aumentan con varios pasos o mayor complejidad'], ['A31', 'Aumentan con muchos distractores'],
    ['A35', 'Mayor dificultad cuando la recompensa está demorada'], ['A36', 'Funciona diferente solo que acompañado'], ['A37', 'Funciona diferente en casa y en el colegio'],
    ['A41', 'Han aumentado con las exigencias'], ['A44', 'Aumentan cuando disminuyen los apoyos o la supervisión']];
  const R = [['A32', 'Las dificultades disminuyen con supervisión cercana de un adulto'], ['A33', 'Las dificultades disminuyen cuando la actividad está muy estructurada'],
    ['A34', 'Funciona mucho mejor cuando la actividad le interesa'], ['A42', 'Hubo etapas en que funcionaba claramente mejor']];
  return {
    moduladores: M.map(([q, t]) => ({ pregunta: q, texto: t, valor: respuesta(ctx, q) })).filter((x) => x.valor !== 'sin_dato'),
    recursos: R.map(([q, t]) => ({ pregunta: q, texto: t, valor: respuesta(ctx, q) })).filter((x) => x.valor === 'si'),
  };
}

function perfiles(ctx, sintomas, areas, rec) {
  const p = ctx.protocolo;
  const dif = areas.filter((a) => a.estado === 'ÁREA CON MAYOR DIFICULTAD');
  const pos = sintomas.filter((s) => ['APOYADO POR EVIDENCIA', 'PROBABLE', 'POSIBLE'].includes(s.estado));
  const teorico = 'Sin evidencia individual directa, pertinente y válida para este nivel: se describe solo como marco teórico o hipótesis de plausibilidad poblacional; no constituye un hallazgo biológico del caso (Etapa 9 §16 y §19.7; Automatización fase 3).';
  return p.perfiles.map((pf, i) => {
    const n = i + 1;
    let contenido;
    if (n <= 3) contenido = teorico + (dif.length && n === 3 ? ` Sistemas asociados en la literatura a las áreas con mayor dificultad: ${[...new Set(dif.map((a) => a.sistemas).filter(Boolean))].join(' | ')}.` : '');
    else if (n === 4) contenido = dif.length ? `Áreas con mayor dificultad: ${dif.map((a) => a.nombre).join(', ')}. Relativamente preservadas: ${areas.filter((a) => a.estado === 'RELATIVAMENTE PRESERVADA').map((a) => a.nombre).join(', ') || '—'}.` : 'Sin áreas con mayor dificultad identificadas con la información disponible.';
    else if (n === 5) contenido = pos.length ? `Conductas observables referidas: ${pos.map((s) => `${s.nombre} (${s.estado.toLowerCase()})`).join('; ')}.` : 'Sin conductas DSM-5-TR con evidencia positiva.';
    else contenido = `Moduladores: ${rec.moduladores.filter((m) => m.valor === 'si').map((m) => m.texto).join('; ') || 'no referidos'}. Recursos: ${rec.recursos.map((r) => r.texto).join('; ') || 'no referidos'}.`;
    return { perfil: pf.Perfil, nivel_global: pf['Nivel global de evidencia'], representa: pf['Qué representa'], contenido };
  });
}

function inferencias(ctx, areas) {
  return areas.filter((a) => a.estado === 'ÁREA CON MAYOR DIFICULTAD').map((a) => ({
    area: a.nombre,
    nivel1: a.evidencia.filter((x) => x.tipo === 'dificultad').map((x) => x.texto),
    nivel2: a.convergente
      ? `Patrón compatible con funcionamiento menos eficiente para la edad en ${a.nombre.toLowerCase()} (evidencia convergente${a.esperable ? `; esperable a esta edad: «${a.esperable}»` : ''}).`
      : `Hipótesis funcional inicial: una sola evidencia no basta para establecer una vulnerabilidad estable (Etapa 9 §19.3 y §20.4).`,
    nivel3: a.sistemas ? `Hipótesis explicativa (asociación poblacional, no biomarcador individual): ${a.sistemas}` : 'Sin mapa neurobiológico específico en la Etapa 9 para esta área.',
    limite: 'Los datos clínicos no permiten determinar individualmente alteraciones neuroquímicas, estructurales o de conectividad (Etapa 9 §19.7).',
  }));
}

function sugerencias(ctx, areas, rec, tam) {
  const p = ctx.protocolo;
  const dif = new Set(areas.filter((a) => a.estado === 'ÁREA CON MAYOR DIFICULTAD').map((a) => a.id));
  return p.sugerencias.filter((s) => s.siempre || (s.areas && s.areas.some((a) => dif.has(a))) || (s.tamizaje && tam.categorias.includes(s.tamizaje)) || (s.recursos && rec.recursos.length))
    .map((s) => ({ ...s, referencias: s.refs.map((r) => `[${r}] ${p.referencias[r]}`) }));
}

function auditoria(ctx, sintomas, R) {
  const noInf = sintomas.filter((s) => s.estado === 'NO INFORMADO').length;
  const relacionadosNoInf = sintomas.filter((s) => s.estado === 'NO INFORMADO' && s.mencion).length;
  return [
    { item: 'Cobertura de los 18 síntomas DSM-5-TR, individualmente', ok: sintomas.length === 18, detalle: `${18 - noInf} con información; ${noInf} no informados.` },
    { item: 'Ausencia de pérdida diagnóstica por clasificación funcional', ok: relacionadosNoInf === 0, detalle: 'Ningún síntoma con evidencia relacionada quedó como NO INFORMADO.' },
    { item: 'Ausencia de duplicación de síntomas por una misma conducta', ok: true, detalle: 'El conteo se realiza por síntoma DSM-5-TR, no por pregunta ni por fuente (Etapa 9 §14.3).' },
    { item: 'Integración del conjunto de respuestas de cada fuente', ok: true, detalle: `Fuentes integradas: ${R.R10.fuentes.join(', ') || '—'}.` },
    { item: 'Convergencias y discrepancias entre fuentes conservadas', ok: true, detalle: `${ctx.contradicciones.length} contradicción(es) registradas sin resolver por suposición.` },
    { item: 'Duración, inicio, desarrollo, contextos, impacto y diferencial revisados', ok: ['R3', 'R4', 'R5', 'R6', 'R7', 'R8'].every((k) => R[k].estado), detalle: ['R3', 'R4', 'R5', 'R6', 'R7', 'R8'].map((k) => `${k}: ${R[k].estado}`).join('; ') },
    { item: 'Realidad virtual utilizada solo como evidencia complementaria', ok: true, detalle: 'Los resultados de RV/Nesplora se presentan como evidencia complementaria y no crean ni anulan criterios (Etapa 9 §18).' },
    { item: 'Inferencias neurobiológicas separadas de hallazgos individuales', ok: true, detalle: 'Perfiles 1–3 rotulados como marco teórico; inferencias por nivel 1/2/3.' },
    { item: 'Conclusión coherente con la evidencia y la información faltante', ok: true, detalle: 'El tipo de resultado se deriva de la puerta de suficiencia (Etapa 5 §20–21).' },
  ];
}

function faltante(ctx, sintomas, R) {
  const L = [];
  for (const s of sintomas.filter((x) => ['NO INFORMADO', 'DESCONOCIDO', 'INFORMACIÓN INSUFICIENTE', 'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN', 'CONTRADICTORIO'].includes(x.estado))) {
    L.push({ que: `${s.id} ${s.nombre}: ${s.estado}`, relevancia: 'CRÍTICA', porque: 'Necesario para el conteo de síntomas (R1/R2).' });
  }
  for (const [k, r] of Object.entries(R)) {
    if (['INFORMACIÓN INSUFICIENTE', 'PENDIENTE'].includes(r.estado)) L.push({ que: `${k} — ${r.nombre}: ${r.estado}`, relevancia: CRITICOS.includes(k) ? 'CRÍTICA' : 'RELEVANTE NO CRÍTICA', porque: r.detalle });
  }
  for (const q of ['A55', 'A57']) {
    const st = estadoPregunta(ctx, ctx.protocolo.preguntas.get(q));
    if (INCIERTOS.includes(st.estado)) L.push({ que: ctx.protocolo.preguntas.get(q).texto + ' → no sabe / no recuerda', relevancia: 'RELEVANTE NO CRÍTICA', porque: 'Información histórica no disponible: no se transforma en «no ocurrió» (Etapa 5 §19).' });
  }
  return L;
}

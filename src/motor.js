// Motor de decisiones (Etapa 9): estado acumulativo, información faltante, selección de la
// mínima pregunta suficiente, ramas, barrido diferencial, tamizaje y gate de cierre.
// Funciones puras sobre el contexto del expediente: no escriben en la base de datos.
import { validarPregunta, similitud } from './validador.js';

export const INCIERTOS = ['no_sabe', 'no_recuerda'];
const FRECUENTE = ['varias_al_dia', 'casi_todos_los_dias', 'algunas_por_semana'];

// ------------------------------------------------------------ hechos ---

export function hechosDe(ctx, dim, slot) {
  return ctx.hechos.filter((h) => h.dimension_id === dim && (slot == null || h.slot === slot));
}
export const preguntadas = (ctx, qid) => ctx.preguntas.some((p) => p.pregunta_id === qid);
export const preguntasDeDim = (ctx, dim) => ctx.preguntas.filter((p) => p.dimension_id === dim);

/** Estado de un dato, independiente de la fuente. */
export function estadoSlot(ctx, dim, slot) {
  const hs = hechosDe(ctx, dim, slot);
  const fuentes = [...new Set(hs.map((h) => h.fuente))];
  if (ctx.contradicciones.some((c) => c.dimension_id === dim && c.slot === slot)) {
    return { estado: 'contradiccion', valores: [...new Set(hs.filter((h) => h.estado === 'valor').map((h) => h.valor))], fuentes };
  }
  const v = hs.filter((h) => h.estado === 'valor');
  if (v.length) { const u = v[v.length - 1]; return { estado: 'valor', valor: u.valor, fuente: u.fuente, fuentes, origen: u.origen }; }
  if (hs.length) { const u = hs[hs.length - 1]; return { estado: u.estado, fuente: u.fuente, fuentes }; }
  return { estado: 'sin_dato', fuentes };
}
export const resuelto = (st) => st.estado !== 'sin_dato';

/** Estado de la información que busca una pregunta (incluye su equivalente literal del banco). */
export function estadoPregunta(ctx, q) {
  const st = estadoSlot(ctx, ...q.objetivo);
  if (st.estado === 'sin_dato' && q.equivale_a) {
    const eq = ctx.protocolo.preguntas.get(q.equivale_a);
    const st2 = estadoSlot(ctx, ...eq.objetivo);
    if (st2.estado !== 'sin_dato') return { ...st2, via: q.equivale_a };
  }
  return st;
}
export const lista = (v) => (v ? String(v).split(',').filter(Boolean) : []);

// ------------------------------------------------------- fase inicial ---

export function edad(ctx) {
  const st = estadoSlot(ctx, 'INI', 'edad');
  return st.estado === 'valor' ? Number(st.valor) : null;
}

export function slotsIniciales(ctx) {
  const ex = estadoSlot(ctx, 'INI', 'informe_existe');
  const s = ['motivo', 'edad', 'informe_existe'];
  if (ex.estado === 'valor' && ex.valor === 'si') s.push('informe_disponible');
  return s;
}
export const faseInicialCompleta = (ctx) => slotsIniciales(ctx).every((s) => resuelto(estadoSlot(ctx, 'INI', s)));

/** Ruta A (completa) o B (con_informe). Etapa 7 §5. */
export function ruta(ctx) {
  if (ctx.caso.ruta_forzada) return ctx.caso.ruta_forzada;
  if (!faseInicialCompleta(ctx)) return null;
  const ex = estadoSlot(ctx, 'INI', 'informe_existe');
  if (ex.estado !== 'valor' || ex.valor !== 'si') return 'completa';
  const d = estadoSlot(ctx, 'INI', 'informe_disponible');
  return d.estado === 'valor' && d.valor === 'si' ? 'con_informe' : 'completa';
}

export function justificacionRuta(ctx) {
  if (ctx.caso.ruta_forzada) return `Ruta modificada por el profesional: ${ctx.caso.ruta_motivo || 'sin motivo registrado'}.`;
  const ex = estadoSlot(ctx, 'INI', 'informe_existe');
  const d = estadoSlot(ctx, 'INI', 'informe_disponible');
  if (ex.estado !== 'valor') return 'No se pudo establecer si existe informe escolar (respuesta «no sabe»); no se interpreta como «no», pero se aplica la Ruta A para no perder información escolar (D1).';
  if (ex.valor === 'no') return 'Ruta A (Etapa 7 §5.1): no existe informe escolar; el apoderado aporta lo que conozca del contexto escolar.';
  if (d.estado === 'valor' && d.valor === 'si') return 'Ruta B (Etapa 7 §5.2): existe informe escolar disponible; el apoderado se centra en hogar, desarrollo, trayectoria, autonomía e impacto, y solo se pregunta lo que el informe no resuelva.';
  return 'Ruta A (Etapa 7 §5.1): el informe escolar existe pero no puede obtenerse ahora; si se obtiene después se incorpora como fuente independiente.';
}

export function etapaEvolutiva(ctx) {
  const e = edad(ctx);
  if (e == null) return null;
  return ctx.protocolo.etapas_edad.find((x) => e >= x.desde && e <= x.hasta)?.etapa || (e < 2 ? 'menor de 2 años' : 'mayor de 17 años');
}

// ---------------------------------------------------------- síntomas ---

function presenciaPorFuente(ctx, s) {
  const hs = ctx.hechos.filter((h) => h.dimension_id === s.id && h.slot.startsWith('presencia'));
  const porFuente = {};
  for (const h of hs) (porFuente[h.fuente] ||= []).push(h);
  const res = {};
  for (const [f, lista_] of Object.entries(porFuente)) {
    const vals = lista_.map((h) => (h.estado === 'valor' ? h.valor : h.estado));
    if (vals.includes('si')) res[f] = 'si';
    else if (vals.includes('ocasionalmente')) res[f] = 'ocasionalmente';
    else if (vals.includes('ambiguo')) res[f] = 'parcial';
    else if (vals.some((v) => INCIERTOS.includes(v))) res[f] = vals.includes('no') ? 'no' : 'no_sabe';
    else if (vals.length && vals.every((v) => v === 'no')) res[f] = 'no';
  }
  return res;
}

/** Evaluación del síntoma DSM-5-TR con los estados de la Etapa 9 §14.1. */
export function evaluarSintoma(ctx, s) {
  const p = ctx.protocolo;
  const porFuente = presenciaPorFuente(ctx, s);
  const valores = Object.values(porFuente);
  const mencion = hechosDe(ctx, s.id, 'mencion').filter((h) => h.estado === 'valor' && h.valor === 'si');
  const positivo = valores.includes('si');
  const parcial = !positivo && valores.includes('parcial');
  const contradictorio = positivo && valores.includes('no');
  const frec = estadoSlot(ctx, s.id, 'frecuencia');
  const desde = estadoSlot(ctx, s.id, 'desde');
  const ctxs = new Set(hechosDe(ctx, s.id, 'contextos').filter((h) => h.estado === 'valor').flatMap((h) => lista(h.valor)));
  if (porFuente.informe_escolar === 'si' || porFuente.profesor === 'si') ctxs.add('colegio');
  const ctxResuelto = ctxs.size > 0 || hechosDe(ctx, s.id, 'contextos').length > 0;
  const deep = ctx.preguntas.filter((q) => q.dimension_id === s.id && ['frecuencia', 'desde', 'contextos'].includes(q.slot)).length;
  const max = p.parametros.max_profundizacion_sintoma;

  // Preguntas de presencia del banco: R1.4 usa dos (instrucciones / finalización).
  const bancoPend = s.preguntas.filter((qid) => !resuelto(estadoSlot(ctx, s.id, `presencia:${qid}`)));
  const presenciaApoderadoResuelta = 'apoderado' in porFuente && (porFuente.apoderado === 'si' || bancoPend.length === 0);
  const presenciaEstablecida = presenciaApoderadoResuelta || porFuente.informe_escolar === 'si';

  // «Ocasionalmente»: registrar y evaluar la necesidad de profundización (Etapa 9 §6.2): se cuantifica la frecuencia.
  const ocasional = !positivo && !parcial && valores.includes('ocasionalmente');
  const faltantes = [];
  if (ocasional && !resuelto(frec)) faltantes.push('frecuencia');
  if (positivo || parcial) {
    if (!resuelto(frec)) faltantes.push('frecuencia');
    if (!parcial) {
      if (!resuelto(desde)) faltantes.push('desde');
      if (!ctxResuelto) faltantes.push('contextos');
    }
  }
  const agotado = deep >= max;
  let estado;
  const frecuente = frec.estado === 'valor' && FRECUENTE.includes(frec.valor);
  if (contradictorio) estado = 'CONTRADICTORIO';
  else if (positivo) {
    if (faltantes.length && !agotado) estado = 'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN';
    else if (frecuente && desde.estado === 'valor' && desde.valor.startsWith('mas_6')) estado = 'APOYADO POR EVIDENCIA';
    else if ((frec.estado === 'valor' && frec.valor === 'ocasionalmente') || (desde.estado === 'valor' && desde.valor === 'menos_6_meses')) estado = 'POSIBLE';
    else if (frecuente) estado = 'PROBABLE';
    else estado = 'INFORMACIÓN INSUFICIENTE';
  } else if (valores.includes('ocasionalmente')) estado = 'POSIBLE';
  else if (parcial) estado = faltantes.length && !agotado ? 'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN' : 'INFORMACIÓN INSUFICIENTE';
  else if (mencion.length && !presenciaEstablecida) estado = 'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN';
  else if (valores.length && valores.every((v) => v === 'no')) estado = 'NO REFERIDO';
  else if (valores.some((v) => INCIERTOS.includes(v))) estado = 'DESCONOCIDO';
  else estado = 'NO INFORMADO';

  const actividad = Math.max(0, ...ctx.hechos.filter((h) => h.dimension_id === s.id).map((h) => h.respuesta_id || 0));
  return {
    id: s.id, nombre: s.nombre, dominio: s.dominio, area: s.area, conducta: s.conducta, estado, porFuente,
    mencion: mencion.length > 0, positivo, contradictorio,
    frecuencia: frec.estado === 'valor' ? frec.valor : frec.estado,
    desde: desde.estado === 'valor' ? desde.valor : desde.estado,
    contextos: [...ctxs], profundizacion: deep, faltantes: agotado ? [] : faltantes, agotado, ocasional,
    presenciaEstablecida, bancoPendiente: bancoPend, actividad,
    fuentes: [...new Set(ctx.hechos.filter((h) => h.dimension_id === s.id).map((h) => h.fuente))],
  };
}

export const evaluarSintomas = (ctx) => ctx.protocolo.sintomas.map((s) => evaluarSintoma(ctx, s));
const POSITIVOS = ['APOYADO POR EVIDENCIA', 'PROBABLE', 'POSIBLE', 'EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN', 'CONTRADICTORIO', 'INFORMACIÓN INSUFICIENTE'];
export const esPositivo = (e) => e.positivo || e.estado === 'POSIBLE' || (e.mencion && POSITIVOS.includes(e.estado));

// -------------------------------------------------- barrido y tamizaje ---

export function estadoBarrido(ctx) {
  const p = ctx.protocolo;
  const st = estadoSlot(ctx, 'BARRIDO', 'areas');
  if (st.estado === 'sin_dato') return { estado: 'NO_REALIZADO', areas: [], ramas: [] };
  const areas = st.estado === 'valor' ? lista(st.valor) : [];
  let resultado = 'AREAS_SELECCIONADAS';
  if (areas.includes('M')) resultado = 'EXPLORADO_SIN_DIFICULTADES_REPORTADAS';
  else if (areas.includes('N') || INCIERTOS.includes(st.estado)) resultado = 'AREAS_DESCONOCIDAS';
  const ramas = areas.filter((a) => !['M', 'N'].includes(a)).map((a) => evaluarRama(ctx, `BAR-${a}`, p.barrido.ramas[a] || [], a));
  const abiertas = ramas.filter((r) => r.estado === 'ABIERTA');
  return { estado: abiertas.length ? 'EN_CURSO' : 'COMPLETADO', resultado, areas, ramas };
}

function evaluarRama(ctx, dim, qs, clave) {
  // Una rama se recorre en orden; si la apertura (presencia) es «no», se cierra (Etapa 9 §H).
  const pendientes = [];
  let cerradaPorNo = false;
  const P = ctx.protocolo.preguntas;
  for (const [i, q0] of qs.entries()) {
    const q = P.get(q0.id);
    const st = estadoPregunta(ctx, q);
    if (i === 0 && st.estado === 'valor' && st.valor === 'no') { cerradaPorNo = true; break; }
    if (!resuelto(st)) pendientes.push(q.id);
  }
  const apertura = qs[0] ? estadoPregunta(ctx, P.get(qs[0].id)) : { estado: 'sin_dato' };
  let diferencial;
  if (!qs.length) diferencial = 'EXPLORADA EN TAMIZAJE';
  else if (cerradaPorNo) diferencial = 'NO IDENTIFICADA';
  else if (apertura.estado === 'valor' && apertura.valor === 'si') diferencial = 'PRESENTE';
  else if (apertura.estado === 'valor' && apertura.valor === 'ocasionalmente') diferencial = 'POSIBLE';
  else if (INCIERTOS.includes(apertura.estado)) diferencial = 'INFORMACIÓN INSUFICIENTE';
  else if (apertura.estado === 'valor') diferencial = 'PRESENTE';
  else diferencial = 'POSIBLE';
  return { clave, dim, estado: cerradaPorNo || !pendientes.length ? 'CERRADA' : 'ABIERTA', pendientes, diferencial };
}

export function estadoTamizaje(ctx) {
  const p = ctx.protocolo;
  const st = estadoSlot(ctx, 'TAMIZAJE', 'categorias');
  const bar = estadoBarrido(ctx);
  // Áreas del barrido que se exploran en el tamizaje (audición, visión, sueño, salud), salvo que su rama se haya cerrado con «No».
  const derivadas = bar.ramas.filter((r) => r.diferencial !== 'NO IDENTIFICADA')
    .map((r) => p.barrido.opciones.find((o) => o.codigo === r.clave)?.deriva_tamizaje).filter(Boolean);
  if (st.estado === 'sin_dato') return { estado: 'NO_REALIZADO', resultado: 'NO_DETERMINADO', categorias: [], ramas: [], derivadas, alertas: [] };
  const sel = st.estado === 'valor' ? lista(st.valor) : [];
  const ninguna = sel.includes('J');
  const incierta = sel.includes('K') || INCIERTOS.includes(st.estado);
  // «Ninguna» no anula información previa contradictoria del barrido (Etapa 7 §14.1; Etapa 9 §H.1-4).
  const cats = [...new Set([...sel.filter((c) => !['J', 'K'].includes(c)), ...derivadas])];
  const ramas = cats.map((c) => ({ categoria: c, ...evaluarRama(ctx, `TAM-${c}`, p.tamizaje.categorias[c]?.preguntas || [], c) }));
  const alertas = [];
  for (const r of ramas) {
    const def = p.tamizaje.categorias[r.categoria];
    if (def.alerta_sanitaria) alertas.push({ categoria: r.categoria, motivo: `${def.nombre}: requiere revisión por un profesional sanitario (Etapa 7 §14.1).` });
    for (const q of def.preguntas) {
      const s = estadoSlot(ctx, `TAM-${r.categoria}`, q.id);
      if (q.alerta_si && s.estado === 'valor' && s.valor === q.alerta_si) alertas.push({ categoria: r.categoria, motivo: `${def.nombre}: se informan ronquidos intensos o pausas respiratorias; se recomienda valoración por un profesional sanitario.` });
    }
  }
  let estado; let resultado;
  if (ninguna && !cats.length) { estado = 'COMPLETADO'; resultado = 'EXPLORADO_SIN_DIFICULTADES_REPORTADAS'; }
  else if (incierta && !cats.length) { estado = 'COMPLETADO_CON_INCERTIDUMBRE'; resultado = 'INCERTIDUMBRE'; }
  else { estado = ramas.some((r) => r.estado === 'ABIERTA') ? 'EN_CURSO' : (incierta ? 'COMPLETADO_CON_INCERTIDUMBRE' : 'COMPLETADO'); resultado = 'HALLAZGOS_REPORTADOS'; }
  return { estado, resultado, categorias: cats, ramas, derivadas, alertas, ninguna, incierta };
}

// --------------------------------------------------------- bloques ---

export function informeCargado(ctx) { return ctx.informesEscolares.length > 0; }

export function cobertura(ctx) {
  // Qué preguntas de complementación escolar (Anexo 7-C) ya responde el informe (D6).
  const deInforme = ctx.hechos.filter((h) => h.fuente === 'informe_escolar');
  return {
    algun_sintoma: deInforme.some((h) => h.slot === 'presencia:informe'),
    desde: deInforme.some((h) => h.slot === 'desde'),
    contextos: deInforme.some((h) => h.slot === 'presencia:informe'),
    impacto_academico: deInforme.some((h) => h.slot === 'impacto_academico'),
  };
}

function reglaBloque(ctx, b, sintomas) {
  if (b.regla === 'siempre') return true;
  if (b.regla === 'algun_sintoma_positivo') return sintomas.some(esPositivo);
  if (b.regla.startsWith('dominio_positivo:')) return sintomas.filter((s) => s.dominio === b.regla.split(':')[1]).some(esPositivo);
  return false;
}

// ------------------------------------------------------- decisión ---

/**
 * Necesidades de información en orden de prioridad (Etapa 9 §7 y J.4).
 * Cada necesidad propone preguntas candidatas que luego pasan por el validador.
 */
export function necesidades(ctx) {
  const p = ctx.protocolo;
  const N = [];
  const add = (fase, qid, justificacion, prioridad = 0) => N.push({ fase, qid, justificacion, prioridad });

  // F1 — secuencia inicial obligatoria (brief §3; Etapa 7 §3–4).
  const ini = slotsIniciales(ctx);
  for (const [i, s] of ini.entries()) {
    if (resuelto(estadoSlot(ctx, 'INI', s))) continue;
    const q = p.inicio.find((x) => x.objetivo[1] === s);
    add('F1', q.id, `Secuencia inicial obligatoria (paso ${i + 1} de ${ini.length}).`);
    return N; // orden estricto
  }

  const sintomas = evaluarSintomas(ctx);
  const r = ruta(ctx);

  // Prioridad: candidatos sintomáticos activos (Etapa 9 §14.2, regla de activación inmediata y de prioridad).
  const activos = sintomas.filter((e) => (e.mencion && !e.presenciaEstablecida) || (e.faltantes.length && (e.positivo || e.ocasional || e.estado.startsWith('EVIDENCIA'))))
    .sort((a, b) => b.actividad - a.actividad);
  for (const e of activos) {
    const s = p.sintomasPorId.get(e.id);
    if (e.mencion && !e.presenciaEstablecida && e.bancoPendiente.length) {
      // Con varias preguntas para el mismo síntoma, la más cercana a lo mencionado (pregunta específica, §14.2).
      const ev = hechosDe(ctx, e.id, 'mencion').map((h) => h.evidencia).join(' ');
      const mejor = [...e.bancoPendiente].sort((a, b) => similitud(ev, p.preguntas.get(b).texto) - similitud(ev, p.preguntas.get(a).texto))[0];
      add('PRIORIDAD', mejor, `Activación inmediata (Etapa 9 §14.2): se mencionó una conducta con posible correspondencia con «${e.nombre}» (${e.id}); se usa la pregunta específica del banco para caracterizarla, sin confirmarla por asociación.`, 2);
      continue;
    }
    for (const dim of e.faltantes) {
      const qid = s.profundizacion.find((x) => x.endsWith(dim.toUpperCase()));
      add('PRIORIDAD', qid, `Profundización del síntoma ${e.id} «${e.nombre}» (${e.profundizacion + 1}/${p.parametros.max_profundizacion_sintoma}): falta «${dim}». ${e.ocasional ? 'Respuesta «Ocasionalmente»: se evalúa la necesidad de profundización cuantificando la frecuencia (Etapa 9 §6.2). ' : ''}${dim === 'desde' ? 'Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).' : dim === 'contextos' ? 'Permite contrastar R6 (dos o más contextos).' : 'Prioridad de la Automatización (regla 2a: frecuencia e intensidad).'}`, 1);
    }
  }

  // F2 / F3 — síntomas DSM-5-TR por dominio, luego bloques de su fase.
  for (const [fase, dom] of [['F2', 'inatencion'], ['F3', 'hiperactividad_impulsividad']]) {
    for (const e of sintomas.filter((x) => x.dominio === dom)) {
      if (e.presenciaEstablecida || !e.bancoPendiente.length) continue;
      if (e.porFuente.apoderado === 'si') continue;
      add(fase, e.bancoPendiente[0], `Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): ${e.id} «${e.nombre}» sin información del apoderado.`);
    }
    for (const b of p.bloques.filter((x) => x.fase === fase)) addBloque(b);
  }

  // F4 — contexto escolar según ruta (Etapa 7 §5).
  if (r === 'completa' || (r === 'con_informe' && informeCargado(ctx))) {
    const cob = cobertura(ctx);
    for (const q of p.ruta_a_escolar) {
      const base = p.colegio.find((c) => c.id === q.base);
      if (r === 'con_informe' && base?.cubierta_por && cob[base.cubierta_por]) continue;
      add('F4', q.id, r === 'completa'
        ? 'Ruta A (Etapa 7 §5.1): el apoderado aporta lo que conozca del funcionamiento escolar (no equivale a observación del colegio).'
        : 'Ruta B (Etapa 7 §5.2): el informe escolar no contiene esta información; se pregunta solo el vacío.');
    }
  }
  // F5, F8 — bloques.
  for (const fase of ['F5', 'F8']) for (const b of p.bloques.filter((x) => x.fase === fase)) addBloque(b);

  // F7 — barrido diferencial general y sus ramas (Etapa 9 §H, J.6).
  const bar = estadoBarrido(ctx);
  if (bar.estado === 'NO_REALIZADO') add('F7', 'BARRIDO', 'Barrido diferencial obligatorio antes del cierre (Etapa 9 §H; regla absoluta J.2).');
  for (const rama of bar.ramas.filter((x) => x.estado === 'ABIERTA')) {
    add('F7', rama.pendientes[0], `Rama abierta del barrido diferencial: «${p.barrido.opciones.find((o) => o.codigo === rama.clave)?.texto}». Solo se abren las áreas seleccionadas.`);
  }
  // F6 — tamizaje médico, sensorial y del sueño (Etapa 9 §H.1, J.6.1) — después del barrido (J.5).
  if (bar.estado !== 'NO_REALIZADO' && bar.estado !== 'EN_CURSO') {
    const tam = estadoTamizaje(ctx);
    if (tam.estado === 'NO_REALIZADO') add('F6', 'TAMIZAJE', 'Módulo obligatorio de tamizaje médico, sensorial y del sueño (Etapa 9 §H.1); la entrevista no puede cerrarse mientras esté NO_REALIZADO o EN_CURSO.');
    for (const rama of tam.ramas.filter((x) => x.estado === 'ABIERTA')) {
      add('F6', rama.pendientes[0], `Categoría seleccionada del tamizaje: «${p.tamizaje.categorias[rama.categoria].nombre}»; una sola pregunta por turno sobre la dimensión que falta.`);
    }
  }
  return N.sort((a, b) => b.prioridad - a.prioridad);

  function addBloque(b) {
    if (!reglaBloque(ctx, b, sintomas)) return;
    const hechas = b.preguntas.filter((qid) => preguntadas(ctx, qid)).length;
    if (hechas >= b.max) return;
    for (const qid of b.preguntas) {
      const q = p.preguntas.get(qid);
      if (resuelto(estadoPregunta(ctx, q))) continue;
      add(b.fase, qid, `Bloque «${b.id}» (${b.origen}). Mínima pregunta suficiente: ${hechas + 1} de máx. ${b.max}.`);
    }
  }
}

/** Decide el siguiente paso. Nunca formula más de una pregunta. */
export function siguientePaso(ctx) {
  const bloqueadas = [];
  for (const n of necesidades(ctx)) {
    const q = ctx.protocolo.preguntas.get(n.qid);
    const v = validarPregunta(ctx, { pregunta_id: q.id, texto: q.texto, origen: 'motor' });
    if (v.ok) return { accion: 'preguntar', pregunta: q, fase: n.fase, justificacion: [n.justificacion, ...v.notas].join(' '), validacion: v, bloqueadas };
    if (!bloqueadas.some((b) => b.pregunta_id === q.id)) {
      bloqueadas.push({ pregunta_id: q.id, motivos: v.reglas.filter((x) => !x.ok).map((x) => `${x.regla}: ${x.detalle}`) });
    }
  }
  const gate = puedeCerrarEntrevista(ctx);
  if (!gate.ok) return { accion: 'sin_alternativa', bloqueadas, pendientes: gate.motivos };
  if (ruta(ctx) === 'con_informe' && !informeCargado(ctx)) {
    return { accion: 'esperar_informe', bloqueadas, justificacion: 'La entrevista del apoderado está completa; la información escolar se obtiene del informe (Ruta B). Al incorporarlo, solo se preguntarán sus vacíos.' };
  }
  return { accion: 'cerrar', bloqueadas, justificacion: 'PUEDE_CERRAR_ENTREVISTA = VERDADERO (Etapa 9 §J.2): barrido diferencial y tamizaje completos, sin ramas abiertas ni información obligatoria pendiente.' };
}

/** Gate obligatorio de cierre de la entrevista del apoderado (Etapa 9 §J.2). */
export function puedeCerrarEntrevista(ctx) {
  const motivos = [];
  if (!faseInicialCompleta(ctx)) motivos.push('Fase inicial incompleta.');
  const bar = estadoBarrido(ctx);
  if (bar.estado !== 'COMPLETADO') motivos.push(`Barrido diferencial ${bar.estado}.`);
  const tam = estadoTamizaje(ctx);
  if (!['COMPLETADO', 'COMPLETADO_CON_INCERTIDUMBRE', 'CUBIERTO_POR_FUENTE'].includes(tam.estado)) motivos.push(`Tamizaje médico, sensorial y del sueño ${tam.estado}.`);
  const abiertos = evaluarSintomas(ctx).filter((e) => e.faltantes.length || (e.bancoPendiente.length && !e.presenciaEstablecida));
  if (abiertos.length) motivos.push(`Síntomas con información pendiente: ${abiertos.map((e) => e.id).join(', ')}.`);
  return { ok: motivos.length === 0, motivos };
}

/** Resumen compacto del estado (trazas de auditoría). */
export function resumenEstado(ctx) {
  const ini = faseInicialCompleta(ctx);
  const sint = ini ? evaluarSintomas(ctx) : [];
  return {
    turno: ctx.caso.turno,
    estado_global: ctx.caso.estado_global,
    fase_inicial_completa: ini,
    ruta: ruta(ctx),
    edad: edad(ctx),
    sintomas: Object.fromEntries(sint.filter((s) => s.estado !== 'NO INFORMADO').map((s) => [s.id, s.estado])),
    barrido: ini ? estadoBarrido(ctx).estado : 'NO_REALIZADO',
    tamizaje: ini ? estadoTamizaje(ctx).estado : 'NO_REALIZADO',
    contradicciones_abiertas: ctx.contradicciones.filter((c) => c.estado === 'abierta').length,
  };
}

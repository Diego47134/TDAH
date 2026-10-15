// Motor de decisiones (capa Etapa 9).
// Ciclo: consultar estado → identificar pendiente → seleccionar pregunta autorizada → validar → presentar.
// Funciones puras sobre el contexto del expediente: no escriben en la base de datos.
import { validarPregunta } from './validador.js';

export const ESTADOS_INCIERTOS = ['no_sabe', 'no_recuerda'];

// ---------------------------------------------------------------- slots ---

export function hechosDe(ctx, dimId, slot) {
  return ctx.hechos.filter((h) => h.dimension_id === dimId && h.slot === slot);
}

export function preguntasDe(ctx, dimId, slot) {
  return ctx.preguntas.filter((p) => p.dimension_id === dimId && (slot == null || p.slot === slot));
}

/** Estado de un dato del expediente, independiente de la fuente. */
export function estadoSlot(ctx, dimId, slot) {
  const hs = hechosDe(ctx, dimId, slot);
  const fuentes = [...new Set(hs.map((h) => h.fuente))];
  const contr = ctx.contradicciones.filter((c) => c.dimension_id === dimId && c.slot === slot);
  if (contr.length) {
    const valores = [...new Set(hs.filter((h) => h.estado === 'valor').map((h) => h.valor))];
    return { estado: 'contradiccion', valores, fuentes, contradicciones: contr.map((c) => c.id) };
  }
  const conValor = hs.filter((h) => h.estado === 'valor');
  if (conValor.length) {
    const u = conValor[conValor.length - 1];
    return { estado: 'valor', valor: u.valor, fuentes, fuente: u.fuente, origen: u.origen };
  }
  if (hs.length) {
    const u = hs[hs.length - 1];
    return { estado: u.estado, fuentes, fuente: u.fuente };
  }
  return { estado: 'sin_dato', fuentes };
}

function banco(ctx, dimId, slot) {
  const p = ctx.protocolo;
  const lista = dimId === 'INI' ? p.fase_inicial : p.dimensionesPorId.get(dimId).preguntas;
  return lista.filter((q) => q.slot === slot).sort((a, b) => a.especificidad - b.especificidad);
}

function maxEspecificidadPreguntada(ctx, dimId, slot) {
  return preguntasDe(ctx, dimId, slot).reduce((m, p) => Math.max(m, p.especificidad), 0);
}

const yaPreguntada = (ctx, qid) => ctx.preguntas.some((p) => p.pregunta_id === qid);

/** Preguntas del banco que el motor considera para resolver un slot, en orden de preferencia. */
export function candidatasSlot(ctx, dimId, slot) {
  const st = estadoSlot(ctx, dimId, slot);
  const maxEsp = maxEspecificidadPreguntada(ctx, dimId, slot);
  const grupoUsado = (q) => {
    const g = ctx.protocolo.grupoDePregunta?.get(q.id);
    return g ? g.preguntas.some((id) => id !== q.id && yaPreguntada(ctx, id)) : false;
  };
  // Excluye las ya formuladas y las funcionalmente equivalentes a una ya formulada.
  const libres = banco(ctx, dimId, slot).filter((q) => !yaPreguntada(ctx, q.id) && !grupoUsado(q));
  if (st.estado === 'sin_dato') return libres.filter((q) => !q.tras_incertidumbre);
  if (st.estado === 'ambiguo') return libres.filter((q) => !q.tras_incertidumbre && q.especificidad > maxEsp);
  if (ESTADOS_INCIERTOS.includes(st.estado)) return libres.filter((q) => q.tras_incertidumbre);
  return [];
}

/** Un slot es terminal cuando ya no procede preguntar por él. */
export function slotTerminal(ctx, dimId, slot) {
  const st = estadoSlot(ctx, dimId, slot);
  if (st.estado === 'sin_dato') return false;
  if (st.estado === 'valor' || st.estado === 'contradiccion') return true;
  if (dimId !== 'INI') {
    const d = ctx.protocolo.dimensionesPorId.get(dimId);
    if (d && preguntasDe(ctx, dimId).length >= ctx.protocolo.limites.tope_absoluto_por_dimension) return true;
  }
  return candidatasSlot(ctx, dimId, slot).length === 0;
}

// ------------------------------------------------------- fase inicial ---

export function slotsIniciales(ctx) {
  const existe = estadoSlot(ctx, 'INI', 'informe_existe');
  const slots = ['motivo', 'edad', 'informe_existe'];
  if (existe.estado === 'valor' && existe.valor === 'si') slots.push('informe_disponible');
  return slots;
}

export function faseInicialCompleta(ctx) {
  return slotsIniciales(ctx).every((s) => slotTerminal(ctx, 'INI', s));
}

export function edad(ctx) {
  const st = estadoSlot(ctx, 'INI', 'edad');
  return st.estado === 'valor' ? Number(st.valor) : null;
}

/** Ruta de entrevista: con_informe | completa | null (todavía no determinable). */
export function ruta(ctx) {
  if (ctx.caso.ruta_forzada) return ctx.caso.ruta_forzada;
  const existe = estadoSlot(ctx, 'INI', 'informe_existe');
  if (!slotTerminal(ctx, 'INI', 'informe_existe')) return null;
  if (existe.estado !== 'valor' || existe.valor !== 'si') return 'completa';
  const disp = estadoSlot(ctx, 'INI', 'informe_disponible');
  if (!slotTerminal(ctx, 'INI', 'informe_disponible')) return null;
  return disp.estado === 'valor' && disp.valor === 'si' ? 'con_informe' : 'completa';
}

export function justificacionRuta(ctx) {
  if (ctx.caso.ruta_forzada) return `Ruta modificada manualmente: ${ctx.caso.ruta_motivo || 'sin motivo registrado'}.`;
  const existe = estadoSlot(ctx, 'INI', 'informe_existe');
  const disp = estadoSlot(ctx, 'INI', 'informe_disponible');
  if (existe.estado !== 'valor') return `No se pudo establecer si existe informe escolar (${existe.estado}); por seguridad se aplica la entrevista completa.`;
  if (existe.valor === 'no') return 'No existe informe escolar: se aplica la ruta de entrevista completa.';
  if (disp.estado === 'valor' && disp.valor === 'si') return 'Existe informe escolar y está disponible: la entrevista al apoderado se centra en hogar, desarrollo, trayectoria, autonomía, funcionamiento y vacíos del informe.';
  return `Existe informe escolar pero no está disponible (${disp.valor ?? disp.estado}): se aplica la ruta completa.`;
}

// --------------------------------------------------------- dimensiones ---

export function dimensionAplica(ctx, d) {
  const e = edad(ctx);
  if (e == null) return true;
  if (d.edad_min != null && e < d.edad_min) return false;
  if (d.edad_max != null && e > d.edad_max) return false;
  return true;
}

export function evaluarDimension(ctx, d) {
  const r = ruta(ctx);
  const slots = {};
  for (const s of ['presencia', ...d.esenciales]) slots[s] = estadoSlot(ctx, d.id, s);
  const hechosDim = ctx.hechos.filter((h) => h.dimension_id === d.id);
  const base = {
    id: d.id, nombre: d.nombre, dominio: d.dominio, perfil: d.perfil, ambito: d.ambito, obligatoria: !!d.obligatoria,
    slots, faltantes: [], preguntas_hechas: preguntasDe(ctx, d.id).length,
    ultima_actividad: hechosDim.reduce((m, h) => Math.max(m, h.respuesta_id || 0), 0),
  };
  if (!dimensionAplica(ctx, d)) return { ...base, estado: 'no_aplica', motivo: 'Fuera del rango de edad de la dimensión.' };

  const pres = slots.presencia;
  let estado; let motivo; let faltantes = [];
  if (!slotTerminal(ctx, d.id, 'presencia')) {
    faltantes = ['presencia'];
    estado = pres.estado === 'sin_dato' ? 'pendiente' : 'en_curso';
  } else if (pres.estado === 'valor' && pres.valor === 'no') {
    estado = 'resuelta'; motivo = 'Situación no referida (ausente).';
  } else if (pres.estado === 'valor' && pres.valor === 'si') {
    faltantes = d.esenciales.filter((s) => !slotTerminal(ctx, d.id, s));
    if (faltantes.length) estado = 'en_curso';
    else if (d.esenciales.every((s) => slots[s].estado === 'valor')) { estado = 'resuelta'; motivo = 'Presente y caracterizada.'; }
    else { estado = 'parcial'; motivo = 'Presente; algunos datos quedaron desconocidos, ambiguos o contradictorios.'; }
  } else {
    estado = 'parcial'; motivo = `Presencia ${pres.estado === 'contradiccion' ? 'contradictoria entre registros' : 'desconocida o ambigua'}; se registra sin suponer.`;
  }

  if (d.ambito === 'escolar' && r === 'con_informe' && ctx.informesEscolares.length === 0 && ['pendiente', 'en_curso'].includes(estado)) {
    return { ...base, estado: 'pendiente_informe', faltantes, motivo: 'Se espera obtener del informe escolar.' };
  }
  return { ...base, estado, faltantes, motivo };
}

export function evaluarTodas(ctx) {
  return ctx.protocolo.dimensiones.map((d) => evaluarDimension(ctx, d));
}

const TERMINALES = ['resuelta', 'parcial', 'no_aplica'];

/** Resumen compacto del estado (se usa en las trazas de auditoría). */
export function resumenEstado(ctx) {
  const dims = faseInicialCompleta(ctx) ? evaluarTodas(ctx) : [];
  return {
    turno: ctx.caso.turno,
    estado_global: ctx.caso.estado_global,
    fase_inicial_completa: faseInicialCompleta(ctx),
    ruta: ruta(ctx),
    iniciales: Object.fromEntries(['motivo', 'edad', 'informe_existe', 'informe_disponible'].map((s) => {
      const st = estadoSlot(ctx, 'INI', s);
      return [s, st.estado === 'valor' ? st.valor : st.estado];
    })),
    dimensiones: Object.fromEntries(dims.map((d) => [d.id, d.estado])),
    contradicciones_abiertas: ctx.contradicciones.filter((c) => c.estado === 'abierta').length,
  };
}

// ------------------------------------------------------- decisión ---

/**
 * Decide el siguiente paso. Nunca formula más de una pregunta.
 * @returns {{accion:'preguntar'|'esperar_informe'|'cerrar'|'sin_alternativa', ...}}
 */
export function siguientePaso(ctx) {
  const bloqueadas = [];
  const probar = (q, justificacion, extra = {}) => {
    const v = validarPregunta(ctx, { pregunta_id: q.id, texto: q.texto, origen: 'motor' });
    if (v.ok) {
      const just = [justificacion, ...v.notas].join(' ');
      return { accion: 'preguntar', pregunta: q, justificacion: just, validacion: v, bloqueadas, ...extra };
    }
    bloqueadas.push({ pregunta_id: q.id, motivos: v.reglas.filter((x) => !x.ok).map((x) => `${x.regla}: ${x.detalle}`) });
    return null;
  };

  // 1) Secuencia inicial obligatoria, en orden estricto.
  const iniciales = slotsIniciales(ctx);
  for (let i = 0; i < iniciales.length; i++) {
    const s = iniciales[i];
    if (slotTerminal(ctx, 'INI', s)) continue;
    const st = estadoSlot(ctx, 'INI', s);
    for (const q of candidatasSlot(ctx, 'INI', s)) {
      const motivo = st.estado === 'ambiguo'
        ? `Secuencia inicial (paso ${i + 1}): la respuesta sobre «${s}» fue ambigua; se usa una pregunta más específica.`
        : `Secuencia inicial obligatoria (paso ${i + 1}): «${ctx.protocolo.slots[s].etiqueta}».`;
      const r = probar(q, motivo);
      if (r) return r;
    }
    return { accion: 'sin_alternativa', bloqueadas, pendientes: [`INI:${s}`] };
  }

  // 2) Dimensiones: primero profundizar las en curso (la más reciente), luego las pendientes en orden.
  const evals = evaluarTodas(ctx);
  const orden = (e) => ctx.protocolo.ordenDimension(ctx.protocolo.dimensionesPorId.get(e.id));
  // En curso: la actividad más reciente primero (profundización inmediata); empates por orden del protocolo.
  const enCurso = evals.filter((e) => e.estado === 'en_curso').sort((a, b) => (b.ultima_actividad - a.ultima_actividad) || (orden(a) - orden(b)));
  const pendientes = evals.filter((e) => e.estado === 'pendiente').sort((a, b) => orden(a) - orden(b));
  const lim = ctx.protocolo.limites.max_preguntas_por_dimension;

  for (const e of [...enCurso, ...pendientes]) {
    const d = ctx.protocolo.dimensionesPorId.get(e.id);
    for (const slot of e.faltantes) {
      const st = estadoSlot(ctx, d.id, slot);
      for (const q of candidatasSlot(ctx, d.id, slot)) {
        let j;
        if (e.estado === 'pendiente') {
          j = `Dimensión obligatoria pendiente «${d.nombre}» (${d.dominio}): no hay datos en el expediente desde ninguna fuente.`;
        } else if (st.estado === 'ambiguo') {
          j = `La respuesta sobre «${slot}» de «${d.nombre}» fue ambigua; se formula una pregunta más específica en lugar de suponer.`;
        } else if (ESTADOS_INCIERTOS.includes(st.estado)) {
          j = `Se respondió «${st.estado === 'no_sabe' ? 'no sé' : 'no recuerdo'}» sobre «${slot}» de «${d.nombre}»: no se interpreta como negativa; se intenta una única pregunta alternativa con un ejemplo concreto.`;
        } else {
          const pres = e.slots.presencia;
          j = `Profundización: «${d.nombre}» tiene presencia referida (fuente: ${pres.fuente}${pres.origen === 'mencion_espontanea' ? ', mención espontánea' : ''}) y falta caracterizar: ${e.faltantes.join(', ')}. Se pregunta por «${ctx.protocolo.slots[slot].etiqueta}».`;
        }
        if (d.ambito === 'escolar' && ruta(ctx) === 'con_informe') {
          j += ' El informe escolar no resolvió este dato (vacío relevante).';
        }
        if (e.preguntas_hechas >= lim) j += ` Se supera el límite orientativo de ${lim} preguntas porque falta un dato esencial.`;
        const r = probar(q, j, { dimension: e.id });
        if (r) return r;
      }
    }
  }

  // 3) Cierre o espera.
  const obligatorias = evals.filter((e) => e.obligatoria);
  const esperandoInforme = obligatorias.filter((e) => e.estado === 'pendiente_informe');
  const abiertas = obligatorias.filter((e) => !TERMINALES.includes(e.estado) && e.estado !== 'pendiente_informe');
  if (abiertas.length) return { accion: 'sin_alternativa', bloqueadas, pendientes: abiertas.map((e) => e.id) };
  if (esperandoInforme.length) {
    return { accion: 'esperar_informe', bloqueadas, pendientes: esperandoInforme.map((e) => e.id),
      justificacion: 'La entrevista del hogar está completa; las dimensiones escolares se esperan del informe escolar.' };
  }
  return { accion: 'cerrar', bloqueadas, justificacion: 'Todas las dimensiones obligatorias están exploradas (resueltas, parciales o no aplicables).' };
}

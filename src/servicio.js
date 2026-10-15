// Backend de control del flujo de evaluación. Orquesta motor, validador, intérprete,
// persistencia y auditoría. El software (no la IA) controla estado y transiciones.
import * as X from './expediente.js';
import { transaccion, ahora } from './db.js';
import {
  siguientePaso, ruta, justificacionRuta, resumenEstado, estadoSlot, faseInicialCompleta, evaluarSintomas,
  estadoBarrido, estadoTamizaje, edad, cobertura, informeCargado, puedeCerrarEntrevista, etapaEvolutiva,
} from './motor.js';
import { validarPregunta } from './validador.js';
import { interpretarRespuesta, detectarMenciones, ErrorEntrada } from './interprete.js';
import { extraerPorReglas, validarExtraccionManual } from './informeEscolar.js';
import { evaluarRequisitos, generarInforme, markdownAHtml } from './informe.js';
import { integrar } from './integracion.js';
import { validarConsentimiento, validarAsentimiento, permiteIAExterna, tieneAsentimiento, ErrorConsentimiento, VERSION_POLITICA } from './privacidad.js';

export class ErrorServicio extends Error {
  constructor(status, mensaje, detalle) { super(mensaje); this.status = status; this.detalle = detalle; }
}

const vistaPregunta = (q, extra = {}) => ({
  id: q.id, texto: q.texto, tipo: q.tipo, grupo: q.grupo, fase: q.fase, origen: q.origen,
  opciones: (q.opciones || []).map(({ codigo, texto, excluyente, incierta, edad_min }) => ({ codigo, texto, excluyente: !!excluyente, incierta: !!incierta, edad_min })),
  objetivo: q.objetivo, ...extra,
});

export function crearServicio({ db, protocolo, ia }) {
  const P = protocolo;
  const ctxDe = (id, fuente = 'apoderado') => {
    const c = X.contexto(db, P, id);
    if (!c) throw new ErrorServicio(404, 'Caso no encontrado');
    return { ...c, fuente };
  };

  // ------------------------------------------------------------ motor ---
  function avanzar(casoId) {
    let ctx = ctxDe(casoId);
    const r = ruta(ctx);
    if (r && r !== ctx.caso.ruta) {
      X.actualizarCaso(db, casoId, { ruta: r });
      X.registrarDecision(db, casoId, ctx.caso.turno, 'ruta_determinada', { ruta: r, justificacion: justificacionRuta(ctx) });
      ctx = ctxDe(casoId);
    }
    const paso = siguientePaso(ctx);
    if (paso.bloqueadas.length) X.registrarDecision(db, casoId, ctx.caso.turno, 'preguntas_descartadas', { descartadas: paso.bloqueadas });
    if (paso.accion === 'preguntar') {
      const q = paso.pregunta;
      const turno = ctx.caso.turno + 1;
      X.registrarPregunta(db, casoId, turno, q, paso.justificacion);
      const e = edad(ctx);
      const actual = vistaPregunta(q, { justificacion: paso.justificacion, turno, fase_nombre: P.fases.find((f) => f.id === (paso.fase === 'PRIORIDAD' ? q.fase : paso.fase))?.nombre || 'Profundización prioritaria' });
      actual.opciones = actual.opciones.filter((o) => !o.edad_min || e == null || e >= o.edad_min);
      X.actualizarCaso(db, casoId, { turno, pregunta_actual: actual, estado_global: faseInicialCompleta(ctx) ? 'entrevista' : 'fase_inicial' });
      X.registrarDecision(db, casoId, turno, 'pregunta_seleccionada', {
        pregunta_id: q.id, fase: paso.fase, justificacion: paso.justificacion, validacion: paso.validacion.reglas, estado: resumenEstado(ctx),
      });
      return { accion: 'preguntar', pregunta: actual };
    }
    const post = ['informe_final', 'validado'].includes(ctx.caso.estado_global) ? ctx.caso.estado_global : null;
    if (paso.accion === 'esperar_informe') {
      X.actualizarCaso(db, casoId, { pregunta_actual: null, estado_global: post || 'esperando_informe_escolar' });
      X.registrarDecision(db, casoId, ctx.caso.turno, 'espera_informe_escolar', { justificacion: paso.justificacion });
    } else if (paso.accion === 'cerrar') {
      X.actualizarCaso(db, casoId, { pregunta_actual: null, estado_global: post || 'entrevista_completa' });
      X.registrarDecision(db, casoId, ctx.caso.turno, 'entrevista_cerrada', { justificacion: paso.justificacion, gate: puedeCerrarEntrevista(ctx) });
    } else {
      X.actualizarCaso(db, casoId, { pregunta_actual: null });
      X.registrarError(db, casoId, 'motor', 'Sin pregunta autorizada con información pendiente', paso);
      X.registrarDecision(db, casoId, ctx.caso.turno, 'sin_alternativa_autorizada', { pendientes: paso.pendientes });
    }
    return { accion: paso.accion, pendientes: paso.pendientes, justificacion: paso.justificacion };
  }

  function revalidarActual(casoId) {
    const ctx = ctxDe(casoId);
    const actual = ctx.caso.pregunta_actual;
    if (!actual) return avanzar(casoId);
    const ctxSin = { ...ctx, preguntas: ctx.preguntas.filter((p) => p.turno !== ctx.caso.turno) };
    const v = validarPregunta(ctxSin, { pregunta_id: actual.id, texto: actual.texto, origen: 'motor' });
    if (v.ok) return { accion: 'preguntar', pregunta: actual };
    X.retirarPregunta(db, casoId, ctx.caso.turno);
    X.registrarDecision(db, casoId, ctx.caso.turno, 'pregunta_retirada', { pregunta_id: actual.id, motivos: v.reglas.filter((x) => !x.ok).map((x) => `${x.regla}: ${x.detalle}`) });
    X.actualizarCaso(db, casoId, { pregunta_actual: null });
    return avanzar(casoId);
  }

  /** Discrepancias entre fuentes sobre un mismo síntoma (SÍ en una fuente, NO en otra). */
  function detectarDiscrepancias(casoId, turno) {
    const ctx = ctxDe(casoId);
    const nuevas = [];
    for (const e of evaluarSintomas(ctx)) {
      if (!e.contradictorio) continue;
      const hs = ctx.hechos.filter((h) => h.dimension_id === e.id && h.slot.startsWith('presencia') && h.estado === 'valor');
      const si = hs.find((h) => h.valor === 'si'); const no = hs.find((h) => h.valor === 'no' && h.fuente !== si.fuente);
      if (!no) continue;
      const d = X.registrarDiscrepancia(db, casoId, e.id, 'presencia', si.id, no.id,
        `«${e.nombre}»: ${si.fuente} informa «Sí» y ${no.fuente} informa «No». Puede explicarse por contexto, demanda, observador o supervisión (Etapa 9 §11); se conserva sin resolver.`);
      if (d) { nuevas.push(d); X.registrarDecision(db, casoId, turno, 'discrepancia_registrada', d); }
    }
    return nuevas;
  }

  function registrarMenciones(casoId, texto, fuente, respuestaId, preguntaId, turno, excluir) {
    const reg = [];
    for (const m of detectarMenciones(P, texto)) {
      if (m.sintoma === excluir) continue;
      const ctx = ctxDe(casoId);
      if (ctx.hechos.some((h) => h.dimension_id === m.sintoma)) continue; // ya hay evidencia: se acumula, no se duplica
      X.agregarHecho(db, P, casoId, { dimension_id: m.sintoma, slot: 'mencion', estado: 'valor', valor: 'si', fuente, origen: 'mencion_espontanea', evidencia: m.evidencia, respuesta_id: respuestaId, pregunta_id: preguntaId });
      reg.push(m);
    }
    if (reg.length) X.registrarDecision(db, casoId, turno, 'evidencia_relacionada_detectada', { fuente, menciones: reg, regla: 'Etapa 9 §14.2: activación inmediata de caracterización, sin confirmar el síntoma por asociación.' });
    return reg;
  }

  async function interpretar(q, r, iaPermitida = true) {
    let res;
    try { res = interpretarRespuesta(q, r); } catch (e) { if (e instanceof ErrorEntrada) throw new ErrorServicio(400, e.message); throw e; }
    let errorIA = null; let interprete = 'reglas';
    const textoLibre = r.texto && !r.opcion && !r.opciones && !r.tipo;
    if (ia?.habilitada && iaPermitida && textoLibre && ['presencia', 'opciones'].includes(q.tipo)) {
      try {
        const s = await ia.interpretarRespuesta({ pregunta: q, texto: r.texto, protocolo: P });
        if (s.codigo) { res = interpretarRespuesta(q, { opcion: s.codigo, texto: r.texto }); interprete = 'ia'; }
      } catch (e) { errorIA = { mensaje: e.message, detalle: e.detalle }; }
    }
    return { res, interprete: errorIA ? 'reglas (contingencia)' : interprete, errorIA };
  }

  // ------------------------------------------------------------ API ---
  const api = {
    protocolo: P,

    crearCaso({ etiqueta, consentimiento } = {}) {
      let cons;
      try { cons = validarConsentimiento(consentimiento); } catch (e) { if (e instanceof ErrorConsentimiento) throw new ErrorServicio(400, e.message); throw e; }
      return transaccion(db, () => {
        const c = X.crearCaso(db, P, { etiqueta: String(etiqueta || '').trim().slice(0, 80) || null });
        const cid = X.registrarConsentimiento(db, c.id, cons);
        X.registrarDecision(db, c.id, 0, 'consentimiento_registrado', { id: cid, tipo: cons.tipo, relacion: cons.relacion, medio: cons.medio, profesional: cons.profesional, acepta_ia_externa: cons.acepta_ia_externa, version_politica: cons.version_politica });
        X.registrarDecision(db, c.id, 0, 'caso_creado', { codigo: c.codigo, protocolo: P.version, fuentes: P.fuentes });
        avanzar(c.id);
        return api.vista(c.id);
      });
    },

    listarCasos: () => X.listarCasos(db),

    vista(casoId) {
      const ctx = ctxDe(casoId);
      const ini = faseInicialCompleta(ctx);
      const req = evaluarRequisitos(ctx);
      const informes = db.prepare('SELECT id, tipo, estado, generado, validado_por, validado FROM informes WHERE caso_id = ? ORDER BY id').all(casoId);
      const I = ini ? integrar(ctx) : null;
      return {
        caso: ctx.caso, estado: resumenEstado(ctx), ruta_justificacion: ruta(ctx) ? justificacionRuta(ctx) : null,
        iniciales: Object.fromEntries(['motivo', 'edad', 'informe_existe', 'informe_disponible'].map((s) => [s, estadoSlot(ctx, 'INI', s)])),
        etapa_evolutiva: etapaEvolutiva(ctx),
        sintomas: ini ? evaluarSintomas(ctx) : [],
        barrido: ini ? estadoBarrido(ctx) : null, tamizaje: ini ? estadoTamizaje(ctx) : null,
        integracion: I && { puerta: I.puerta, resultado: I.resultado, requisitos: Object.fromEntries(Object.entries(I.requisitos).map(([k, v]) => [k, { nombre: v.nombre, estado: v.estado }])), areas: I.areas.map(({ id, nombre, estado }) => ({ id, nombre, estado })) },
        hechos: ctx.hechos, contradicciones: ctx.contradicciones, informes_escolares: ctx.informesEscolares,
        evaluaciones: ctx.evaluaciones, instrumentos: P.instrumentos, requisitos: req, informes,
        consentimientos: ctx.consentimientos, ia_externa_autorizada: permiteIAExterna(ctx), version_politica: VERSION_POLITICA,
        colegio: ini ? api.colegioPendiente(casoId, ctx) : null,
        nna: ini ? api.nnaEstado(casoId, ctx) : null,
        flujo: flujo(ctx, req, informes),
      };
    },

    async responder(casoId, { pregunta_id, opcion, opciones, texto = '', tipo } = {}) {
      const ctx0 = ctxDe(casoId);
      const actual = ctx0.caso.pregunta_actual;
      if (!actual) throw new ErrorServicio(409, 'No hay una pregunta pendiente en este caso.', { estado_global: ctx0.caso.estado_global });
      if (pregunta_id !== actual.id) {
        X.registrarDecision(db, casoId, ctx0.caso.turno, 'respuesta_rechazada', { recibida: pregunta_id, esperada: actual.id });
        throw new ErrorServicio(409, `La respuesta corresponde a ${pregunta_id}, pero la pregunta vigente es ${actual.id}.`, { pregunta_actual: actual });
      }
      texto = String(texto ?? '').slice(0, 4000);
      const q = P.preguntas.get(actual.id);
      const { res, interprete, errorIA } = await interpretar(q, { opcion, opciones, texto, tipo }, permiteIAExterna(ctx0));

      return transaccion(db, () => {
        const ctx = ctxDe(casoId);
        if (ctx.caso.turno !== actual.turno) throw new ErrorServicio(409, 'El caso cambió mientras se procesaba la respuesta; recargue.');
        const antes = resumenEstado(ctx);
        if (errorIA) {
          X.registrarError(db, casoId, 'api_ia', errorIA.mensaje, errorIA.detalle);
          X.registrarDecision(db, casoId, actual.turno, 'error_api_ia', { mensaje: errorIA.mensaje, accion: 'Se usó el intérprete de reglas (contingencia).' });
        }
        const original = texto || (res.codigos || [res.codigo || opcion]).filter(Boolean).map((c) => `${c}. ${q.opciones?.find((o) => o.codigo === c)?.texto ?? ''}`).join('; ') || tipo || '';
        const respuestaId = X.registrarRespuesta(db, casoId, actual.turno, {
          pregunta_id: q.id, texto_original: original, tipo_declarado: tipo || (opcion ? `opcion:${opcion}` : opciones ? `opciones:${opciones.join(',')}` : null),
          clasificacion: res.clasificacion, valor: res.valor, interprete, detalle: null,
        });
        X.marcarRespondida(db, casoId, actual.turno);
        const { contradiccion } = X.agregarHecho(db, P, casoId, {
          dimension_id: q.objetivo[0], slot: q.objetivo[1], estado: res.estado, valor: res.valor, fuente: 'apoderado', origen: 'respuesta',
          evidencia: original, respuesta_id: respuestaId, pregunta_id: q.id, categorico: q.tipo !== 'abierta',
        });
        X.registrarDecision(db, casoId, actual.turno, 'respuesta_registrada', {
          pregunta_id: q.id, texto_original: original, clasificacion: res.clasificacion, estado_dato: res.estado, valor: res.valor, interprete,
        });
        if (contradiccion) X.registrarDecision(db, casoId, actual.turno, 'contradiccion_registrada', contradiccion);
        const menciones = texto ? registrarMenciones(casoId, texto, 'apoderado', respuestaId, q.id, actual.turno, q.sintoma) : [];
        const discrepancias = detectarDiscrepancias(casoId, actual.turno);
        const resultado = avanzar(casoId);
        const ctxF = ctxDe(casoId);
        return {
          traza: {
            entrada: { pregunta_id: q.id, pregunta: q.texto, respuesta: original, opcion: opcion || null, opciones: opciones || null },
            interpretacion: { clasificacion: res.clasificacion, estado_dato: res.estado, valor: res.valor, interprete, menciones },
            estado_antes: antes,
            decision_motor: resultado.accion === 'preguntar' ? { accion: 'preguntar', pregunta_id: resultado.pregunta.id, justificacion: resultado.pregunta.justificacion } : resultado,
            pregunta_resultante: resultado.pregunta?.texto ?? null,
            estado_despues: resumenEstado(ctxF),
            contradiccion: contradiccion || discrepancias[0] || null,
            error_api: errorIA?.mensaje || null,
          },
          vista: api.vista(casoId),
        };
      });
    },

    async cargarInformeEscolar(casoId, { texto = '', hechos } = {}) {
      const ctx0 = ctxDe(casoId);
      if (!String(texto).trim() && !hechos) throw new ErrorServicio(400, 'Debe enviar el texto del informe o una extracción estructurada.');
      let extraidos; let metodo; let errorIA = null;
      if (hechos) {
        try { extraidos = validarExtraccionManual(P, hechos); } catch (e) { throw new ErrorServicio(400, e.message); }
        metodo = 'estructurada_manual';
      } else if (ia?.habilitada && permiteIAExterna(ctx0)) {
        try { extraidos = await ia.extraerInformeEscolar({ texto, protocolo: P }); metodo = 'ia'; } catch (e) { errorIA = e; }
      }
      if (!extraidos) { extraidos = extraerPorReglas(P, texto); metodo = errorIA ? 'reglas (contingencia)' : 'reglas'; }
      return transaccion(db, () => {
        if (errorIA) X.registrarError(db, casoId, 'api_ia', errorIA.message, errorIA.detalle);
        db.prepare('INSERT INTO informes_escolares (caso_id, texto, extraccion, metodo, creado) VALUES (?, ?, ?, ?, ?)')
          .run(casoId, String(texto || '(extracción estructurada)'), JSON.stringify(extraidos), metodo, ahora());
        for (const h of extraidos) {
          X.agregarHecho(db, P, casoId, { ...h, estado: 'valor', fuente: 'informe_escolar', origen: 'extraccion', categorico: h.slot !== 'desde' });
        }
        const disc = detectarDiscrepancias(casoId, ctx0.caso.turno);
        X.registrarDecision(db, casoId, ctx0.caso.turno, 'informe_escolar_cargado', { metodo, hechos: extraidos.length, sintomas: [...new Set(extraidos.map((h) => h.dimension_id))], discrepancias: disc.length });
        const resultado = revalidarActual(casoId);
        return { extraidos, metodo, contradicciones: disc, resultado, vista: api.vista(casoId) };
      });
    },

    cambiarRuta(casoId, { ruta: nueva, motivo }) {
      if (!['con_informe', 'completa'].includes(nueva)) throw new ErrorServicio(400, 'Ruta no válida.');
      if (!motivo?.trim()) throw new ErrorServicio(400, 'Debe indicar el motivo del cambio de ruta.');
      const ctx = ctxDe(casoId);
      if (!faseInicialCompleta(ctx)) throw new ErrorServicio(409, 'La ruta solo puede cambiarse después de la fase inicial.');
      return transaccion(db, () => {
        X.actualizarCaso(db, casoId, { ruta_forzada: nueva, ruta_motivo: motivo.trim() });
        X.registrarDecision(db, casoId, ctx.caso.turno, 'ruta_modificada', { de: ruta(ctx), a: nueva, motivo: motivo.trim() });
        const resultado = revalidarActual(casoId);
        return { resultado, vista: api.vista(casoId) };
      });
    },

    // ---------------------------- colegio: preguntas de complementación (Anexo 7-C) ---
    colegioPendiente(casoId, ctx = ctxDe(casoId)) {
      const cob = cobertura(ctx);
      const r = ruta(ctx);
      return P.colegio.map((q) => {
        const st = estadoSlot(ctx, 'COL', q.id);
        const cubierta = informeCargado(ctx) && q.cubierta_por && cob[q.cubierta_por];
        return { ...vistaPregunta(q), respondida: st.estado !== 'sin_dato', respuesta: st.estado === 'valor' ? st.valor : null, cubierta_por_informe: !!cubierta,
          enviar: !cubierta && st.estado === 'sin_dato' && (r === 'con_informe' ? informeCargado(ctx) : true) };
      });
    },

    responderColegio(casoId, { respuestas }) {
      if (!Array.isArray(respuestas) || !respuestas.length) throw new ErrorServicio(400, 'Envíe un arreglo «respuestas» con {pregunta_id, texto}.');
      const ctx = ctxDe(casoId);
      return transaccion(db, () => {
        for (const r of respuestas) {
          const q = P.preguntas.get(r.pregunta_id);
          if (!q || q.grupo !== 'colegio') throw new ErrorServicio(400, `Pregunta de colegio no válida: ${r.pregunta_id}`);
          const texto = String(r.texto ?? '').trim();
          if (!texto) continue;
          if (ctx.preguntas.length === 0) { /* sin efecto */ }
          const res = interpretarRespuesta(q, { texto });
          const rid = X.registrarRespuesta(db, casoId, ctx.caso.turno, { pregunta_id: q.id, texto_original: texto, clasificacion: res.clasificacion, valor: res.valor, interprete: 'reglas' });
          X.agregarHecho(db, P, casoId, { dimension_id: 'COL', slot: q.id, estado: res.estado, valor: res.valor, fuente: 'profesor', origen: 'respuesta', evidencia: texto, respuesta_id: rid, pregunta_id: q.id });
          registrarMenciones(casoId, texto, 'profesor', rid, q.id, ctx.caso.turno);
        }
        X.registrarDecision(db, casoId, ctx.caso.turno, 'complementacion_colegio', { preguntas: respuestas.map((r) => r.pregunta_id) });
        detectarDiscrepancias(casoId, ctx.caso.turno);
        revalidarActual(casoId);
        return api.vista(casoId);
      });
    },

    // ---------------------------- entrevista al niño/niña o adolescente (Anexo 7-D/E) ---
    nnaEstado(casoId, ctx = ctxDe(casoId)) {
      const e = edad(ctx);
      if (e == null) return null;
      const banco = e >= 12 ? P.adolescente : P.nino;
      const fuente = e >= 12 ? 'adolescente' : 'nino';
      const cerrada = estadoSlot(ctx, 'NNA', 'cerrada').estado === 'valor';
      const respondidas = banco.filter((q) => estadoSlot(ctx, 'NNA', q.id).estado !== 'sin_dato');
      // Prioridad: preguntas sobre áreas con candidatos positivos primero (no se recorre por orden numérico, Etapa 9 §D).
      const positivos = evaluarSintomas(ctx).filter((s) => s.positivo).map((s) => s.dominio);
      const peso = (q) => (/(espera|interrump|quieto|inquietud|controlar)/i.test(q.texto) && positivos.includes('hiperactividad_impulsividad') ? 0
        : /(concentr|distra|recordar|organiz|empiezas|comenzar)/i.test(q.texto) && positivos.includes('inatencion') ? 0 : 1);
      const pendientes = banco.filter((q) => !respondidas.includes(q)).sort((a, b) => peso(a) - peso(b));
      return { fuente, banco: banco.length, respondidas: respondidas.length, cerrada, asentimiento: tieneAsentimiento(ctx), siguiente: cerrada || !pendientes.length ? null : vistaPregunta(P.preguntas.get(pendientes[0].id)) };
    },

    responderNNA(casoId, { pregunta_id, texto = '', omitir = false, finalizar = false, asentimiento } = {}) {
      const ctx = ctxDe(casoId);
      const st = api.nnaEstado(casoId, ctx);
      if (!st) throw new ErrorServicio(409, 'Primero debe registrarse la edad.');
      if (st.cerrada) throw new ErrorServicio(409, 'La entrevista del niño/adolescente ya fue finalizada.');
      if (asentimiento) {
        let a;
        try { a = validarAsentimiento(asentimiento); } catch (e) { throw new ErrorServicio(400, e.message); }
        return transaccion(db, () => {
          const id = X.registrarConsentimiento(db, casoId, a);
          X.registrarDecision(db, casoId, ctx.caso.turno, 'asentimiento_nna_registrado', { id, profesional: a.profesional, medio: a.medio });
          return api.vista(casoId);
        });
      }
      if (!finalizar && !st.asentimiento) throw new ErrorServicio(409, 'Registre primero el asentimiento del niño, niña o adolescente (derecho a ser informado y oído).');
      return transaccion(db, () => {
        if (finalizar) {
          X.agregarHecho(db, P, casoId, { dimension_id: 'NNA', slot: 'cerrada', estado: 'valor', valor: 'si', fuente: st.fuente, origen: 'registro_manual' });
          X.registrarDecision(db, casoId, ctx.caso.turno, 'entrevista_nna_finalizada', { respondidas: st.respondidas });
          return api.vista(casoId);
        }
        if (!st.siguiente || pregunta_id !== st.siguiente.id) throw new ErrorServicio(409, `La pregunta vigente es ${st.siguiente?.id ?? 'ninguna'}.`);
        const q = P.preguntas.get(pregunta_id);
        const t = String(texto).trim();
        if (!omitir && !t) throw new ErrorServicio(400, 'La respuesta está vacía.');
        const res = omitir ? { clasificacion: 'no_informado', estado: 'no_informado', valor: null } : interpretarRespuesta(q, { texto: t });
        const rid = X.registrarRespuesta(db, casoId, ctx.caso.turno, { pregunta_id: q.id, texto_original: t || '(omitida)', clasificacion: res.clasificacion, valor: res.valor, interprete: 'reglas' });
        X.agregarHecho(db, P, casoId, { dimension_id: 'NNA', slot: q.id, estado: res.estado, valor: res.valor, fuente: st.fuente, origen: 'respuesta', evidencia: t, respuesta_id: rid, pregunta_id: q.id });
        if (t) registrarMenciones(casoId, t, st.fuente, rid, q.id, ctx.caso.turno);
        X.registrarDecision(db, casoId, ctx.caso.turno, 'respuesta_nna', { pregunta_id: q.id, omitida: omitir });
        return api.vista(casoId);
      });
    },

    registrarEvaluacion(casoId, { instrumento_id, estado, fecha, aplicador, resultados, observaciones }) {
      const ctx = ctxDe(casoId);
      if (!P.instrumentosPorId.has(instrumento_id)) throw new ErrorServicio(400, `Instrumento no contemplado en el protocolo: ${instrumento_id}`);
      if (!['pendiente', 'realizada', 'no_aplica'].includes(estado)) throw new ErrorServicio(400, 'Estado no válido.');
      if (estado === 'realizada' && !fecha) throw new ErrorServicio(400, 'Una evaluación realizada requiere fecha.');
      if (estado === 'no_aplica' && !observaciones?.trim()) throw new ErrorServicio(400, '«No aplica» requiere justificación en observaciones.');
      if (resultados != null && typeof resultados !== 'object') throw new ErrorServicio(400, 'Los resultados deben ser un objeto.');
      return transaccion(db, () => {
        db.prepare(`INSERT INTO evaluaciones (caso_id, instrumento_id, estado, fecha, aplicador, resultados, observaciones, actualizado)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(caso_id, instrumento_id) DO UPDATE SET estado = excluded.estado, fecha = excluded.fecha,
                    aplicador = excluded.aplicador, resultados = excluded.resultados, observaciones = excluded.observaciones, actualizado = excluded.actualizado`)
          .run(casoId, instrumento_id, estado, fecha ?? null, aplicador ?? null, resultados ? JSON.stringify(resultados) : null, observaciones ?? null, ahora());
        X.registrarDecision(db, casoId, ctx.caso.turno, 'evaluacion_registrada', { instrumento_id, estado, fecha });
        return api.vista(casoId);
      });
    },

    revisarContradiccion(casoId, contradiccionId, { nota, profesional }) {
      const ctx = ctxDe(casoId);
      const c = ctx.contradicciones.find((x) => x.id === Number(contradiccionId));
      if (!c) throw new ErrorServicio(404, 'Contradicción no encontrada.');
      if (!nota?.trim() || !profesional?.trim()) throw new ErrorServicio(400, 'La revisión requiere nota y profesional responsable.');
      return transaccion(db, () => {
        db.prepare("UPDATE contradicciones SET estado = 'revisada', nota_revision = ?, revisado_por = ?, revisado = ? WHERE id = ?").run(nota.trim(), profesional.trim(), ahora(), c.id);
        X.registrarDecision(db, casoId, ctx.caso.turno, 'contradiccion_revisada', { id: c.id, profesional, nota });
        return api.vista(casoId);
      });
    },

    guardarInterpretacion(casoId, { texto, profesional }) {
      const ctx = ctxDe(casoId);
      if (!texto?.trim() || !profesional?.trim()) throw new ErrorServicio(400, 'Se requiere el texto y el profesional responsable.');
      return transaccion(db, () => {
        X.actualizarCaso(db, casoId, { interpretacion: texto.trim(), interpretacion_profesional: profesional.trim(), interpretacion_fecha: ahora() });
        X.registrarDecision(db, casoId, ctx.caso.turno, 'decision_profesional_registrada', { profesional });
        return api.vista(casoId);
      });
    },

    informe(casoId) {
      const ctx = ctxDe(casoId);
      const requisitos = evaluarRequisitos(ctx);
      const md = generarInforme(ctx, { tipo: 'borrador', requisitos });
      return { tipo: 'borrador', requisitos, markdown: md, html: markdownAHtml(md) };
    },

    generarInformeFinal(casoId) {
      const ctx = ctxDe(casoId);
      const requisitos = evaluarRequisitos(ctx);
      if (!requisitos.completo) {
        X.registrarDecision(db, casoId, ctx.caso.turno, 'informe_final_bloqueado', { faltantes: requisitos.requisitos.filter((r) => !r.cumplido) });
        throw new ErrorServicio(409, 'Evaluación pendiente: no se puede generar el informe final.', requisitos);
      }
      return transaccion(db, () => {
        const md = generarInforme(ctx, { tipo: 'final', requisitos });
        const r = db.prepare(`INSERT INTO informes (caso_id, tipo, estado, contenido_md, requisitos, generado) VALUES (?, 'final', 'pendiente_validacion', ?, ?, ?)`).run(casoId, md, JSON.stringify(requisitos), ahora());
        X.actualizarCaso(db, casoId, { estado_global: 'informe_final' });
        X.registrarDecision(db, casoId, ctx.caso.turno, 'informe_final_generado', { informe_id: Number(r.lastInsertRowid) });
        return { id: Number(r.lastInsertRowid), estado: 'pendiente_validacion', markdown: md, html: markdownAHtml(md) };
      });
    },

    validarInforme(casoId, informeId, { profesional }) {
      const ctx = ctxDe(casoId);
      if (!profesional?.trim()) throw new ErrorServicio(400, 'Debe indicar el profesional que valida.');
      const inf = db.prepare('SELECT * FROM informes WHERE id = ? AND caso_id = ?').get(Number(informeId), casoId);
      if (!inf) throw new ErrorServicio(404, 'Informe no encontrado.');
      const requisitos = evaluarRequisitos(ctx);
      if (!requisitos.completo) throw new ErrorServicio(409, 'El expediente cambió y ya no cumple los requisitos; genere un nuevo informe.', requisitos);
      return transaccion(db, () => {
        const fecha = ahora();
        const md = generarInforme(ctx, { tipo: 'final', requisitos, validacion: { por: profesional.trim(), fecha } });
        db.prepare("UPDATE informes SET estado = 'validado', validado_por = ?, validado = ?, contenido_md = ? WHERE id = ?").run(profesional.trim(), fecha, md, inf.id);
        X.actualizarCaso(db, casoId, { estado_global: 'validado' });
        X.registrarDecision(db, casoId, ctx.caso.turno, 'informe_validado', { informe_id: inf.id, profesional });
        return { id: inf.id, estado: 'validado', markdown: md, html: markdownAHtml(md) };
      });
    },

    obtenerInformeFinal(casoId, informeId) {
      const inf = db.prepare('SELECT * FROM informes WHERE id = ? AND caso_id = ?').get(Number(informeId), casoId);
      if (!inf) throw new ErrorServicio(404, 'Informe no encontrado.');
      return { ...inf, requisitos: JSON.parse(inf.requisitos), html: markdownAHtml(inf.contenido_md) };
    },

    proponerPregunta(casoId, { pregunta_id, texto, origen = 'externo' }) {
      const ctx = ctxDe(casoId);
      const ctxSin = { ...ctx, preguntas: ctx.preguntas.filter((p) => p.turno !== ctx.caso.turno) };
      const v = validarPregunta(ctxSin, { pregunta_id, texto, origen });
      X.registrarDecision(db, casoId, ctx.caso.turno, v.ok ? 'propuesta_valida' : 'propuesta_bloqueada', { pregunta_id: pregunta_id ?? null, texto, origen, reglas: v.reglas });
      return { ok: v.ok, reglas: v.reglas, pregunta_vigente: ctx.caso.pregunta_actual,
        mensaje: v.ok ? 'La pregunta es válida, pero la selección corresponde al motor; la pregunta vigente se mantiene.' : 'Pregunta descartada por el validador; el motor mantiene su alternativa autorizada.' };
    },

    /** Derecho de acceso y portabilidad (Ley 19.628/21.719): copia íntegra del expediente en formato estructurado. */
    exportar(casoId, { solicitante = 'no indicado' } = {}) {
      const ctx = ctxDe(casoId);
      X.registrarDecision(db, casoId, ctx.caso.turno, 'expediente_exportado', { solicitante: String(solicitante).slice(0, 120) });
      return {
        formato: 'tdah-expediente/1', generado: ahora(), protocolo: { id: P.id, version: P.version }, version_politica: VERSION_POLITICA,
        caso: ctx.caso, consentimientos: ctx.consentimientos, hechos: ctx.hechos, contradicciones: ctx.contradicciones,
        informes_escolares: ctx.informesEscolares, evaluaciones: ctx.evaluaciones,
        informes: db.prepare('SELECT * FROM informes WHERE caso_id = ? ORDER BY id').all(casoId),
        ...api.auditoria(casoId),
      };
    },

    auditoria(casoId) {
      ctxDe(casoId);
      return {
        decisiones: X.decisiones(db, casoId), errores: X.errores(db, casoId),
        preguntas: db.prepare('SELECT * FROM preguntas WHERE caso_id = ? ORDER BY id').all(casoId), respuestas: X.respuestas(db, casoId),
      };
    },
  };
  return api;
}

function flujo(ctx, req, informes) {
  const r = ruta(ctx);
  const get = (id) => req.requisitos.find((x) => x.id === id);
  const hechas = ctx.evaluaciones.filter((e) => e.estado === 'realizada').map((e) => e.instrumento_id);
  return [
    { etapa: 'Entrevista inicial y antecedentes', estado: get('entrevista_apoderado_cerrada').cumplido ? 'completa' : faseInicialCompleta(ctx) ? 'en_curso' : 'fase_inicial' },
    { etapa: 'Informe escolar', estado: r === 'completa' ? 'no_aplica' : ctx.informesEscolares.length ? 'incorporado' : r ? 'pendiente' : '—' },
    { etapa: 'Instrumentos del protocolo', estado: hechas.length ? `${hechas.length} registrados` : 'ninguno registrado' },
    { etapa: 'Realidad virtual y Nesplora', estado: ['RV', 'NESPLORA'].filter((i) => hechas.includes(i)).join(', ') || 'no registrados' },
    { etapa: 'Integración multidimensional', estado: get('entrevista_apoderado_cerrada').cumplido && get('informe_escolar_segun_ruta').cumplido ? 'disponible' : 'pendiente' },
    { etapa: 'Alternativas y contradicciones', estado: !faseInicialCompleta(ctx) ? '—' : get('contradicciones_revisadas').cumplido ? (ctx.contradicciones.length ? 'revisado' : 'sin discrepancias') : 'pendiente' },
    { etapa: 'Informe estructurado', estado: informes.length ? 'generado' : req.completo ? 'listo para generar' : 'bloqueado' },
    { etapa: 'Validación profesional', estado: informes.some((i) => i.estado === 'validado') ? 'validado' : 'pendiente' },
  ];
}

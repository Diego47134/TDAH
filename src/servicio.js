// Backend de control del flujo de evaluación. Orquesta motor, validador, intérprete,
// persistencia y auditoría. El software (no la IA) controla estado y transiciones.
import * as X from './expediente.js';
import { transaccion, ahora } from './db.js';
import { siguientePaso, ruta, justificacionRuta, resumenEstado, estadoSlot, faseInicialCompleta, evaluarTodas } from './motor.js';
import { validarPregunta } from './validador.js';
import { interpretarReglas, detectarMenciones, TIPOS_DECLARADOS } from './interprete.js';
import { extraerPorReglas, validarExtraccionManual } from './informeEscolar.js';
import { evaluarRequisitos, generarInforme, markdownAHtml } from './informe.js';

export class ErrorServicio extends Error {
  constructor(status, mensaje, detalle) { super(mensaje); this.status = status; this.detalle = detalle; }
}

export function crearServicio({ db, protocolo, ia }) {
  const ctxDe = (id) => {
    const c = X.contexto(db, protocolo, id);
    if (!c) throw new ErrorServicio(404, 'Caso no encontrado');
    return c;
  };

  // ------------------------------------------------------------ motor ---

  /** Ejecuta el ciclo de decisión y persiste la pregunta seleccionada (o el cierre). */
  function avanzar(casoId) {
    let ctx = ctxDe(casoId);
    const r = ruta(ctx);
    if (r && r !== ctx.caso.ruta) {
      X.actualizarCaso(db, casoId, { ruta: r });
      X.registrarDecision(db, casoId, ctx.caso.turno, 'ruta_determinada', { ruta: r, justificacion: justificacionRuta(ctx) });
      ctx = ctxDe(casoId);
    }
    const paso = siguientePaso(ctx);
    if (paso.bloqueadas.length) {
      X.registrarDecision(db, casoId, ctx.caso.turno, 'preguntas_bloqueadas', { bloqueadas: paso.bloqueadas });
    }
    if (paso.accion === 'preguntar') {
      const q = paso.pregunta;
      const turno = ctx.caso.turno + 1;
      X.registrarPregunta(db, casoId, turno, q, paso.justificacion);
      const actual = {
        id: q.id, texto: q.texto, dimension_id: q.dimension_id, slot: q.slot,
        tipo_dato: protocolo.slots[q.slot].tipo, etiqueta_dato: protocolo.slots[q.slot].etiqueta,
        dimension: q.dimension_id === 'INI' ? 'Datos iniciales' : protocolo.dimensionesPorId.get(q.dimension_id).nombre,
        justificacion: paso.justificacion, turno,
      };
      X.actualizarCaso(db, casoId, { turno, pregunta_actual: actual, estado_global: faseInicialCompleta(ctx) ? 'entrevista' : 'fase_inicial' });
      X.registrarDecision(db, casoId, turno, 'pregunta_seleccionada', {
        pregunta_id: q.id, dimension_id: q.dimension_id, slot: q.slot, justificacion: paso.justificacion,
        validacion: paso.validacion.reglas, estado: resumenEstado(ctx),
      });
      return { accion: 'preguntar', pregunta: actual };
    }
    const estadoPost = ['informe_final', 'validado'].includes(ctx.caso.estado_global) ? ctx.caso.estado_global : null;
    if (paso.accion === 'esperar_informe') {
      X.actualizarCaso(db, casoId, { pregunta_actual: null, estado_global: estadoPost || 'esperando_informe_escolar' });
      X.registrarDecision(db, casoId, ctx.caso.turno, 'espera_informe_escolar', { pendientes: paso.pendientes, justificacion: paso.justificacion });
    } else if (paso.accion === 'cerrar') {
      X.actualizarCaso(db, casoId, { pregunta_actual: null, estado_global: estadoPost || 'entrevista_completa' });
      X.registrarDecision(db, casoId, ctx.caso.turno, 'entrevista_cerrada', { justificacion: paso.justificacion });
    } else {
      X.actualizarCaso(db, casoId, { pregunta_actual: null });
      X.registrarError(db, casoId, 'motor', 'Sin pregunta autorizada para dimensiones obligatorias pendientes', paso);
      X.registrarDecision(db, casoId, ctx.caso.turno, 'sin_alternativa_autorizada', { pendientes: paso.pendientes });
    }
    return { accion: paso.accion, pendientes: paso.pendientes, justificacion: paso.justificacion };
  }

  /** Tras incorporar datos externos, retira la pregunta actual si dejó de ser válida y recalcula. */
  function revalidarActual(casoId) {
    const ctx = ctxDe(casoId);
    const actual = ctx.caso.pregunta_actual;
    if (!actual) return avanzar(casoId);
    const ctxSin = { ...ctx, preguntas: ctx.preguntas.filter((p) => p.turno !== ctx.caso.turno) };
    const v = validarPregunta(ctxSin, { pregunta_id: actual.id, texto: actual.texto, origen: 'motor' });
    if (v.ok) return { accion: 'preguntar', pregunta: actual };
    X.retirarPregunta(db, casoId, ctx.caso.turno);
    X.registrarDecision(db, casoId, ctx.caso.turno, 'pregunta_retirada', {
      pregunta_id: actual.id, motivos: v.reglas.filter((x) => !x.ok).map((x) => `${x.regla}: ${x.detalle}`),
    });
    X.actualizarCaso(db, casoId, { pregunta_actual: null });
    return avanzar(casoId);
  }

  // --------------------------------------------------------- interpretación ---

  async function interpretar(casoId, q, texto, tipo) {
    const slotTipo = protocolo.slots[q.slot].tipo;
    const base = { slotTipo, texto, invertida: !!q.invertida };
    if (tipo && !TIPOS_DECLARADOS.includes(tipo)) throw new ErrorServicio(400, `Tipo de respuesta no válido: ${tipo}`);
    let res = interpretarReglas({ ...base, tipoDeclarado: tipo });
    let menciones = texto ? detectarMenciones(protocolo, texto) : [];
    let errorIA = null;
    if (ia?.habilitada && !tipo && texto) {
      try {
        const s = await ia.interpretarRespuesta({ pregunta: q, slotTipo, texto, protocolo });
        const declarado = TIPOS_DECLARADOS.includes(s.clasificacion) ? s.clasificacion : undefined;
        if (s.clasificacion === 'ambiguo') res = { clasificacion: 'ambiguo', estado: 'ambiguo', valor: null };
        else if (s.clasificacion === 'valor') res = interpretarReglas({ ...base, texto: String(s.valor ?? texto) });
        else res = interpretarReglas({ ...base, tipoDeclarado: declarado });
        res.interprete = 'ia';
        for (const m of s.menciones) if (!menciones.some((x) => x.dimension_id === m.dimension_id)) menciones.push(m);
      } catch (e) {
        errorIA = { mensaje: e.message, detalle: e.detalle };
      }
    }
    return { res, menciones, errorIA };
  }

  // ------------------------------------------------------------ API ---

  return {
    protocolo,

    crearCaso({ etiqueta } = {}) {
      return transaccion(db, () => {
        const c = X.crearCaso(db, protocolo, { etiqueta: String(etiqueta || '').trim().slice(0, 80) || null });
        X.registrarDecision(db, c.id, 0, 'caso_creado', { codigo: c.codigo, protocolo: protocolo.version });
        avanzar(c.id);
        return this.vista(c.id);
      });
    },

    listarCasos: () => X.listarCasos(db),

    vista(casoId) {
      const ctx = ctxDe(casoId);
      const dims = faseInicialCompleta(ctx) ? evaluarTodas(ctx) : [];
      const req = evaluarRequisitos(ctx);
      const informes = db.prepare('SELECT id, tipo, estado, generado, validado_por, validado FROM informes WHERE caso_id = ? ORDER BY id').all(casoId);
      return {
        caso: ctx.caso,
        estado: resumenEstado(ctx),
        ruta_justificacion: ruta(ctx) ? justificacionRuta(ctx) : null,
        iniciales: Object.fromEntries(['motivo', 'edad', 'informe_existe', 'informe_disponible'].map((s) => [s, estadoSlot(ctx, 'INI', s)])),
        dimensiones: dims,
        hechos: ctx.hechos,
        contradicciones: ctx.contradicciones,
        informes_escolares: ctx.informesEscolares,
        evaluaciones: ctx.evaluaciones,
        instrumentos: protocolo.instrumentos,
        requisitos: req,
        informes,
        flujo: flujo(ctx, dims, req, informes),
      };
    },

    async responder(casoId, { pregunta_id, texto = '', tipo } = {}) {
      const ctx0 = ctxDe(casoId);
      const actual = ctx0.caso.pregunta_actual;
      if (!actual) throw new ErrorServicio(409, 'No hay una pregunta pendiente en este caso.', { estado_global: ctx0.caso.estado_global });
      if (pregunta_id !== actual.id) {
        X.registrarDecision(db, casoId, ctx0.caso.turno, 'respuesta_rechazada', { recibida: pregunta_id, esperada: actual.id });
        throw new ErrorServicio(409, `La respuesta corresponde a ${pregunta_id}, pero la pregunta vigente es ${actual.id}.`, { pregunta_actual: actual });
      }
      texto = String(texto ?? '').slice(0, 4000);
      if (!texto.trim() && !tipo) throw new ErrorServicio(400, 'La respuesta está vacía.');
      const q = protocolo.preguntasPorId.get(actual.id);
      const { res, menciones, errorIA } = await interpretar(casoId, q, texto, tipo);

      return transaccion(db, () => {
        const ctx = ctxDe(casoId);
        if (ctx.caso.turno !== actual.turno) throw new ErrorServicio(409, 'El caso cambió mientras se procesaba la respuesta; recargue.');
        const estadoAntes = resumenEstado(ctx);
        if (errorIA) {
          X.registrarError(db, casoId, 'api_ia', errorIA.mensaje, errorIA.detalle);
          X.registrarDecision(db, casoId, actual.turno, 'error_api_ia', { mensaje: errorIA.mensaje, accion: 'Se usó el intérprete de reglas (contingencia).' });
        }
        const respuestaId = X.registrarRespuesta(db, casoId, actual.turno, {
          pregunta_id: q.id, texto_original: texto, tipo_declarado: tipo, clasificacion: res.clasificacion,
          valor: res.valor, interprete: errorIA ? 'reglas (contingencia)' : res.interprete, detalle: { menciones },
        });
        X.marcarRespondida(db, casoId, actual.turno);
        const { contradiccion } = X.agregarHecho(db, protocolo, casoId, {
          dimension_id: q.dimension_id, slot: q.slot, estado: res.estado, valor: res.valor,
          fuente: 'apoderado', origen: 'respuesta', evidencia: texto || tipo, respuesta_id: respuestaId, pregunta_id: q.id,
        });
        X.registrarDecision(db, casoId, actual.turno, 'respuesta_registrada', {
          pregunta_id: q.id, texto_original: texto, tipo_declarado: tipo || null, clasificacion: res.clasificacion,
          estado_dato: res.estado, valor: res.valor, interprete: errorIA ? 'reglas (contingencia)' : res.interprete,
        });
        if (contradiccion) X.registrarDecision(db, casoId, actual.turno, 'contradiccion_registrada', contradiccion);

        const registradas = [];
        for (const m of menciones) {
          if (m.dimension_id === q.dimension_id) continue;
          const ctxM = ctxDe(casoId);
          if (estadoSlot(ctxM, m.dimension_id, 'presencia').estado !== 'sin_dato') continue;
          X.agregarHecho(db, protocolo, casoId, {
            dimension_id: m.dimension_id, slot: 'presencia', estado: 'valor', valor: 'si',
            fuente: 'apoderado', origen: 'mencion_espontanea', evidencia: m.evidencia, respuesta_id: respuestaId, pregunta_id: q.id,
          });
          registradas.push(m);
        }
        if (registradas.length) X.registrarDecision(db, casoId, actual.turno, 'mencion_detectada', { menciones: registradas });

        const resultado = avanzar(casoId);
        const ctxF = ctxDe(casoId);
        return {
          traza: {
            entrada: { pregunta_id: q.id, pregunta: q.texto, texto, tipo: tipo || null },
            interpretacion: { clasificacion: res.clasificacion, estado_dato: res.estado, valor: res.valor, interprete: errorIA ? 'reglas (contingencia)' : res.interprete, menciones: registradas },
            estado_antes: estadoAntes,
            decision_motor: resultado.accion === 'preguntar'
              ? { accion: 'preguntar', pregunta_id: resultado.pregunta.id, justificacion: resultado.pregunta.justificacion }
              : resultado,
            pregunta_resultante: resultado.pregunta?.texto ?? null,
            estado_despues: resumenEstado(ctxF),
            contradiccion: contradiccion || null,
            error_api: errorIA?.mensaje || null,
          },
          vista: this.vista(casoId),
        };
      });
    },

    async cargarInformeEscolar(casoId, { texto = '', hechos } = {}) {
      const ctx0 = ctxDe(casoId);
      if (!String(texto).trim() && !hechos) throw new ErrorServicio(400, 'Debe enviar el texto del informe o una extracción estructurada.');
      let extraidos; let metodo; let errorIA = null;
      if (hechos) {
        try { extraidos = validarExtraccionManual(protocolo, hechos); } catch (e) { throw new ErrorServicio(400, e.message); }
        metodo = 'estructurada_manual';
      } else if (ia?.habilitada) {
        try { extraidos = await ia.extraerInformeEscolar({ texto, protocolo }); metodo = 'ia'; } catch (e) { errorIA = e; }
      }
      if (!extraidos) { extraidos = extraerPorReglas(protocolo, texto); metodo = errorIA ? 'reglas (contingencia)' : 'reglas'; }

      return transaccion(db, () => {
        if (errorIA) X.registrarError(db, casoId, 'api_ia', errorIA.message, errorIA.detalle);
        db.prepare('INSERT INTO informes_escolares (caso_id, texto, extraccion, metodo, creado) VALUES (?, ?, ?, ?, ?)')
          .run(casoId, String(texto || '(extracción estructurada)'), JSON.stringify(extraidos), metodo, ahora());
        const contrs = [];
        for (const h of extraidos) {
          const { contradiccion } = X.agregarHecho(db, protocolo, casoId, {
            dimension_id: h.dimension_id, slot: h.slot, estado: 'valor', valor: h.valor,
            fuente: 'informe_escolar', origen: 'extraccion', evidencia: h.evidencia,
          });
          if (contradiccion) { contrs.push(contradiccion); X.registrarDecision(db, casoId, ctx0.caso.turno, 'contradiccion_registrada', contradiccion); }
        }
        X.registrarDecision(db, casoId, ctx0.caso.turno, 'informe_escolar_cargado', {
          metodo, hechos: extraidos.length, dimensiones: [...new Set(extraidos.map((h) => h.dimension_id))], contradicciones: contrs.length,
        });
        const resultado = revalidarActual(casoId);
        return { extraidos, metodo, contradicciones: contrs, resultado, vista: this.vista(casoId) };
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
        return { resultado, vista: this.vista(casoId) };
      });
    },

    registrarEvaluacion(casoId, { instrumento_id, estado, fecha, aplicador, resultados, observaciones }) {
      const ctx = ctxDe(casoId);
      if (!protocolo.instrumentosPorId.has(instrumento_id)) throw new ErrorServicio(400, `Instrumento no contemplado en el protocolo: ${instrumento_id}`);
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
        return this.vista(casoId);
      });
    },

    revisarContradiccion(casoId, contradiccionId, { nota, profesional }) {
      const ctx = ctxDe(casoId);
      const c = ctx.contradicciones.find((x) => x.id === Number(contradiccionId));
      if (!c) throw new ErrorServicio(404, 'Contradicción no encontrada.');
      if (!nota?.trim() || !profesional?.trim()) throw new ErrorServicio(400, 'La revisión requiere nota y profesional responsable.');
      return transaccion(db, () => {
        db.prepare("UPDATE contradicciones SET estado = 'revisada', nota_revision = ?, revisado_por = ?, revisado = ? WHERE id = ?")
          .run(nota.trim(), profesional.trim(), ahora(), c.id);
        X.registrarDecision(db, casoId, ctx.caso.turno, 'contradiccion_revisada', { id: c.id, profesional, nota });
        return this.vista(casoId);
      });
    },

    guardarInterpretacion(casoId, { texto, profesional }) {
      const ctx = ctxDe(casoId);
      if (!texto?.trim() || !profesional?.trim()) throw new ErrorServicio(400, 'Se requiere el texto y el profesional responsable.');
      return transaccion(db, () => {
        X.actualizarCaso(db, casoId, { interpretacion: texto.trim(), interpretacion_profesional: profesional.trim(), interpretacion_fecha: ahora() });
        X.registrarDecision(db, casoId, ctx.caso.turno, 'interpretacion_registrada', { profesional });
        return this.vista(casoId);
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
        const r = db.prepare(`INSERT INTO informes (caso_id, tipo, estado, contenido_md, requisitos, generado) VALUES (?, 'final', 'pendiente_validacion', ?, ?, ?)`)
          .run(casoId, md, JSON.stringify(requisitos), ahora());
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
        db.prepare("UPDATE informes SET estado = 'validado', validado_por = ?, validado = ?, contenido_md = ? WHERE id = ?")
          .run(profesional.trim(), fecha, md, inf.id);
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

    /** Una pregunta propuesta desde fuera del motor (p. ej. por la IA) pasa por el validador. */
    proponerPregunta(casoId, { pregunta_id, texto, origen = 'externo' }) {
      const ctx = ctxDe(casoId);
      const ctxSin = { ...ctx, preguntas: ctx.preguntas.filter((p) => p.turno !== ctx.caso.turno) };
      const v = validarPregunta(ctxSin, { pregunta_id, texto, origen });
      X.registrarDecision(db, casoId, ctx.caso.turno, v.ok ? 'propuesta_valida' : 'propuesta_bloqueada', {
        pregunta_id: pregunta_id ?? null, texto, origen, reglas: v.reglas,
      });
      return { ok: v.ok, reglas: v.reglas, pregunta_vigente: ctx.caso.pregunta_actual,
        mensaje: v.ok ? 'La pregunta es válida, pero la selección corresponde al motor; la pregunta vigente se mantiene.' : 'Pregunta bloqueada por el validador; el motor mantiene su alternativa autorizada.' };
    },

    auditoria(casoId) {
      ctxDe(casoId);
      return {
        decisiones: X.decisiones(db, casoId),
        errores: X.errores(db, casoId),
        preguntas: db.prepare('SELECT * FROM preguntas WHERE caso_id = ? ORDER BY id').all(casoId),
        respuestas: X.respuestas(db, casoId),
      };
    },
  };
}

function flujo(ctx, dims, req, informes) {
  const r = ruta(ctx);
  const get = (id) => req.requisitos.find((x) => x.id === id);
  const instrOblig = ctx.protocolo.instrumentos.filter((i) => i.obligatorio);
  const hechas = (lista) => lista.filter((i) => ctx.evaluaciones.some((e) => e.instrumento_id === i.id && e.estado !== 'pendiente')).length;
  const objetivos = ctx.protocolo.instrumentos.filter((i) => i.objetivo);
  return [
    { etapa: 'Entrevista inicial y antecedentes', estado: get('entrevista_cerrada').cumplido ? 'completa' : faseInicialCompleta(ctx) ? 'en_curso' : 'fase_inicial' },
    { etapa: 'Informe escolar', estado: r === 'completa' ? 'no_aplica' : ctx.informesEscolares.length ? 'incorporado' : 'pendiente' },
    { etapa: 'Instrumentos del protocolo', estado: `${hechas(instrOblig)}/${instrOblig.length} obligatorios` },
    { etapa: 'Realidad virtual y Nesplora', estado: `${hechas(objetivos)}/${objetivos.length} registrados` },
    { etapa: 'Integración multidimensional', estado: get('entrevista_cerrada').cumplido && get('informe_escolar_segun_ruta').cumplido && get('instrumentos_obligatorios').cumplido ? 'disponible' : 'pendiente' },
    { etapa: 'Explicaciones alternativas y contradicciones', estado: get('tamizaje_completo').cumplido && get('contradicciones_revisadas').cumplido ? 'revisado' : 'pendiente' },
    { etapa: 'Informe estructurado', estado: informes.length ? 'generado' : req.completo ? 'listo para generar' : 'bloqueado' },
    { etapa: 'Validación profesional', estado: informes.some((i) => i.estado === 'validado') ? 'validado' : 'pendiente' },
  ];
}

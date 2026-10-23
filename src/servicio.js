import crypto from 'node:crypto';
// Backend de control del flujo de evaluación. Orquesta motor, validador, intérprete,
// persistencia y auditoría. El software controla estado y transiciones.
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
import { crearBuscador, ErrorBusqueda, SUGERIDAS, FUENTES, validarConsulta } from './bibliografia.js';
import { crearConsultas } from './consultas.js';
import { CLASES, MAX_BYTES, ErrorDocumento, carpetaDocumentos, extraerTexto, guardarArchivo, leerArchivo } from './documentos.js';
import { esquemaPara, verificarExtraccion } from './extraccion.js';
import { seudonimizar, nombresDelCaso } from './anonimizar.js';
import { VARIABLES_RV, validarMetricas } from './rv.js';
import { validarConsentimiento, validarAsentimiento, tieneAsentimiento, permiteIA, ErrorConsentimiento, VERSION_POLITICA } from './privacidad.js';

export class ErrorServicio extends Error {
  constructor(status, mensaje, detalle) { super(mensaje); this.status = status; this.detalle = detalle; }
}

const vistaPregunta = (q, extra = {}) => ({
  id: q.id, texto: q.texto, tipo: q.tipo, grupo: q.grupo, fase: q.fase, origen: q.origen,
  opciones: (q.opciones || []).map(({ codigo, texto, excluyente, incierta, edad_min }) => ({ codigo, texto, excluyente: !!excluyente, incierta: !!incierta, edad_min })),
  objetivo: q.objetivo, ...extra,
});

export function crearServicio({ db, protocolo, buscador = crearBuscador(), ia = { habilitada: false }, carpetaDocs = carpetaDocumentos(null) }) {
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

  async function interpretar(q, r, ctx) {
    let res;
    try { res = interpretarRespuesta(q, r); } catch (e) { if (e instanceof ErrorEntrada) throw new ErrorServicio(400, e.message); throw e; }
    let errorIA = null; let interprete = 'reglas';
    const textoLibre = r.texto && !r.opcion && !r.opciones && !r.tipo;
    if (ia?.habilitada && permiteIA(ctx) && textoLibre && ['presencia', 'opciones'].includes(q.tipo)) {
      try {
        const s = await ia.interpretarRespuesta({ pregunta: q, texto: seudonimizar(r.texto, nombresDelCaso(ctx)) });
        if (s.codigo) { res = interpretarRespuesta(q, { opcion: s.codigo, texto: r.texto }); interprete = 'ia'; }
      } catch (e) { errorIA = { mensaje: e.message, detalle: e.detalle }; }
    }
    return { res, interprete: errorIA ? 'reglas (contingencia)' : interprete, errorIA };
  }

  /** Incorpora hechos del informe escolar (por reglas, IA verificada o carga manual). */
  function incorporarInformeEscolar(casoId, { texto, extraidos, metodo, documento = null, datos = [], puntajes = [] }) {
    const ctx0 = ctxDe(casoId);
    return transaccion(db, () => {
      db.prepare('INSERT INTO informes_escolares (caso_id, texto, extraccion, metodo, creado) VALUES (?, ?, ?, ?, ?)')
        .run(casoId, String(texto || '(extracción estructurada)'), JSON.stringify({ hechos: extraidos, documento, datos, puntajes }), metodo, ahora());
      for (const h of extraidos) {
        X.agregarHecho(db, P, casoId, { ...h, estado: 'valor', fuente: 'informe_escolar', origen: documento ? `extraccion:${documento.clase}` : 'extraccion', categorico: h.slot !== 'desde' });
      }
      for (const d of datos) {
        X.agregarHecho(db, P, casoId, { dimension_id: 'INF', slot: d.dato, estado: 'valor', valor: d.dato === 'impacto_academico' ? 'si' : d.valor, fuente: 'informe_escolar', origen: documento ? `extraccion:${documento.clase}` : 'extraccion', evidencia: d.evidencia });
      }
      const disc = detectarDiscrepancias(casoId, ctx0.caso.turno);
      X.registrarDecision(db, casoId, ctx0.caso.turno, 'informe_escolar_cargado', { metodo, clase: documento?.clase || null, instrumento: documento?.instrumento || null, hechos: extraidos.length, datos: datos.length, puntajes: puntajes.length, sintomas: [...new Set(extraidos.map((h) => h.dimension_id))], discrepancias: disc.length });
      const resultado = revalidarActual(casoId);
      return { extraidos, metodo, documento, contradicciones: disc, resultado, vista: api.vista(casoId) };
    });
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
        X.registrarDecision(db, c.id, 0, 'consentimiento_registrado', { id: cid, tipo: cons.tipo, relacion: cons.relacion, medio: cons.medio, profesional: cons.profesional, version_politica: cons.version_politica });
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
        consentimientos: ctx.consentimientos, version_politica: VERSION_POLITICA, referencias: ctx.referencias, consultas: ctx.consultas,
        documentos: ctx.documentos, clases_documento: CLASES, ia: { habilitada: Boolean(ia?.habilitada), autorizada: permiteIA(ctx), proveedor: ia?.nombre || null, pais: ia?.pais || null },
        rv_sesiones: db.prepare('SELECT * FROM rv_sesiones WHERE caso_id = ? ORDER BY creado').all(casoId).map((s) => ({ ...s, metricas: JSON.parse(s.metricas) })),
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
      const { res, interprete, errorIA } = await interpretar(q, { opcion, opciones, texto, tipo }, ctx0);

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
          pregunta_id: q.id, texto_original: original, clasificacion: res.clasificacion, estado_dato: res.estado, valor: res.valor,
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
            error_api: errorIA?.mensaje || null,
            contradiccion: contradiccion || discrepancias[0] || null,
          },
          vista: api.vista(casoId),
        };
      });
    },

    async cargarInformeEscolar(casoId, { texto = '', hechos } = {}) {
      const ctx0 = ctxDe(casoId);
      if (!String(texto).trim() && !hechos) throw new ErrorServicio(400, 'Debe enviar el texto del informe o una extracción estructurada.');
      if (hechos) {
        let extraidos;
        try { extraidos = validarExtraccionManual(P, hechos); } catch (e) { throw new ErrorServicio(400, e.message); }
        return incorporarInformeEscolar(casoId, { texto, extraidos, metodo: 'estructurada_manual' });
      }
      return incorporarInformeEscolar(casoId, { texto, extraidos: extraerPorReglas(P, texto), metodo: 'reglas' });
    },

    // ---------------------------------------------------- documentos adjuntos ---
    async subirDocumento(casoId, { nombre, contenido_base64, clase = 'otro', ocultar = [], profesional } = {}) {
      const ctx = ctxDe(casoId);
      if (!CLASES[clase]) throw new ErrorServicio(400, 'Tipo de documento no válido.');
      if (!String(nombre || '').trim() || !contenido_base64) throw new ErrorServicio(400, 'Adjunte un archivo.');
      const buf = Buffer.from(String(contenido_base64), 'base64');
      if (!buf.length) throw new ErrorServicio(400, 'El archivo está vacío.');
      if (buf.length > MAX_BYTES) throw new ErrorServicio(413, 'El archivo supera los 15 MB.');
      let ext;
      try { ext = await extraerTexto(buf, nombre); } catch (e) { if (e instanceof ErrorDocumento) throw new ErrorServicio(e.status, e.message); throw e; }
      const guardado = guardarArchivo(carpetaDocs, casoId, nombre, buf, db.cifrador);
      const texto = seudonimizar(ext.texto, nombresDelCaso(ctx, Array.isArray(ocultar) ? ocultar : String(ocultar).split(',')));
      const usarIA = ia?.habilitada && permiteIA(ctx) && ['entrevista_apoderado', 'informe_escolar', 'informe_rv'].includes(clase) && !ext.advertencia;
      let verif = null; let metodo = 'sin_extraccion'; let detalle = ext.advertencia; let errorIA = null;
      if (usarIA) {
        try {
          const salida = await ia.extraerDocumento({ tipo: clase, texto: texto.slice(0, 60000), esquema: esquemaPara(P, clase) });
          verif = verificarExtraccion(P, clase, salida, texto); metodo = 'ia';
        } catch (e) { errorIA = e; }
      }
      if (!verif && clase === 'informe_escolar' && !ext.advertencia) {
        verif = { documento: { clase: 'informe_general' }, respuestas: [], hechos: extraerPorReglas(P, texto), datos: [], puntajes: [], rv: { variables: [], limitaciones: [] }, descartados: [] };
        metodo = errorIA ? 'reglas (contingencia)' : 'reglas';
      }
      if (!verif && !detalle) {
        detalle = clase === 'entrevista_apoderado' || clase === 'informe_rv'
          ? (errorIA ? `No fue posible procesar el documento con IA (${errorIA.message}); quedó guardado para revisión manual.` : 'Documento guardado. Para extraer sus datos automáticamente se requiere IA habilitada y autorizada en el consentimiento.')
          : 'Documento guardado.';
      }
      let aplicado = { respuestas: 0, hechos: 0, rv: 0 };
      const docId = transaccion(db, () => {
        if (errorIA) X.registrarError(db, casoId, 'api_ia', errorIA.message, errorIA.detalle);
        const r = db.prepare(`INSERT INTO documentos (caso_id, clase, nombre, tipo_mime, bytes, sha256, archivo, texto, metodo, extraccion, estado, detalle, profesional, creado)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(casoId, clase, String(nombre).slice(0, 200), ext.tipo_mime, guardado.bytes, guardado.sha256, guardado.archivo, texto, metodo,
            verif ? JSON.stringify({ ...verif, respuestas: verif.respuestas.map((x) => ({ pregunta_id: x.q.id, valor: x.res.valor, estado: x.res.estado, evidencia: x.evidencia })) }) : null,
            verif ? 'procesado' : 'guardado', detalle || null, String(profesional || '').slice(0, 120) || null, ahora());
        const id = Number(r.lastInsertRowid);
        if (verif && clase === 'entrevista_apoderado') {
          const t = ctxDe(casoId).caso.turno;
          for (const { q, res, evidencia } of verif.respuestas) {
            if (X.hechos(db, casoId).some((h) => h.dimension_id === q.objetivo[0] && h.slot === q.objetivo[1] && h.fuente === 'apoderado')) continue; // no sobrescribe lo ya respondido
            const rid = X.registrarRespuesta(db, casoId, t, { pregunta_id: q.id, texto_original: evidencia, tipo_declarado: 'documento', clasificacion: res.clasificacion, valor: res.valor, interprete: 'ia-documento' });
            X.agregarHecho(db, P, casoId, { dimension_id: q.objetivo[0], slot: q.objetivo[1], estado: res.estado, valor: res.valor, fuente: 'apoderado', origen: 'documento', evidencia, respuesta_id: rid, pregunta_id: q.id, categorico: q.tipo !== 'abierta' });
            aplicado.respuestas++;
          }
          for (const d of verif.datos) X.agregarHecho(db, P, casoId, { dimension_id: 'DOC', slot: d.dato, estado: 'valor', valor: d.valor, fuente: 'apoderado', origen: 'documento', evidencia: d.evidencia });
          detectarDiscrepancias(casoId, t);
        }
        if (verif && clase === 'informe_rv' && verif.rv.variables.length) {
          const inst = /nesplora|aula/i.test(verif.documento.instrumento || '') ? 'NESPLORA' : 'RV';
          db.prepare(`INSERT INTO evaluaciones (caso_id, instrumento_id, estado, fecha, aplicador, resultados, observaciones, actualizado) VALUES (?, ?, 'realizada', ?, ?, ?, ?, ?)
                      ON CONFLICT(caso_id, instrumento_id) DO UPDATE SET estado = 'realizada', fecha = excluded.fecha, resultados = excluded.resultados, observaciones = excluded.observaciones, actualizado = excluded.actualizado`)
            .run(casoId, inst, verif.documento.fecha || ahora().slice(0, 10), verif.documento.autor || null,
              JSON.stringify({ variables: verif.rv.variables, limitaciones: verif.rv.limitaciones, documento: verif.documento, documento_id: id }),
              `Extraído del documento «${String(nombre).slice(0, 80)}»${verif.rv.limitaciones.length ? `. Limitaciones: ${verif.rv.limitaciones.join('; ')}` : ''}`, ahora());
          aplicado.rv = verif.rv.variables.length;
        }
        X.registrarDecision(db, casoId, ctxDe(casoId).caso.turno, 'documento_subido', { id, clase, metodo, sha256: guardado.sha256, descartados: verif?.descartados.length || 0, aplicado });
        return id;
      });
      let resultado = null;
      if (verif && clase === 'informe_escolar') {
        resultado = incorporarInformeEscolar(casoId, { texto, extraidos: verif.hechos, metodo, documento: verif.documento, datos: verif.datos, puntajes: verif.puntajes });
        aplicado.hechos = verif.hechos.length;
      } else if (verif && clase === 'entrevista_apoderado') {
        transaccion(db, () => revalidarActual(casoId));
      }
      return { id: docId, metodo, detalle, aplicado, descartados: verif?.descartados || [], documento: verif?.documento || null, vista: resultado?.vista || api.vista(casoId) };
    },

    descargarDocumento(casoId, docId) {
      ctxDe(casoId);
      const d = db.prepare('SELECT * FROM documentos WHERE id = ? AND caso_id = ?').get(Number(docId), casoId);
      if (!d) throw new ErrorServicio(404, 'Documento no encontrado.');
      return { nombre: d.nombre, tipo_mime: d.tipo_mime, contenido: leerArchivo(carpetaDocs, d.archivo, db.cifrador) };
    },

    // ---------------------------------- realidad virtual en tiempo real (casco) ---
    idPorCodigo(codigo) {
      const c = db.prepare('SELECT id FROM casos WHERE codigo = ?').get(String(codigo || '').trim().toUpperCase());
      if (!c) throw new ErrorServicio(404, 'Caso no encontrado (indique caso_id o caso_codigo, p. ej. CASO-0001).');
      return c.id;
    },

    rvIniciar(casoId, { dispositivo, tarea } = {}) {
      const ctx = ctxDe(casoId);
      const id = crypto.randomUUID();
      const t = ahora();
      db.prepare("INSERT INTO rv_sesiones (id, caso_id, estado, dispositivo, tarea, metricas, eventos, creado, actualizado) VALUES (?, ?, 'en_curso', ?, ?, '{}', 0, ?, ?)")
        .run(id, casoId, String(dispositivo || '').slice(0, 80) || null, String(tarea || '').slice(0, 80) || null, t, t);
      X.registrarDecision(db, casoId, ctx.caso.turno, 'rv_sesion_iniciada', { sesion: id, dispositivo: dispositivo || null, tarea: tarea || null });
      return { sesion_id: id, variables: VARIABLES_RV };
    },

    rvDatos(sesionId, { metricas = {}, eventos = 0 } = {}) {
      const s = db.prepare('SELECT * FROM rv_sesiones WHERE id = ?').get(String(sesionId));
      if (!s) throw new ErrorServicio(404, 'Sesión de realidad virtual no encontrada.');
      if (s.estado !== 'en_curso') throw new ErrorServicio(409, 'La sesión ya terminó.');
      let m;
      try { m = validarMetricas(metricas); } catch (e) { throw new ErrorServicio(400, e.message); }
      const actual = { ...JSON.parse(s.metricas), ...m };
      db.prepare('UPDATE rv_sesiones SET metricas = ?, eventos = eventos + ?, actualizado = ? WHERE id = ?').run(JSON.stringify(actual), Math.max(0, Number(eventos) || 0), ahora(), s.id);
      return { ok: true, metricas: actual };
    },

    rvFinalizar(sesionId, { limitaciones = [], profesional } = {}) {
      const s = db.prepare('SELECT * FROM rv_sesiones WHERE id = ?').get(String(sesionId));
      if (!s) throw new ErrorServicio(404, 'Sesión de realidad virtual no encontrada.');
      if (s.estado !== 'en_curso') throw new ErrorServicio(409, 'La sesión ya terminó.');
      const met = JSON.parse(s.metricas);
      const variables = Object.entries(met).map(([k, v]) => ({ variable: VARIABLES_RV.find((x) => x.id === k)?.nombre || k, id: k, resultado: v.valor != null ? `${v.valor}${v.unidad ? ` ${v.unidad}` : ''}` : '', interpretacion_del_documento: v.interpretacion || '', percentil: v.percentil ?? null }));
      return transaccion(db, () => {
        db.prepare("UPDATE rv_sesiones SET estado = 'finalizada', actualizado = ? WHERE id = ?").run(ahora(), s.id);
        db.prepare(`INSERT INTO evaluaciones (caso_id, instrumento_id, estado, fecha, aplicador, resultados, observaciones, actualizado) VALUES (?, 'RV', 'realizada', ?, ?, ?, ?, ?)
                    ON CONFLICT(caso_id, instrumento_id) DO UPDATE SET estado = 'realizada', fecha = excluded.fecha, aplicador = excluded.aplicador, resultados = excluded.resultados, observaciones = excluded.observaciones, actualizado = excluded.actualizado`)
          .run(s.caso_id, ahora().slice(0, 10), String(profesional || '').slice(0, 120) || null,
            JSON.stringify({ variables, limitaciones: (Array.isArray(limitaciones) ? limitaciones : []).map(String), sesion_id: s.id, dispositivo: s.dispositivo, tarea: s.tarea, eventos: s.eventos }),
            `Sesión de realidad virtual en tiempo real (${s.dispositivo || 'casco'}${s.tarea ? `, tarea ${s.tarea}` : ''}).`, ahora());
        X.registrarDecision(db, s.caso_id, ctxDe(s.caso_id).caso.turno, 'rv_sesion_finalizada', { sesion: s.id, variables: variables.length, eventos: s.eventos });
        return api.vista(s.caso_id);
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

    // ------------------------ búsqueda bibliográfica en internet (Europe PMC / PubMed) ---
    bibliografiaSugerencias: () => ({ sugeridas: SUGERIDAS, fuentes: Object.entries(FUENTES).map(([id, f]) => ({ id, nombre: f.nombre })) }),

    async buscarBibliografia({ consulta, fuente = 'europepmc', cantidad = 10 } = {}) {
      let q;
      try { q = validarConsulta(consulta); } catch (e) { throw new ErrorServicio(e.status || 400, e.message); }
      const desde = new Date(Date.now() - 7 * 864e5).toISOString();
      const cache = db.prepare('SELECT * FROM busquedas_bibliograficas WHERE fuente = ? AND lower(consulta) = lower(?) AND creado >= ? ORDER BY id DESC LIMIT 1').get(fuente, q, desde);
      const n = Math.min(Math.max(Number(cantidad) || 10, 1), 25);
      if (cache) {
        const res = JSON.parse(cache.resultados);
        if (res.length >= n || res.length === cache.total) return { consulta: q, fuente, fuente_nombre: FUENTES[fuente]?.nombre, total: cache.total, resultados: res.slice(0, n), en_cache: true, fecha: cache.creado };
      }
      let r;
      try { r = await buscador.buscar({ consulta: q, fuente, cantidad: n }); } catch (e) {
        if (e instanceof ErrorBusqueda) { X.registrarError(db, null, 'bibliografia', e.message, { fuente }); throw new ErrorServicio(e.status, e.message); }
        throw e;
      }
      const fecha = ahora();
      db.prepare('INSERT INTO busquedas_bibliograficas (consulta, fuente, total, resultados, creado) VALUES (?, ?, ?, ?, ?)').run(q, fuente, r.total, JSON.stringify(r.resultados), fecha);
      return { ...r, en_cache: false, fecha };
    },

    /** Pregunta libre del profesional o del apoderado: responde con la app y, si no alcanza, busca sola en internet. */
    async preguntar({ pregunta, quien = 'profesional', caso_id, pregunta_id, buscar_en_web = false, palabras, comentario = false } = {}) {
      const ctxC = caso_id ? ctxDe(caso_id) : null;
      let r;
      if (comentario === true) {
        // Comentario libre: solo se registra para el profesional; no se responde ni sale a internet.
        const texto = String(pregunta ?? '').replace(/\s+/g, ' ').trim();
        if (texto.length < 3) throw new ErrorServicio(400, 'Escriba el comentario.');
        if (texto.length > 1000) throw new ErrorServicio(400, 'El comentario es demasiado largo (máximo 1000 caracteres).');
        r = { origen: 'comentario', respuestas: [], terminos_enviados: [], aviso: 'Comentario registrado. El profesional lo verá en la revisión del caso.' };
        return transaccion(db, () => {
          const id = Number(db.prepare('INSERT INTO consultas (caso_id, quien, pregunta, pregunta_id, origen, respuesta, creado) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(caso_id || null, quien, texto, pregunta_id || null, r.origen, JSON.stringify(r), ahora()).lastInsertRowid);
          if (caso_id) X.registrarDecision(db, caso_id, ctxC.caso.turno, quien === 'apoderado' ? 'comentario_apoderado' : 'comentario_profesional', { id });
          return { id, ...r };
        });
      }
      try {
        r = await consultas.responder({ pregunta, quien, pregunta_id, buscar_en_web: buscar_en_web === true, palabras,
          excluir: ctxC ? [...nombresDelCaso(ctxC), ctxC.caso.etiqueta || ''] : [] });
      } catch (e) { if (e.status) throw new ErrorServicio(e.status, e.message); throw e; }
      // Redacción en español a partir de las fuentes encontradas (sin agregar información).
      if (ia?.habilitada && (!ctxC || permiteIA(ctxC)) && ['app', 'internet'].includes(r.origen) && r.respuestas.length) {
        const fragmentos = r.respuestas.map((x, i) => ({ n: i + 1, texto: x.cita || `${x.titulo}: ${x.texto}`, fuente: x.articulo ? `${x.articulo.titulo} (${x.articulo.revista || ''} ${x.articulo.anio || ''})` : x.fuente }));
        try {
          const s = await ia.redactarRespuesta({ pregunta: seudonimizar(pregunta, ctxC ? nombresDelCaso(ctxC) : []), publico: quien, fragmentos });
          const citas = (Array.isArray(s.citas) ? s.citas : []).map(Number).filter((n) => n >= 1 && n <= fragmentos.length);
          if (typeof s.respuesta === 'string' && s.respuesta.trim() && s.suficiente !== false && citas.length) r = { ...r, redactada: s.respuesta.trim().slice(0, 2000), citas };
        } catch (e) { X.registrarError(db, caso_id || null, 'api_ia', e.message, e.detalle); }
      }
      return transaccion(db, () => {
        const id = Number(db.prepare('INSERT INTO consultas (caso_id, quien, pregunta, pregunta_id, origen, respuesta, creado) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(caso_id || null, quien, String(pregunta).trim().slice(0, 300), pregunta_id || null, r.origen, JSON.stringify(r), ahora()).lastInsertRowid);
        if (caso_id) {
          const t = ctxDe(caso_id).caso.turno;
          X.registrarDecision(db, caso_id, t, quien === 'apoderado' ? 'consulta_apoderado' : 'consulta_profesional', { id, origen: r.origen, terminos_enviados: r.terminos_enviados });
        }
        return { id, ...r };
      });
    },

    marcarConsultaAtendida(casoId, consultaId, { profesional } = {}) {
      const ctx = ctxDe(casoId);
      const r = db.prepare('UPDATE consultas SET atendida = ? WHERE id = ? AND caso_id = ?').run(ahora(), Number(consultaId), casoId);
      if (!r.changes) throw new ErrorServicio(404, 'Consulta no encontrada.');
      X.registrarDecision(db, casoId, ctx.caso.turno, 'consulta_atendida', { id: Number(consultaId), profesional: profesional || null });
      return api.vista(casoId);
    },

    agregarReferencia(casoId, { referencia_id, fuente, nota, profesional } = {}) {
      const ctx = ctxDe(casoId);
      if (!String(profesional ?? '').trim()) throw new ErrorServicio(400, 'Indique el profesional que agrega la referencia.');
      // Solo referencias obtenidas por una búsqueda real (no se aceptan citas escritas a mano).
      const filas = db.prepare('SELECT resultados FROM busquedas_bibliograficas WHERE fuente = ? ORDER BY id DESC LIMIT 200').all(fuente || 'europepmc');
      let ref = null;
      for (const f of filas) { ref = JSON.parse(f.resultados).find((x) => x.id === referencia_id); if (ref) break; }
      if (!ref) throw new ErrorServicio(404, 'La referencia no proviene de una búsqueda registrada; búsquela primero.');
      return transaccion(db, () => {
        const r = db.prepare('INSERT OR IGNORE INTO referencias_caso (caso_id, referencia, nota, profesional, creado) VALUES (?, ?, ?, ?, ?)')
          .run(casoId, JSON.stringify(ref), String(nota ?? '').trim().slice(0, 500) || null, String(profesional).trim().slice(0, 120), ahora());
        if (r.changes) X.registrarDecision(db, casoId, ctx.caso.turno, 'referencia_agregada', { referencia: ref.id, titulo: ref.titulo, profesional });
        return api.vista(casoId);
      });
    },

    quitarReferencia(casoId, refId, { profesional } = {}) {
      const ctx = ctxDe(casoId);
      const r = db.prepare('DELETE FROM referencias_caso WHERE id = ? AND caso_id = ?').run(Number(refId), casoId);
      if (!r.changes) throw new ErrorServicio(404, 'Referencia no encontrada.');
      X.registrarDecision(db, casoId, ctx.caso.turno, 'referencia_quitada', { id: Number(refId), profesional: profesional || null });
      return api.vista(casoId);
    },

    auditoria(casoId) {
      ctxDe(casoId);
      return {
        decisiones: X.decisiones(db, casoId), errores: X.errores(db, casoId),
        preguntas: db.prepare('SELECT * FROM preguntas WHERE caso_id = ? ORDER BY id').all(casoId), respuestas: X.respuestas(db, casoId),
      };
    },
  };
  const consultas = crearConsultas(P, { buscarInternet: (a) => api.buscarBibliografia(a) });
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

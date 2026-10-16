// Extracción verificada de documentos con IA. Todo dato debe venir con una frase que exista
// literalmente en el documento; lo que no se puede verificar se descarta y queda registrado.
import { interpretarRespuesta } from './interprete.js';

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
export const DATOS_VALIDOS = ['impacto_academico', 'impacto_social', 'apoyos', 'respuesta_apoyos', 'inicio', 'trayectoria', 'desarrollo', 'sueno', 'medico', 'sensorial', 'emocional', 'familiar', 'autonomia'];
export const CLASES_DOC = ['entrevista_apoderado', 'escala_estandarizada', 'observacion_narrativa', 'informe_general', 'informe_rv', 'otro'];

/** Esquema que se entrega a la IA: preguntas autorizadas y síntomas. */
export function esquemaPara(P, tipo) {
  const sintomas = P.sintomas.map((s) => ({ id: s.id, nombre: s.nombre }));
  const frecuencia = (P.alternativas.frecuencia || []).map((o) => o.valor);
  if (tipo !== 'entrevista_apoderado') return { sintomas, frecuencia, datos: DATOS_VALIDOS };
  const grupos = ['inicio', 'sintoma', 'banco', 'profundizacion', 'barrido', 'rama_barrido', 'tamizaje', 'rama_tamizaje', 'ruta_a'];
  const preguntas = [...P.preguntas.values()].filter((q) => grupos.includes(q.grupo))
    .map((q) => ({ id: q.id, texto: q.texto, tipo: q.tipo, alternativas: (q.opciones || []).map((o) => `${o.codigo}=${o.texto}`) }));
  return { preguntas, sintomas, frecuencia, datos: DATOS_VALIDOS };
}

/** Verifica la salida de la IA contra el documento y el protocolo. */
export function verificarExtraccion(P, tipo, salida, texto) {
  const doc = norm(texto);
  const literal = (e) => typeof e === 'string' && e.trim().length >= 4 && doc.includes(norm(e));
  const descartados = [];
  const ok = (cond, item, motivo) => { if (!cond) descartados.push({ item, motivo }); return cond; };
  const meta = salida?.documento || {};
  const documento = {
    clase: CLASES_DOC.includes(meta.clase) ? meta.clase : (tipo === 'informe_rv' ? 'informe_rv' : tipo === 'entrevista_apoderado' ? 'entrevista_apoderado' : 'informe_general'),
    instrumento: meta.instrumento ? String(meta.instrumento).slice(0, 120) : null,
    autor: meta.autor ? String(meta.autor).slice(0, 120) : null,
    fecha: meta.fecha ? String(meta.fecha).slice(0, 60) : null,
    condiciones: meta.condiciones ? String(meta.condiciones).slice(0, 400) : null,
  };

  const respuestas = [];
  if (tipo === 'entrevista_apoderado') {
    for (const r of salida?.respuestas || []) {
      const q = P.preguntas.get(r?.pregunta_id);
      if (!ok(q, r, 'pregunta inexistente') || !ok(literal(r.evidencia), r, 'evidencia no literal')) continue;
      let res;
      try {
        if (q.tipo === 'abierta' || q.tipo === 'numero') res = interpretarRespuesta(q, { texto: r.evidencia });
        else if (q.tipo === 'multiple') res = interpretarRespuesta(q, { opciones: Array.isArray(r.codigos) ? r.codigos : [r.codigo] });
        else res = interpretarRespuesta(q, { opcion: r.codigo });
      } catch (e) { ok(false, r, `alternativa no válida: ${e.message}`); continue; }
      respuestas.push({ q, res, evidencia: r.evidencia.trim() });
    }
  }

  const hechos = [];
  if (tipo === 'informe_escolar') {
    const frec = new Set((P.alternativas.frecuencia || []).map((o) => o.valor));
    for (const s of salida?.sintomas || []) {
      if (!ok(P.sintomasPorId.has(s?.sintoma), s, 'síntoma inexistente') || !ok(literal(s.evidencia), s, 'evidencia no literal')) continue;
      if (!ok(['si', 'no', 'ocasionalmente', 'no_sabe'].includes(s.presencia), s, 'presencia no válida')) continue;
      if (s.presencia === 'no_sabe') continue;
      hechos.push({ dimension_id: s.sintoma, slot: 'presencia:informe', valor: s.presencia, evidencia: s.evidencia.trim() });
      if (s.frecuencia && frec.has(s.frecuencia) && s.presencia !== 'no') hechos.push({ dimension_id: s.sintoma, slot: 'frecuencia', valor: s.frecuencia, evidencia: s.evidencia.trim() });
    }
  }
  const datos = [];
  for (const d of salida?.datos || []) {
    if (!ok(DATOS_VALIDOS.includes(d?.dato), d, 'dato no válido') || !ok(literal(d.evidencia), d, 'evidencia no literal')) continue;
    datos.push({ dato: d.dato, valor: String(d.valor ?? '').slice(0, 300), evidencia: d.evidencia.trim() });
  }
  const puntajes = [];
  for (const p of salida?.puntajes || []) {
    if (!ok(literal(p?.evidencia), p, 'evidencia no literal')) continue;
    puntajes.push({ escala: String(p.escala ?? '').slice(0, 80), subescala: String(p.subescala ?? '').slice(0, 80), puntaje: String(p.puntaje ?? '').slice(0, 40),
      interpretacion_del_documento: String(p.interpretacion_del_documento ?? '').slice(0, 200), evidencia: p.evidencia.trim() });
  }
  const rv = { variables: [], limitaciones: [] };
  for (const v of salida?.rv?.variables || []) {
    if (!ok(literal(v?.evidencia), v, 'evidencia no literal')) continue;
    rv.variables.push({ variable: String(v.variable ?? '').slice(0, 80), resultado: String(v.resultado ?? '').slice(0, 120),
      interpretacion_del_documento: String(v.interpretacion_del_documento ?? '').slice(0, 200), evidencia: v.evidencia.trim() });
  }
  for (const l of salida?.rv?.limitaciones || []) if (typeof l === 'string' && l.trim()) rv.limitaciones.push(l.trim().slice(0, 300));
  return { documento, respuestas, hechos, datos, puntajes, rv, descartados };
}

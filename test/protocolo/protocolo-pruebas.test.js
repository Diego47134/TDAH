// PROTOCOLO FORMAL DE PRUEBAS — Sistema de Evaluación TDAH
//
// Cada caso declara: datos de entrada, resultado esperado (con la regla del proyecto que lo
// exige), resultado obtenido y veredicto (APROBADA / FALLIDA). Usa los documentos reales del
// proyecto (informe del colegio .docx e informe Nesplora Aula .pdf entregados por el cliente) y
// el servidor HTTP real con una base temporal. No modifica código del sistema.
//
// Ejecutar:  npm run test:protocolo   (forma parte también de `npm test`)
// Resultados: docs/evidencia/protocolo/RESULTADOS.md y resultados.json (con PROTOCOLO=1 o EVIDENCIA=1)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { iniciarApp, crearCaso, vista, responder, entrevistar, rutaDBTemporal } from '../e2e/ayudantes.js';
import { respuestaPorDefecto } from '../fixtures/caso-ficticio.js';
import { cargarProtocolo } from '../../src/protocolo.js';

const P = cargarProtocolo();
const DOC = (n) => fs.readFileSync(new URL(`../fixtures/documentos/${n}`, import.meta.url));
const COLEGIO = DOC('informe-colegio-ejemplo.docx');   // «Informe del Colegio (prueba).docx» del cliente
const NESPLORA = DOC('nesplora-aula-ejemplo.pdf');     // «Inform Nesplora para Diego.pdf» del cliente
// Síntomas que el informe real del colegio describe (lectura verificada en I0).
const SINT_COLEGIO = ['R1.1', 'R1.2', 'R1.4', 'R1.5', 'R1.8', 'R1.9', 'R2.1', 'R2.2', 'R2.8', 'R2.9'];
const BANCO_SINTOMA = new Map([...P.preguntas.values()].filter((q) => q.grupo === 'sintoma').map((q) => [q.id, q.sintoma]));

const RESULTADOS = [];
after(() => escribir());

/** Registra un caso del protocolo y falla la prueba si el obtenido no coincide con el esperado. */
function caso(id, escenario, titulo, fn) {
  test(`${id} · ${titulo}`, async () => {
    const r = { id, escenario, titulo, entrada: '', esperado: '', regla: '', obtenido: '', veredicto: 'FALLIDA' };
    RESULTADOS.push(r);
    try {
      const out = await fn(r);
      r.veredicto = out ? 'APROBADA' : 'FALLIDA';
    } catch (e) {
      r.obtenido = r.obtenido || `Error: ${e.message}`;
      r.veredicto = 'FALLIDA';
    }
    assert.equal(r.veredicto, 'APROBADA', `${id}: ${r.obtenido}`);
  });
}

/**
 * Guion del apoderado. `sintomas`: { 'R1.1': 'A'|'B'|'C'|'D' } (Sí/No/Ocasionalmente/No sabe).
 * Las preguntas que no están en el guion reciben la respuesta neutra por defecto.
 */
function guion({ existe = 'A', disp = 'A', sintomas = {}, defecto = 'B', contextos = ['A'], frecuencia = 'A', desde = 'B', barrido = ['M'], tamizaje = ['J'], motivo, extra = {} } = {}) {
  return (q) => {
    if (extra[q.id]) return extra[q.id];
    if (q.id === 'INI-MOTIVO') return { texto: motivo || 'El colegio pidió una evaluación por dificultades en clases.' };
    if (q.id === 'INI-EDAD') return { texto: '8' };
    if (q.id === 'INI-INF-EXISTE') return { opcion: existe };
    if (q.id === 'INI-INF-DISP') return { opcion: disp };
    if (q.id === 'BARRIDO') return { opciones: barrido };
    if (q.id === 'TAMIZAJE') return { opciones: tamizaje };
    if (BANCO_SINTOMA.has(q.id)) return { opcion: sintomas[BANCO_SINTOMA.get(q.id)] || defecto };
    if (/-FRECUENCIA$/.test(q.id)) return { opcion: frecuencia };
    if (/-DESDE$/.test(q.id)) return { opcion: desde };
    if (/-CONTEXTOS$/.test(q.id)) return { opciones: contextos };
    return respuestaPorDefecto(q);
  };
}

async function subir(api, id, buf, nombre, clase) {
  return api.req('POST', `/api/casos/${id}/documentos`, { nombre, contenido_base64: buf.toString('base64'), clase, profesional: 'Profesional de prueba' });
}
async function responderN(api, id, n, g) { for (let i = 0; i < n; i++) await responder(api, id, g); }
const informe = async (api, id) => (await api.req('GET', `/api/casos/${id}/informe`)).body.markdown || '';
const sint = (v, s) => v.sintomas.find((x) => x.id === s);
const seccion = (md, n) => { const i = md.indexOf(`## 3.${n}.`); if (i < 0) return ''; const j = md.indexOf('\n## ', i + 4); return md.slice(i, j < 0 ? undefined : j); };

/** Caso completo: entrevista y documentos en el orden indicado. */
async function armar(api, { g, orden = 'entrevista_primero', colegio = true, nesplora = null, etiqueta = 'Caso de protocolo' }) {
  const v0 = await crearCaso(api, etiqueta);
  const id = v0.caso.id;
  const turnos = [];
  const entrevista = async () => { const r = await entrevistar(api, id, { respuesta: g }); turnos.push(...r.turnos); };
  if (orden === 'informe_primero') {
    for (let i = 0; i < 4; i++) { const w = await vista(api, id); if (!w.caso.pregunta_actual?.id.startsWith('INI-')) break; turnos.push(await responder(api, id, g)); }
    if (colegio) await subir(api, id, COLEGIO, 'Informe del Colegio (prueba).docx', 'informe_escolar');
    await entrevista();
  } else {
    await entrevista();
    if (colegio) { await subir(api, id, COLEGIO, 'Informe del Colegio (prueba).docx', 'informe_escolar'); await entrevista(); }
  }
  let nes = null;
  if (nesplora) {
    nes = (await subir(api, id, NESPLORA, 'Inform Nesplora para Diego.pdf', 'informe_rv')).body;
    if (nesplora === 'vincular') await api.req('POST', `/api/casos/${id}/documentos/${nes.id}/vinculacion`, { profesional: 'Profesional de prueba', motivo: 'Documento de ejemplo del cliente: vinculación confirmada para la prueba.' });
  }
  return { id, turnos, nes, v: await vista(api, id), md: await informe(api, id) };
}

const api = await iniciarApp();
after(() => api.cerrar());

// =================================================================================================
// A. PUERTA DE ENTRADA OBLIGATORIA (motivo → edad → existencia del informe escolar)
// =================================================================================================

caso('PE-01', 'Puerta de entrada', 'La entrevista empieza por motivo, edad e informe escolar, en ese orden', async (r) => {
  r.entrada = 'Caso nuevo; respuestas: motivo (texto), edad 8, informe escolar «Sí», disponible «Sí».';
  r.regla = 'Etapa 7 §3–4; Brief §3 (K1); regla del cliente: puerta antes de las ramas clínicas.';
  r.esperado = 'Preguntas 1–4: INI-MOTIVO, INI-EDAD, INI-INF-EXISTE, INI-INF-DISP; ninguna pregunta clínica antes.';
  const v = await crearCaso(api, 'PE-01');
  const ids = [v.caso.pregunta_actual.id];
  const g = guion();
  for (let i = 0; i < 4; i++) { const t = await responder(api, v.caso.id, g); ids.push(t.vista.caso.pregunta_actual?.id); }
  r.obtenido = `Secuencia: ${ids.join(' → ')}.`;
  return ids.slice(0, 4).join() === 'INI-MOTIVO,INI-EDAD,INI-INF-EXISTE,INI-INF-DISP' && !ids[4].startsWith('INI-');
});

caso('PE-02', 'Puerta de entrada', 'No se acepta una respuesta clínica antes de completar la puerta', async (r) => {
  r.entrada = 'Caso nuevo; se envía una respuesta a A01 (síntoma) mientras la pregunta vigente es INI-MOTIVO; luego se propone A01 al validador.';
  r.regla = 'Etapa 9 §C (barrera antes de mostrar una pregunta) y §J.4.';
  r.esperado = 'HTTP 409 para la respuesta fuera de turno; el validador bloquea A01 por «orden_inicial».';
  const v = await crearCaso(api, 'PE-02');
  const a = await api.req('POST', `/api/casos/${v.caso.id}/respuestas`, { pregunta_id: 'A01', opcion: 'A' });
  const q = P.preguntas.get('A01');
  const b = await api.req('POST', `/api/casos/${v.caso.id}/propuestas`, { pregunta_id: 'A01', texto: q.texto });
  const regla = b.body.reglas.find((x) => x.regla === 'orden_inicial');
  r.obtenido = `Respuesta fuera de turno: HTTP ${a.status}. Validador: ${b.body.ok ? 'acepta' : 'bloquea'} (${regla?.detalle}).`;
  return a.status === 409 && !b.body.ok && regla && !regla.ok;
});

caso('PE-03', 'Puerta de entrada', 'Antes de la puerta no se integran documentos clínicos, Nesplora, colegio, RV ni entrevista del niño', async (r) => {
  r.entrada = 'Caso nuevo; antes de responder nada se intenta cargar el informe real del colegio (.docx), el Nesplora (.pdf), respuestas del colegio y una sesión de RV.';
  r.regla = 'Etapa 7 §3–5 (edad, motivo e informe escolar antes de continuar); regla del cliente sobre la puerta de entrada.';
  r.esperado = 'Todas las cargas responden HTTP 409 indicando la puerta; ningún dato clínico entra al expediente; la pregunta vigente sigue siendo INI-MOTIVO.';
  const v = await crearCaso(api, 'PE-03');
  const id = v.caso.id;
  const st = [
    (await subir(api, id, COLEGIO, 'col.docx', 'informe_escolar')).status,
    (await subir(api, id, NESPLORA, 'nes.pdf', 'informe_rv')).status,
    (await api.req('POST', `/api/casos/${id}/colegio`, { respuestas: [{ pregunta_id: P.colegio[0].id, texto: 'Sí, se distrae.' }] })).status,
    (await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'NESPLORA', estado: 'realizada', fecha: '2026-10-01', resultados: { x: 1 } })).status,
  ];
  const w = await vista(api, id);
  const clinicos = w.hechos.filter((h) => h.dimension_id !== 'INI').length;
  r.obtenido = `Respuestas: ${st.join(', ')}. Datos clínicos en el expediente: ${clinicos}. Pregunta vigente: ${w.caso.pregunta_actual?.id}.`;
  return st.every((x) => x === 409) && clinicos === 0 && w.caso.pregunta_actual?.id === 'INI-MOTIVO';
});

caso('PE-03b', 'Puerta de entrada', 'Completada la puerta, el Nesplora de otra edad queda pendiente de vinculación', async (r) => {
  r.entrada = 'Puerta completa (8 años, informe escolar sí y disponible); se carga el Nesplora real (niño nacido en 2014).';
  r.regla = 'Etapa 9 §18; regla del cliente: no confundir resultados entre fuentes.';
  r.esperado = 'HTTP 200; evaluación «pendiente_vinculacion» hasta que el profesional confirme.';
  const v = await crearCaso(api, 'PE-03b');
  await responderN(api, v.caso.id, 4, guion());
  const n = await subir(api, v.caso.id, NESPLORA, 'nes.pdf', 'informe_rv');
  const ev = (await vista(api, v.caso.id)).evaluaciones.find((e) => e.instrumento_id === 'NESPLORA');
  r.obtenido = `HTTP ${n.status}; Nesplora: ${ev?.estado}.`;
  return n.status === 200 && ev?.estado === 'pendiente_vinculacion';
});

caso('PE-04', 'Puerta de entrada', 'Si el apoderado dice que no hay informe escolar y luego se incorpora uno, se usa y la diferencia se registra', async (r) => {
  r.entrada = 'INI-INF-EXISTE = «No» (Ruta A). Antes de terminar la entrevista se carga el informe real del colegio.';
  r.regla = 'Etapa 7 §5.1 (si después se obtiene un informe, se incorpora como fuente independiente) y §5.2; Etapa 9 §I (la fuente nueva no reemplaza la previa).';
  r.esperado = 'El caso pasa a Ruta B («con_informe»), se registra una contradicción sobre la existencia del informe para revisión profesional, y no se borran las respuestas previas del apoderado.';
  const v = await crearCaso(api, 'PE-04');
  const g = guion({ existe: 'B' });
  await responderN(api, v.caso.id, 6, g);
  const antes = (await vista(api, v.caso.id)).hechos.filter((h) => h.fuente === 'apoderado').length;
  await subir(api, v.caso.id, COLEGIO, 'col.docx', 'informe_escolar');
  const { vista: w } = await entrevistar(api, v.caso.id, { respuesta: g });
  const c = w.contradicciones.find((x) => x.dimension_id === 'INI');
  const despues = w.hechos.filter((h) => h.fuente === 'apoderado').length;
  r.obtenido = `Ruta: ${w.caso.ruta}. Contradicción registrada: ${c ? `sí («${c.descripcion.slice(0, 90)}…»)` : 'no'}. Datos del apoderado antes/después: ${antes}/${despues}.`;
  return w.caso.ruta === 'con_informe' && Boolean(c) && despues >= antes;
});

// =================================================================================================
// B. ENTREVISTA ADAPTATIVA: NO REPETICIÓN, CONSERVACIÓN, ETAPA 7 / ETAPA 9
// =================================================================================================

caso('PE-05', 'Entrevista adaptativa', 'Ninguna pregunta se repite y la profundización no supera 3 por síntoma', async (r) => {
  r.entrada = 'Entrevista completa (Ruta A, sin informe): el apoderado responde «Sí» a R1.1, R1.2, R1.4, R2.1 y R2.9; «No» al resto.';
  r.regla = 'Automatización regla 1 y 2; Etapa 9 §B, §D.1 (máx. 3 preguntas de profundización por síntoma).';
  r.esperado = '0 preguntas repetidas; ≤3 preguntas de profundización por síntoma; entrevista cerrada por el gate (entrevista_completa).';
  const g = guion({ existe: 'B', sintomas: { 'R1.1': 'A', 'R1.2': 'A', 'R1.4': 'A', 'R2.1': 'A', 'R2.9': 'A' }, contextos: ['A', 'B'] });
  const { turnos, v } = await armar(api, { g, colegio: false, etiqueta: 'PE-05' });
  const ids = turnos.map((t) => t.pregunta.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  const prof = {}; for (const x of ids) { const m = x.match(/^(R\d\.\d+)-/); if (m) prof[m[1]] = (prof[m[1]] || 0) + 1; }
  const max = Math.max(0, ...Object.values(prof));
  r.obtenido = `${ids.length} turnos; repetidas: ${dup.length ? dup.join(', ') : 'ninguna'}; máx. profundización por síntoma: ${max}; estado: ${v.caso.estado_global}.`;
  return !dup.length && max <= 3 && v.caso.estado_global === 'entrevista_completa';
});

caso('PE-06', 'Entrevista adaptativa', 'Con «No» no se profundiza; con «No sabe» no se registra ausencia', async (r) => {
  r.entrada = 'Ruta A: R1.3 «No», R1.6 «No sabe / no recuerda», R1.1 «Sí».';
  r.regla = 'Etapa 7 §16 (NO SABE ≠ NO); Etapa 9 §6.2.';
  r.esperado = 'R1.3 NO REFERIDO sin preguntas de profundización; R1.6 DESCONOCIDO (no «no referido»); R1.1 profundizado.';
  const g = guion({ existe: 'B', sintomas: { 'R1.1': 'A', 'R1.3': 'B', 'R1.6': 'D' } });
  const { turnos, v } = await armar(api, { g, colegio: false, etiqueta: 'PE-06' });
  const ids = turnos.map((t) => t.pregunta.id);
  r.obtenido = `R1.3: ${sint(v, 'R1.3').estado} (${ids.filter((x) => x.startsWith('R1.3-')).length} profundizaciones). R1.6: ${sint(v, 'R1.6').estado}. R1.1: ${sint(v, 'R1.1').estado} (${ids.filter((x) => x.startsWith('R1.1-')).length} profundizaciones).`;
  return sint(v, 'R1.3').estado === 'NO REFERIDO' && !ids.some((x) => x.startsWith('R1.3-')) && sint(v, 'R1.6').estado === 'DESCONOCIDO' && ids.some((x) => x.startsWith('R1.1-'));
});

caso('PE-07', 'Conservación de la información', 'El expediente persiste tras reiniciar el servidor', async (r) => {
  r.entrada = 'Caso a mitad de la entrevista (10 turnos); se cierra el servidor y se abre otro sobre la misma base.';
  r.regla = 'Automatización regla 1 (estado acumulativo por caso); Etapa 9 §A y §J.8.';
  r.esperado = 'Misma pregunta vigente, mismos hechos y mismo turno después del reinicio.';
  const dbPath = rutaDBTemporal();
  const a1 = await iniciarApp({ dbPath });
  const v = await crearCaso(a1, 'PE-07');
  await responderN(a1, v.caso.id, 10, guion({ existe: 'B', sintomas: { 'R1.1': 'A' } }));
  const antes = await vista(a1, v.caso.id); await a1.cerrar();
  const a2 = await iniciarApp({ dbPath });
  const despues = await vista(a2, v.caso.id); await a2.cerrar();
  r.obtenido = `Antes: turno ${antes.caso.turno}, pregunta ${antes.caso.pregunta_actual?.id}, ${antes.hechos.length} hechos. Después: turno ${despues.caso.turno}, pregunta ${despues.caso.pregunta_actual?.id}, ${despues.hechos.length} hechos.`;
  return antes.caso.turno === despues.caso.turno && antes.caso.pregunta_actual?.id === despues.caso.pregunta_actual?.id && antes.hechos.length === despues.hechos.length;
});

caso('PE-08', 'Etapa 7 / Etapa 9', 'El motor (Etapa 9) solo formula preguntas del banco (Etapa 7) y rechaza preguntas externas o reformuladas', async (r) => {
  r.entrada = 'Entrevista Ruta A completa; luego se proponen al validador una pregunta ajena al banco y una reformulación de una pregunta ya hecha.';
  r.regla = 'Etapa 7 §21 (la Etapa 7 define el banco); Etapa 9 §C-7 y §E (la Etapa 9 selecciona; pregunta no sustentada → descartar).';
  r.esperado = 'Todas las preguntas formuladas existen en protocolo.json; ambas propuestas quedan bloqueadas.';
  const g = guion({ existe: 'B', sintomas: { 'R1.2': 'A' } });
  const { turnos, id } = await armar(api, { g, colegio: false, etiqueta: 'PE-08' });
  const fuera = turnos.map((t) => t.pregunta.id).filter((x) => !P.preguntas.has(x));
  const ext = await api.req('POST', `/api/casos/${id}/propuestas`, { texto: '¿Su hijo juega videojuegos más de dos horas al día?' });
  const ref = await api.req('POST', `/api/casos/${id}/propuestas`, { texto: '¿Le cuesta mantener la atención mientras hace una actividad?' });
  r.obtenido = `Preguntas fuera del banco: ${fuera.length}. Propuesta externa: ${ext.body.ok ? 'aceptada' : 'bloqueada'}. Reformulación: ${ref.body.ok ? 'aceptada' : 'bloqueada'}.`;
  return !fuera.length && !ext.body.ok && !ref.body.ok;
});

caso('PE-09', 'Entrevista adaptativa', '«Ninguna de las anteriores» en el tamizaje cierra solo ese módulo', async (r) => {
  r.entrada = 'Barrido diferencial: «Aprendizaje» (A). Tamizaje médico/sensorial/sueño: «Ninguna de las anteriores» (J).';
  r.regla = 'Automatización regla 3; Etapa 7 §14.1; Etapa 9 §H.1 y §J.6.1.';
  r.esperado = 'Tamizaje COMPLETADO / EXPLORADO_SIN_DIFICULTADES_REPORTADAS; la rama «Aprendizaje» del barrido se explora igual; el informe no lo presenta como descarte médico.';
  const g = guion({ existe: 'B', barrido: ['A'], tamizaje: ['J'] });
  const { turnos, v, md } = await armar(api, { g, colegio: false, etiqueta: 'PE-09' });
  const ramaA = turnos.filter((t) => t.pregunta.id.startsWith('BAR-A')).length;
  r.obtenido = `Tamizaje: ${v.tamizaje.estado} / ${v.tamizaje.resultado}. Preguntas de la rama Aprendizaje: ${ramaA}. Barrido: ${v.barrido.estado}. Leyenda «no se considera descartada» en el informe: ${/no se considera descartada/.test(md) ? 'sí' : 'no'}.`;
  return v.tamizaje.estado === 'COMPLETADO' && v.tamizaje.resultado === 'EXPLORADO_SIN_DIFICULTADES_REPORTADAS' && ramaA > 0 && /no se considera descartada/.test(md);
});

caso('PE-10', 'Conservación de la información', 'Una descripción espontánea posterior a un «No» se conserva y se señala como discrepancia', async (r) => {
  r.entrada = 'Ruta A. A02 («¿Le cuesta mantener la atención…?») = «No». Más adelante, en una pregunta abierta, el apoderado escribe: «Le cuesta mucho mantener la atención en las tareas, se desconcentra a los pocos minutos».';
  r.regla = 'Etapa 9 §3–5 (conservar el dato original), §14.2 (evidencia relacionada), §F (una respuesta puede resolver varias dimensiones); Etapa 7 §15 (repetir ante contradicción).';
  r.esperado = 'La mención queda registrada como evidencia relacionada de R1.2 y se señala la contradicción con el «No» previo (o se activa una pregunta de aclaración).';
  const v = await crearCaso(api, 'PE-10');
  const base = guion({ existe: 'B', sintomas: { 'R1.2': 'B' } });
  let usada = null;
  for (let i = 0; i < 200; i++) {
    const w = await vista(api, v.caso.id); const q = w.caso.pregunta_actual; if (!q) break;
    if (!usada && q.tipo === 'abierta' && !q.id.startsWith('INI-') && w.hechos.some((h) => h.dimension_id === 'R1.2' && h.valor === 'no')) {
      const t = await responder(api, v.caso.id, { texto: 'Le cuesta mucho mantener la atención en las tareas, se desconcentra a los pocos minutos.' });
      usada = { q: q.id, menciones: t.traza.interpretacion.menciones.map((m) => m.sintoma) }; continue;
    }
    await responder(api, v.caso.id, base);
  }
  const w = await vista(api, v.caso.id);
  const hechos = w.hechos.filter((h) => h.dimension_id === 'R1.2').map((h) => `${h.slot}=${h.valor ?? h.estado}`);
  const contr = w.contradicciones.filter((c) => c.dimension_id === 'R1.2').length;
  r.obtenido = `Texto libre en ${usada?.q}; menciones registradas: [${usada?.menciones.join(', ') || 'ninguna'}]. Hechos de R1.2: ${hechos.join('; ')}. Contradicciones de R1.2: ${contr}. Estado final R1.2: ${sint(w, 'R1.2').estado}.`;
  return Boolean(usada?.menciones.includes('R1.2') || contr);
});

// =================================================================================================
// C. ESCENARIO 1 — COINCIDENCIA ENTRE FUENTES
// =================================================================================================

caso('PE-11', 'Escenario 1 · Coincidencia', 'Apoderado, colegio y Nesplora convergen: se integran sin emitir diagnóstico', async (r) => {
  r.entrada = 'Apoderado: «Sí» en los 10 síntomas que describe el informe real del colegio (frecuencia «varias veces al día», desde «>6 meses y antes de los 12», contextos hogar y colegio). Documentos: informe del colegio (.docx) y Nesplora Aula (.pdf) con vinculación confirmada por el profesional.';
  r.regla = 'Etapa 5 / Etapa 9 §11 (triangulación), §18 (RV complementaria); Automatización fase 3; regla del cliente: sin diagnóstico automático.';
  r.esperado = 'Los 10 síntomas con dos fuentes (apoderado + colegio) figuran como convergentes; R10 APOYADO; Nesplora integrado como evidencia complementaria («comisiones» converge con conductas impulsivas); el informe queda «pendiente de validación» y no afirma un diagnóstico.';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const g = guion({ sintomas: s, contextos: ['A', 'B'] });
  const { v, md } = await armar(api, { g, nesplora: 'vincular', etiqueta: 'PE-11' });
  const conv = SINT_COLEGIO.filter((x) => sint(v, x).porFuente.apoderado === 'si' && sint(v, x).porFuente.informe_escolar === 'si');
  const s4 = seccion(md, 4);
  const okRV = /Comisiones[^\n]*Converge con conductas documentadas/i.test(s4);
  // Afirmaciones diagnósticas positivas (se excluye el texto legal «Ningún diagnóstico de salud mental…»).
  const diag = /(se (le )?diagnostica|(?<!sospecha y )diagn[oó]stico confirmado|(?<!ning[uú]n )diagn[oó]stico de tdah|tiene tdah|presenta (un )?tdah)/i.test(md);
  r.obtenido = `Síntomas con apoderado + colegio: ${conv.length}/10. R10: ${v.integracion.requisitos.R10.estado}. Resultado del motor: ${v.integracion.resultado.tipo} (puerta ${v.integracion.puerta}). Nesplora: ${v.evaluaciones.find((e) => e.instrumento_id === 'NESPLORA')?.estado}; comisiones convergentes en §4: ${okRV ? 'sí' : 'no'}. «Pendiente de validación»: ${/pendiente de validación/.test(md) ? 'sí' : 'no'}. Afirmación diagnóstica: ${diag ? 'SÍ' : 'no'}.`;
  return conv.length === 10 && v.integracion.requisitos.R10.estado === 'APOYADO' && okRV && /pendiente de validación/.test(md) && !diag;
});

caso('PE-12', 'Escenario 1 · Coincidencia', 'La convergencia no se cuenta dos veces (un síntoma = una unidad aunque lo describan varias fuentes)', async (r) => {
  r.entrada = 'Mismo caso que PE-11.';
  r.regla = 'Etapa 9 §14.3 (sin duplicación de síntomas).';
  r.esperado = 'R1 «apoyados» ≤ 9 y R2 ≤ 9; la tabla del §5 tiene exactamente 18 filas de síntomas, sin repetidos.';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const { md } = await armar(api, { g: guion({ sintomas: s, contextos: ['A', 'B'] }), etiqueta: 'PE-12' });
  const filas = seccion(md, 5).split('\n').filter((l) => /^\| [AH]\d — /.test(l)).map((l) => l.split('|')[1].trim().split(' ')[0]);
  const m = seccion(md, 5).match(/Inatención: (\d+) de 9 .*?impulsividad: (\d+) de 9/);
  r.obtenido = `Filas de síntomas en §5: ${filas.length} (únicas ${new Set(filas).size}). Apoyados: inatención ${m?.[1]}, hiperactividad/impulsividad ${m?.[2]}.`;
  return filas.length === 18 && new Set(filas).size === 18 && Number(m?.[1]) <= 9 && Number(m?.[2]) <= 9;
});

caso('PE-24', 'Escenario 1 · Coincidencia', 'Frecuencias compatibles de dos fuentes no se registran como contradicción', async (r) => {
  r.entrada = 'Mismo caso que PE-11: el apoderado indica «varias veces al día» (en casa) y el informe del colegio describe la conducta como frecuente/constante (el lector lo registra como «casi todos los días»).';
  r.regla = 'Etapa 9 §11 (la diferencia entre contextos no es error de una fuente); Etapa 7 §12 (variabilidad por contexto); Etapa 3 §3.6/3.10 (frecuencia y contexto son dimensiones distintas de la variable).';
  r.esperado = 'Ninguna contradicción en el slot «frecuencia» cuando ambas fuentes informan una frecuencia alta; los 10 síntomas convergentes quedan APOYADO POR EVIDENCIA.';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const { v } = await armar(api, { g: guion({ sintomas: s, contextos: ['A', 'B'] }), etiqueta: 'PE-24' });
  const fr = v.contradicciones.filter((c) => c.slot === 'frecuencia');
  const noApoyados = SINT_COLEGIO.filter((x) => sint(v, x).estado !== 'APOYADO POR EVIDENCIA');
  r.obtenido = `Contradicciones de frecuencia: ${fr.length} (${fr.map((c) => c.dimension_id).join(', ') || '—'}). Síntomas convergentes no apoyados: ${noApoyados.map((x) => `${x} ${sint(v, x).estado}`).join('; ') || 'ninguno'}. R1: ${v.integracion.requisitos.R1.estado}; resultado: ${v.integracion.resultado.tipo}.`;
  return !fr.length && !noApoyados.length;
});

// =================================================================================================
// D. ESCENARIO 2 — DISCREPANCIA ENTRE FUENTES
// =================================================================================================

caso('PE-13', 'Escenario 2 · Discrepancia', 'El colegio describe conductas que el apoderado no observa en casa (entrevista antes del informe)', async (r) => {
  r.entrada = 'Ruta B. Apoderado: «No» en todos los síntomas. Después se carga el informe real del colegio, que describe 10 síntomas.';
  r.regla = 'Etapa 9 §11 (discrepancia entre fuentes, sin resolverla); Etapa 7 §17 (fuentes diferenciadas).';
  r.esperado = 'Los 10 síntomas quedan CONTRADICTORIO, con 10 discrepancias registradas y sin revisar; ninguno se cuenta como apoyado; el informe las lista en §4 como discrepancias.';
  const { v, md } = await armar(api, { g: guion({ defecto: 'B' }), etiqueta: 'PE-13' });
  const contr = SINT_COLEGIO.filter((x) => sint(v, x).estado === 'CONTRADICTORIO');
  const disc = v.contradicciones.filter((c) => c.slot === 'presencia' && SINT_COLEGIO.includes(c.dimension_id));
  const s4 = seccion(md, 4);
  r.obtenido = `Síntomas CONTRADICTORIO: ${contr.length}/10. Discrepancias registradas: ${disc.length} (sin revisar: ${disc.filter((c) => c.estado !== 'revisada').length}). R1: ${v.integracion.requisitos.R1.estado}; R2: ${v.integracion.requisitos.R2.estado}. Listadas en §4: ${SINT_COLEGIO.filter((x) => s4.includes(P.sintomasPorId.get(x).nombre + ':')).length}.`;
  return contr.length === 10 && disc.length === 10 && v.integracion.requisitos.R1.estado !== 'UMBRAL ALCANZADO';
});

caso('PE-14', 'Escenario 2 · Discrepancia', 'Ruta B con el informe cargado ANTES de las ramas clínicas: el apoderado debe informar sobre el hogar', async (r) => {
  r.entrada = 'Ruta B en el orden de la Etapa 7 §5.2: puerta → se carga el informe real del colegio → entrevista al apoderado, que responde «No» a todo síntoma que se le pregunte.';
  r.regla = 'Etapa 7 §5.2 (el apoderado se usa para el funcionamiento en casa) y §17; Etapa 9 §11 (triangulación); regla del cliente: una sola fuente no determina el resultado.';
  r.esperado = 'Para cada síntoma descrito por el colegio se pregunta al apoderado si ocurre en casa; con «No», el síntoma queda CONTRADICTORIO y se registra la discrepancia; ninguno queda «apoyado» solo con el colegio.';
  const { turnos, v } = await armar(api, { g: guion({ defecto: 'B' }), orden: 'informe_primero', etiqueta: 'PE-14' });
  const preguntados = SINT_COLEGIO.filter((x) => v.hechos.some((h) => h.dimension_id === x && h.fuente === 'apoderado' && h.slot.startsWith('presencia')));
  const apoyadosSoloColegio = SINT_COLEGIO.filter((x) => sint(v, x).estado === 'APOYADO POR EVIDENCIA' && !('apoderado' in sint(v, x).porFuente));
  const profAlApoderado = turnos.filter((t) => /^R\d\.\d+-(FRECUENCIA|DESDE)$/.test(t.pregunta.id) && SINT_COLEGIO.includes(t.pregunta.id.split('-')[0])).length;
  r.obtenido = `Síntomas del colegio con presencia preguntada al apoderado: ${preguntados.length}/10. Discrepancias registradas: ${v.contradicciones.length}. Síntomas «apoyados» solo por el colegio: ${apoyadosSoloColegio.length} (${apoyadosSoloColegio.join(', ')}). Preguntas de frecuencia/inicio hechas al apoderado sobre conductas que solo describió el colegio: ${profAlApoderado}. R1: ${v.integracion.requisitos.R1.estado}.`;
  return preguntados.length === 10 && apoyadosSoloColegio.length === 0;
});

caso('PE-15', 'Escenario 2 · Discrepancia', 'El apoderado describe dificultades que el informe escolar no menciona', async (r) => {
  r.entrada = 'Ruta B. Apoderado «Sí» en R1.3, R1.6, R1.7 y R2.5 (no mencionados en el informe real del colegio); luego se carga el informe.';
  r.regla = 'Etapa 7 §16 (NO INFORMADO ≠ AUSENTE); informe: «la falta de mención no demuestra ausencia».';
  r.esperado = 'Esos síntomas no se marcan CONTRADICTORIO (el colegio no dice «no»); aparecen como hallazgos de una sola fuente en §4 y §9 piden confirmar con otra fuente.';
  const s = { 'R1.3': 'A', 'R1.6': 'A', 'R1.7': 'A', 'R2.5': 'A' };
  const { v, md } = await armar(api, { g: guion({ sintomas: s, contextos: ['A'] }), etiqueta: 'PE-15' });
  const ids = Object.keys(s);
  const contr = ids.filter((x) => sint(v, x).estado === 'CONTRADICTORIO');
  const s4 = seccion(md, 4);
  const compl = ids.filter((x) => s4.includes(`- ${P.sintomasPorId.get(x).nombre}: solo Apoderado`));
  r.obtenido = `Contradictorios: ${contr.length}. Listados como «solo Apoderado» en §4: ${compl.length}/4. Estados: ${ids.map((x) => `${x} ${sint(v, x).estado}`).join('; ')}.`;
  return !contr.length && compl.length === 4;
});

caso('PE-16', 'Escenario 2 · Discrepancia', 'Las discrepancias no se resuelven automáticamente ni a favor de una fuente', async (r) => {
  r.entrada = 'Mismo planteamiento que PE-13 (colegio «sí», apoderado «no»).';
  r.regla = 'Etapa 9 §11; Etapa 5 (contraste); informe §16.';
  r.esperado = 'La puerta queda CERRADA o ABIERTA CON INCERTIDUMBRE; §16 enumera cada discrepancia sin revisar como decisión profesional pendiente.';
  const { v, md } = await armar(api, { g: guion({ defecto: 'B' }), etiqueta: 'PE-16' });
  const s16 = seccion(md, 16);
  const n = (s16.match(/Discrepancia sin revisar/g) || []).length;
  r.obtenido = `Puerta: ${v.integracion.puerta}. Resultado: ${v.integracion.resultado.tipo}. Discrepancias sin revisar listadas en §16: ${n}.`;
  return ['CERRADA', 'ABIERTA CON INCERTIDUMBRE'].includes(v.integracion.puerta) && n >= 10;
});

// =================================================================================================
// E. ESCENARIO 3 — EVIDENCIA INSUFICIENTE O CONTRADICTORIA
// =================================================================================================

caso('PE-17', 'Escenario 3 · Insuficiencia', 'Con «No sabe» generalizado y sin informe, el sistema declara la incertidumbre y no concluye', async (r) => {
  r.entrada = 'Apoderado: «No sabe / no recuerda» en todos los síntomas; informe escolar «No sabe»; barrido «No sabe»; tamizaje «No sé».';
  r.regla = 'Etapa 5 §20–21 (puerta de suficiencia); Etapa 7 §16 y §20.12; Etapa 9 §J.6.';
  r.esperado = 'Puerta CERRADA; resultado INFORMACION_INSUFICIENTE; los 18 síntomas aparecen en «Información pendiente» (§14); tamizaje COMPLETADO_CON_INCERTIDUMBRE; ningún síntoma NO REFERIDO.';
  const g = guion({ existe: 'C', defecto: 'D', barrido: ['N'], tamizaje: ['K'], frecuencia: 'E', desde: 'D', contextos: ['E'] });
  const { v, md } = await armar(api, { g, colegio: false, etiqueta: 'PE-17' });
  const s14 = seccion(md, 14);
  const enPend = v.sintomas.filter((s) => s14.includes(`${s.id} ${s.nombre}`)).length;
  r.obtenido = `Puerta: ${v.integracion.puerta}; resultado: ${v.integracion.resultado.tipo}. Síntomas en §14: ${enPend}/18. Tamizaje: ${v.tamizaje.estado}. NO REFERIDO: ${v.sintomas.filter((s) => s.estado === 'NO REFERIDO').length}. Ruta: ${v.caso.ruta}.`;
  return v.integracion.puerta === 'CERRADA' && v.integracion.resultado.tipo === 'INFORMACION_INSUFICIENTE' && enPend === 18 && v.tamizaje.estado === 'COMPLETADO_CON_INCERTIDUMBRE' && !v.sintomas.some((s) => s.estado === 'NO REFERIDO');
});

caso('PE-18', 'Escenario 3 · Insuficiencia', 'Un informe Nesplora de otro niño (edad y fecha no concordantes) no se integra hasta que el profesional lo confirme', async (r) => {
  r.entrada = 'Caso de 8 años; se carga el Nesplora real (nacido en 2014, aplicado en 2020) sin confirmar la vinculación.';
  r.regla = 'Etapa 9 §18 (RV complementaria y válida); Etapa 6 (trazabilidad); regla del cliente: no confundir resultados entre fuentes.';
  r.esperado = 'Evaluación «pendiente_vinculacion»; el informe la marca «No integrado» y no usa sus índices en la correspondencia ni en las fortalezas.';
  const { v, md } = await armar(api, { g: guion({ existe: 'B' }), colegio: false, nesplora: 'pendiente', etiqueta: 'PE-18' });
  const ev = v.evaluaciones.find((e) => e.instrumento_id === 'NESPLORA');
  const usaIndices = /Tiempo de reacci[oó]n: rendimiento/i.test(seccion(md, 8));
  r.obtenido = `Estado: ${ev?.estado}. Problemas detectados: ${(ev?.resultados?.vinculacion?.problemas || []).join(' ')} «No integrado» en el informe: ${/No integrado/.test(md) ? 'sí' : 'no'}. Índices usados como fortaleza: ${usaIndices ? 'sí' : 'no'}.`;
  return ev?.estado === 'pendiente_vinculacion' && /No integrado/.test(md) && !usaIndices;
});

caso('PE-19', 'Escenario 3 · Insuficiencia', 'Un segundo informe Nesplora no borra el primero', async (r) => {
  r.entrada = 'Se cargan dos informes Nesplora en el mismo caso (el mismo PDF real, dos veces).';
  r.regla = 'Regla del cliente: conservar la información recogida; Etapa 9 §24 (versionado) y §I (la información nueva no reemplaza la previa).';
  r.esperado = 'Quedan dos evaluaciones, o la primera se conserva como registro anterior vinculado a su documento.';
  const v0 = await crearCaso(api, 'PE-19');
  await responderN(api, v0.caso.id, 4, guion());
  const a = (await subir(api, v0.caso.id, NESPLORA, 'nes1.pdf', 'informe_rv')).body;
  const b = (await subir(api, v0.caso.id, NESPLORA, 'nes2.pdf', 'informe_rv')).body;
  const w = await vista(api, v0.caso.id);
  const evs = w.evaluaciones.filter((e) => e.instrumento_id === 'NESPLORA');
  r.obtenido = `Documentos guardados: ${w.documentos.filter((d) => d.clase === 'informe_rv').length} (ids ${a.id}, ${b.id}). Evaluaciones Nesplora: ${evs.length}, vigente vinculada al documento ${evs.map((e) => e.resultados?.documento_id).join(', ')}; registros anteriores conservados: ${evs.map((e) => (e.resultados?.anteriores || []).map((x) => `documento ${x.resultados?.documento_id}`).join(', ') || 'ninguno').join('; ')}.`;
  return evs.length === 2 || evs.some((e) => e.resultados?.anteriores?.length === 1 && e.resultados.anteriores[0].resultados?.documento_id === a.id);
});

// =================================================================================================
// F. CUESTIONARIOS CONNERS / ESCALAS
// =================================================================================================

caso('PE-20', 'Cuestionarios (Conners)', 'Los resultados de una escala registrada se conservan y aparecen en el informe sin crear criterios', async (r) => {
  r.entrada = 'Registro manual de ESCALA-DOCENTE (no hay documento Conners en el proyecto): {inatencion_T: 78, hiperactividad_T: 72}, observación «Conners 3 docente».';
  r.regla = 'D9 (instrumentos opcionales); Etapa 9 §18 por analogía (instrumento complementario no crea ni anula criterios).';
  r.esperado = 'El informe §10 muestra la escala con sus valores tal como se registraron; los estados de los síntomas no cambian.';
  const v0 = await crearCaso(api, 'PE-20');
  await responderN(api, v0.caso.id, 4, guion({ existe: 'B' }));
  const antes = (await vista(api, v0.caso.id)).sintomas.map((s) => s.estado).join();
  const e = await api.req('POST', `/api/casos/${v0.caso.id}/evaluaciones`, { instrumento_id: 'ESCALA-DOCENTE', estado: 'realizada', fecha: '2026-10-20', aplicador: 'Profesora jefe', resultados: { inatencion_T: 78, hiperactividad_T: 72 }, observaciones: 'Conners 3 docente' });
  const w = await vista(api, v0.caso.id);
  const md = await informe(api, v0.caso.id);
  const s10 = seccion(md, 10);
  r.obtenido = `Registro: HTTP ${e.status}. En §10: ${/inatencion_T: 78/.test(s10) && /hiperactividad_T: 72/.test(s10) ? 'valores presentes' : 'valores ausentes'}. Estados de síntomas sin cambios: ${antes === w.sintomas.map((s) => s.estado).join() ? 'sí' : 'no'}.`;
  return e.status === 200 && /inatencion_T: 78/.test(s10) && antes === w.sintomas.map((s) => s.estado).join();
});

// =================================================================================================
// G. INFORME: SIN DIAGNÓSTICO AUTOMÁTICO, VALIDACIÓN PROFESIONAL, ESTRUCTURA DEL PROYECTO
// =================================================================================================

caso('PE-21', 'Informe y validación', 'El informe final no se valida sin profesional y nunca se presenta como validado por sí solo', async (r) => {
  r.entrada = 'Caso de PE-11 (tres fuentes). Se intenta generar el informe final y validarlo sin indicar profesional.';
  r.regla = 'Etapa 9 §28.19 y §29 (revisión profesional); regla del cliente: sin diagnóstico definitivo automático.';
  r.esperado = 'Informe final en estado «pendiente_validacion» (o bloqueado por requisitos); la validación sin profesional devuelve 400.';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const { id } = await armar(api, { g: guion({ sintomas: s, contextos: ['A', 'B'] }), nesplora: 'vincular', etiqueta: 'PE-21' });
  const f = await api.req('POST', `/api/casos/${id}/informes`);
  const val = f.status === 200 ? await api.req('POST', `/api/casos/${id}/informes/${f.body.id}/validacion`, {}) : null;
  r.obtenido = `Generar informe final: HTTP ${f.status}${f.status === 200 ? ` (estado ${f.body.estado})` : ` (${f.body.error || f.body.mensaje || 'bloqueado por requisitos'})`}. Validar sin profesional: ${val ? `HTTP ${val.status}` : 'no aplica'}.`;
  return (f.status === 409) || (f.status === 200 && f.body.estado === 'pendiente_validacion' && val.status === 400);
});

caso('PE-22', 'Informe y validación', 'El informe sigue el formato de 16 secciones pedido por el cliente', async (r) => {
  r.entrada = 'Caso de PE-11 (tres fuentes).';
  r.regla = '«Módulo de generación del informe» del cliente (secciones 3.1–3.16, síntesis educativa y control de calidad); decisión K9 del registro de contradicciones (prevalece el formato del cliente).';
  r.esperado = 'Secciones 3.1 a 3.16 en orden, «Síntesis educativa para profesores y psicopedagogos» y «Control de calidad del informe» (Modelo de Informe de Salida).';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const { md } = await armar(api, { g: guion({ sintomas: s, contextos: ['A', 'B'] }), etiqueta: 'PE-22' });
  const nums = [...md.matchAll(/^## 3\.(\d+)\. /gm)].map((m) => Number(m[1]));
  const ok = nums.join() === Array.from({ length: 16 }, (_, i) => i + 1).join() && /## Síntesis educativa para profesores y psicopedagogos/.test(md) && /## Control de calidad del informe/.test(md);
  r.obtenido = `Secciones numeradas: ${nums.join(', ')}. Síntesis educativa: ${/Síntesis educativa para profesores/.test(md) ? 'sí' : 'no'}. Control de calidad: ${/Control de calidad del informe/.test(md) ? 'sí' : 'no'}.`;
  return ok;
});

caso('PE-25', 'Informe y validación', 'Los controles de calidad del informe se calculan (no se declaran cumplidos de antemano)', async (r) => {
  r.entrada = 'Caso con discrepancias sin revisar entre colegio y apoderado (PE-13) y caso con Nesplora sin vincular (PE-18).';
  r.regla = 'Etapa 6 y Etapa 9 §23 (trazabilidad y auditoría verificables).';
  r.esperado = 'En el caso con Nesplora sin vincular, «Fuentes vinculadas al caso» aparece «Con limitación»; en ambos, la consistencia, la duplicación y la trazabilidad se informan según el cálculo.';
  const a = await armar(api, { g: guion({ defecto: 'B' }), etiqueta: 'PE-25a' });
  const b = await armar(api, { g: guion({ existe: 'B' }), colegio: false, nesplora: 'pendiente', etiqueta: 'PE-25b' });
  const fila = (md, c) => (md.split('\n').find((l) => l.startsWith(`| ${c} |`)) || '').split('|')[2]?.trim();
  const res = ['Fuentes vinculadas al caso', 'Consistencia entre síntomas y conclusión', 'Sin duplicación de evidencia', 'Trazabilidad de las conclusiones'].map((c) => `${c}: ${fila(a.md, c)} / ${fila(b.md, c)}`);
  r.obtenido = res.join('. ') + '.';
  return fila(b.md, 'Fuentes vinculadas al caso') === 'Con limitación' && fila(a.md, 'Fuentes vinculadas al caso') === 'Cumple'
    && ['Consistencia entre síntomas y conclusión', 'Sin duplicación de evidencia', 'Trazabilidad de las conclusiones'].every((c) => fila(a.md, c) === 'Cumple' && fila(b.md, c) === 'Cumple');
});

caso('PE-23', 'Informe y validación', 'Los requisitos del informe coinciden con los estados calculados por el motor', async (r) => {
  r.entrada = 'Casos PE-11 (coincidencia) y PE-17 (insuficiencia).';
  r.regla = 'Informe: «no recalcula criterios, no cambia estados» (Módulo de informe); Etapa 6 (trazabilidad).';
  r.esperado = 'Para R1–R10, el estado del §6 del informe es idéntico al del motor.';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const a = await armar(api, { g: guion({ sintomas: s, contextos: ['A', 'B'] }), etiqueta: 'PE-23a' });
  const b = await armar(api, { g: guion({ existe: 'C', defecto: 'D', barrido: ['N'], tamizaje: ['K'], frecuencia: 'E', desde: 'D', contextos: ['E'] }), colegio: false, etiqueta: 'PE-23b' });
  const difs = [];
  for (const { v, md } of [a, b]) {
    const s6 = seccion(md, 6);
    for (const [k, x] of Object.entries(v.integracion.requisitos)) if (!s6.split('\n').some((l) => l.includes(`${x.nombre} (${k}) | ${x.estado} |`))) difs.push(`${v.caso.etiqueta} ${k}`);
  }
  r.obtenido = difs.length ? `Diferencias: ${difs.join(', ')}.` : 'Los 20 requisitos (2 casos × R1–R10) coinciden.';
  return !difs.length;
});

// =================================================================================================
// H. MODELO MAESTRO Y MODELO DE INFORME DE SALIDA (30-10-2026)
// =================================================================================================

const NESPLORA_ADAPTADO = DOC('nesplora-aula-adaptado.docx'); // «Informe_Nesplora_Joaquin_10_anos_Oficial.docx» del cliente

caso('PE-26', 'Instrumentos', 'El Nesplora en formato interpretativo adaptado (.docx) se lee con sus cinco índices y se vincula al caso correcto', async (r) => {
  r.entrada = 'Caso «Joaquín P. S.», 10 años, puerta completa; se carga «Informe_Nesplora_Joaquin_10_anos_Oficial.docx».';
  r.regla = 'Modelo Maestro §3 (Instrumentos) y §6 (verificar identidad, edad y fecha); Etapa 9 §18.';
  r.esperado = 'Evaluación «realizada» (identidad verificada) con omisiones T59 normal, comisiones T80 muy bajo, TR T37 alto, variabilidad T80 muy bajo y actividad motora T69 bajo; la conclusión diagnóstica propia del documento no se incorpora.';
  const v = await crearCaso(api, 'Joaquín P. S.');
  await responderN(api, v.caso.id, 4, guion({ extra: { 'INI-EDAD': { texto: '10' } } }));
  const n = await subir(api, v.caso.id, NESPLORA_ADAPTADO, 'Informe_Nesplora_Joaquin_10_anos_Oficial.docx', 'informe_rv');
  const ev = (await vista(api, v.caso.id)).evaluaciones.find((e) => e.instrumento_id === 'NESPLORA');
  const vars = Object.fromEntries((ev?.resultados?.variables || []).map((x) => [x.id, `T${x.t} ${x.rendimiento}`]));
  const lim = (ev?.resultados?.limitaciones || []).some((x) => /conclusión diagnóstica propia/.test(x));
  r.obtenido = `HTTP ${n.status}; estado ${ev?.estado}; índices: ${JSON.stringify(vars)}; fecha ${ev?.fecha}; conclusión propia excluida: ${lim ? 'sí' : 'no'}.`;
  return ev?.estado === 'realizada' && vars.omisiones === 'T59 normal' && vars.comisiones === 'T80 muy bajo' && vars.tiempo_reaccion === 'T37 alto' && vars.variabilidad_tr === 'T80 muy bajo' && vars.actividad_motora === 'T69 bajo' && lim;
});

caso('PE-27', 'Informe y validación', 'El informe sigue el Modelo de Informe de Salida: identificación, alcance, matriz A1–H9, tamizaje por factores, síntesis y declaración', async (r) => {
  r.entrada = 'Caso de tres fuentes (apoderado, informe real del colegio, Nesplora vinculado); tamizaje con «Sueño».';
  r.regla = 'Modelo de Informe de Salida TDAH (30-10-2026) y Modelo Maestro §4, §5 y §7.';
  r.esperado = 'Identificación resumida y alcance antes de 3.1; estado PENDIENTE; 3.1 con curso y establecimiento del colegio; 3.5 con A1–A9 y H1–H9; 3.11 con Sueño, factores sensoriales, neurológicos y médicos con estado; síntesis con sus 8 apartados; declaración final; controles de 16 secciones, matriz y tamizaje «Cumple».';
  const s = Object.fromEntries(SINT_COLEGIO.map((x) => [x, 'A']));
  const { md } = await armar(api, { g: guion({ sintomas: s, contextos: ['A', 'B'], tamizaje: ['D'] }), nesplora: 'vincular', etiqueta: 'PE-27' });
  const i1 = md.indexOf('## Identificación resumida'); const i31 = md.indexOf('## 3.1.');
  const codigos = (seccion(md, 5).match(/^\| [AH]\d — /gm) || []).map((x) => x.slice(2, 4));
  const s11 = seccion(md, 11);
  const factores = ['Sueño', 'Factores sensoriales', 'Factores neurológicos', 'Factores médicos'].filter((f) => new RegExp(`\\| ${f} \\|[^\\n]*\\| (informado|no informado|requiere aclaración|pendiente de evaluación)`).test(s11));
  const sub = ['Perfil funcional en lenguaje sencillo', 'Fortalezas aprovechables para el aprendizaje', 'Dificultades observadas y contextos', 'Apoyos concretos en aula', 'Estrategias psicopedagógicas', 'Orientaciones para el hogar (si corresponde)', 'Indicadores de seguimiento', 'Aspectos pendientes'].filter((x) => md.includes(`### ${x}`));
  const qc = ['Estructura de 16 secciones', 'Matriz de 18 síntomas', 'Tamizaje médico, sensorial y del sueño'].map((c) => (md.split('\n').find((l) => l.startsWith(`| ${c} |`)) || '').split('|')[2]?.trim());
  const ok = i1 >= 0 && i1 < i31 && /Estado de validación:\*\* PENDIENTE/.test(md) && /\*\*Curso:\*\* 3° Básico A/.test(md) && /Colegio San Agustín/.test(seccion(md, 1))
    && codigos.join() === 'A1,A2,A3,A4,A5,A6,A7,A8,A9,H1,H2,H3,H4,H5,H6,H7,H8,H9' && factores.length === 4 && sub.length === 8
    && /## Declaración de alcance y responsabilidad profesional/.test(md) && qc.every((x) => x === 'Cumple');
  r.obtenido = `Identificación antes de 3.1: ${i1 >= 0 && i1 < i31 ? 'sí' : 'no'}. Códigos 3.5: ${codigos.join(',')}. Factores 3.11: ${factores.length}/4. Apartados síntesis: ${sub.length}/8. Declaración: ${/Declaración de alcance/.test(md) ? 'sí' : 'no'}. Controles: ${qc.join(' / ')}.`;
  return ok;
});

caso('PE-28', 'Cuestionarios (Conners)', 'Un documento Conners no se lee como observación narrativa del colegio', async (r) => {
  r.entrada = 'Puerta completa; se carga como «informe escolar» un texto de escala Conners 3 (versión docente) con ítems y puntajes T.';
  r.regla = 'Modelo Maestro §9 (Conners: no declarar integrado; sus resultados no crean criterios) y §3 (fuentes separadas).';
  r.esperado = 'El documento se guarda; no se crean datos de síntomas desde los ítems de la escala; el detalle indica registrar los puntajes en Instrumentos.';
  const v = await crearCaso(api, 'PE-28');
  await responderN(api, v.caso.id, 4, guion());
  const txt = Buffer.from('Conners 3 – Formulario docente. Ítems: Se distrae fácilmente (3). No termina las tareas (3). Le cuesta permanecer sentado (2). Inatención T = 78. Hiperactividad/Impulsividad T = 72.');
  const res = await subir(api, v.caso.id, txt, 'conners.txt', 'informe_escolar');
  const w = await vista(api, v.caso.id);
  const n = w.hechos.filter((h) => h.fuente === 'informe_escolar').length;
  r.obtenido = `HTTP ${res.status}; datos de síntomas creados desde la escala: ${n}; detalle: «${(res.body.detalle || '').slice(0, 120)}».`;
  return res.status === 200 && n === 0 && /Conners/.test(res.body.detalle || '');
});

// ------------------------------------------------------------------ salida ---

function escribir() {
  if (!process.env.EVIDENCIA && !process.env.PROTOCOLO) return;
  const dir = path.join('docs', 'evidencia', 'protocolo');
  fs.mkdirSync(dir, { recursive: true });
  const orden = RESULTADOS.sort((x, y) => x.id.localeCompare(y.id));
  fs.writeFileSync(path.join(dir, 'resultados.json'), JSON.stringify({ fecha: new Date().toISOString(), protocolo: `${P.id} ${P.version}`, casos: orden }, null, 2));
  const ap = orden.filter((x) => x.veredicto === 'APROBADA').length;
  const L = ['# Protocolo de pruebas — resultados', '', `Ejecutado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Protocolo ${P.id} ${P.version} · ${ap} aprobadas, ${orden.length - ap} fallidas de ${orden.length}.`, '',
    'Documentos reales usados: «Informe del Colegio (prueba).docx» y «Inform Nesplora para Diego.pdf» (entregados por el cliente). Las respuestas del apoderado son guiones de prueba.', '',
    '| ID | Escenario | Prueba | Veredicto |', '|---|---|---|---|', ...orden.map((x) => `| ${x.id} | ${x.escenario} | ${x.titulo} | **${x.veredicto}** |`), ''];
  for (const x of orden) {
    L.push(`## ${x.id} — ${x.titulo}`, '', `- **Escenario:** ${x.escenario}`, `- **Regla del proyecto:** ${x.regla}`, `- **Datos de entrada:** ${x.entrada}`, `- **Resultado esperado:** ${x.esperado}`, `- **Resultado obtenido:** ${x.obtenido}`, `- **Veredicto:** ${x.veredicto}`, '');
  }
  fs.writeFileSync(path.join(dir, 'RESULTADOS.md'), L.join('\n'));
}

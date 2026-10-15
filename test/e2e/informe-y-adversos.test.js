// E11–E12 y casos adversos: ambigüedad, contradicciones, errores de API, datos faltantes,
// entradas inválidas, cambio de ruta, colegio y entrevista al niño/niña.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, vista, responder, entrevistar, crearEvidencia } from './ayudantes.js';
import { respuestaPara, INFORME_ESCOLAR } from '../fixtures/caso-ficticio.js';
import { crearClienteIA } from '../../src/ia.js';

const ev = crearEvidencia('informe-y-adversos');
after(() => ev.escribir());

async function hastaPregunta(api, id, qid, resp = respuestaPara) {
  for (let i = 0; i < 200; i++) {
    const q = (await vista(api, id)).caso.pregunta_actual;
    if (!q) throw new Error(`no se llegó a ${qid}`);
    if (q.id === qid) return q;
    await responder(api, id, resp);
  }
  throw new Error('demasiados turnos');
}

async function casoCompleto(api) {
  const v = await crearCaso(api);
  const id = v.caso.id;
  await entrevistar(api, id);
  await api.req('POST', `/api/casos/${id}/informe-escolar`, { texto: INFORME_ESCOLAR });
  await entrevistar(api, id);
  return id;
}

test('E11 · el informe final refleja los datos reales, las discrepancias y la incertidumbre', async () => {
  const p = ev.prueba('E11', 'Informe desde el expediente', 'El informe se construye solo con el expediente: 19 secciones de la Etapa 9 §28.2, contraste DSM-5-TR R1–R10, evidencia literal y validación profesional.');
  const api = await iniciarApp();
  try {
    const id = await casoCompleto(api);
    let v = await vista(api, id);
    assert.equal(v.caso.estado_global, 'entrevista_completa');
    assert.equal(v.integracion.requisitos.R1.estado, 'UMBRAL ALCANZADO');
    // La discrepancia R2.9 bloquea hasta ser revisada.
    let r = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(r.status, 409);
    for (const c of v.contradicciones.filter((x) => x.estado !== 'revisada')) {
      await api.req('POST', `/api/casos/${id}/contradicciones/${c.id}/revision`, { nota: 'Diferencia atribuible al contexto (hogar vs. aula).', profesional: 'Profesional ficticio' });
    }
    await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'NESPLORA', estado: 'realizada', fecha: '2026-10-01', resultados: { atencion_sostenida: 'bajo lo esperado' } });
    await api.req('PUT', `/api/casos/${id}/interpretacion`, { texto: 'Interpretación clínica ficticia del profesional.', profesional: 'Profesional ficticio' });
    r = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(r.status, 200);
    const md = r.body.markdown;
    for (let i = 1; i <= 19; i++) {
      const sec = i === 13 || i === 14 ? '## 13–14.' : `## ${i}.`;
      assert.ok(md.includes(sec), `sección ${i}`);
    }
    assert.match(md, /Desde primero básico se distrae mucho en clases/);
    assert.match(md, /«No interrumpe a sus compañeros\.»/);
    assert.match(md, /R1\.5 \| Dificultad para organizar tareas y actividades \| DESCONOCIDO/);
    assert.match(md, /Nesplora/);
    assert.match(md, /Referencias científicas/);
    assert.match(md, /PENDIENTE DE VALIDACIÓN PROFESIONAL/);
    ev.paso(p, { entrada: 'Expediente completo + revisión + interpretación', accion_resultante: `Informe final #${r.body.id} (${md.length} caracteres)`, esperado: '19 secciones con datos reales', ok: true });
    const val = await api.req('POST', `/api/casos/${id}/informes/${r.body.id}/validacion`, { profesional: 'Profesional ficticio' });
    assert.equal(val.status, 200);
    assert.match(val.body.markdown, /VALIDADO por Profesional ficticio/);
    v = await vista(api, id);
    assert.equal(v.caso.estado_global, 'validado');
    ev.paso(p, { entrada: 'Validación profesional', accion_resultante: `estado=${v.caso.estado_global}`, esperado: 'validado', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E12 · el sistema bloquea preguntas no autorizadas e informes prematuros', async () => {
  const p = ev.prueba('E12', 'Bloqueos', 'Preguntas externas, respuestas a preguntas no vigentes e informes sin requisitos se rechazan y quedan auditados.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const ext = await api.req('POST', `/api/casos/${id}/propuestas`, { texto: '¿Tiene antecedentes de alergias alimentarias?', origen: 'ia' });
    assert.equal(ext.body.ok, false);
    const fuera = await api.req('POST', `/api/casos/${id}/respuestas`, { pregunta_id: 'A09', opcion: 'A' });
    assert.equal(fuera.status, 409);
    const inf = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(inf.status, 409);
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
    const tipos = aud.decisiones.map((d) => d.tipo);
    for (const t of ['propuesta_bloqueada', 'respuesta_rechazada', 'informe_final_bloqueado']) assert.ok(tipos.includes(t), t);
    ev.paso(p, { entrada: 'Pregunta externa / respuesta fuera de turno / informe prematuro', accion_resultante: `${ext.body.mensaje} · HTTP ${fuera.status} · HTTP ${inf.status}`, esperado: 'Todo bloqueado y auditado', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A1 · respuestas ambiguas: no se suponen; la pregunta se mantiene hasta obtener una alternativa', async () => {
  const p = ev.prueba('A1', 'Ambigüedad', 'Una respuesta libre que no corresponde a ninguna alternativa queda como ambigua y no se convierte en Sí ni No.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    await hastaPregunta(api, id, 'A09');
    const r = await responder(api, id, { texto: 'mmm' });
    assert.equal(r.traza.interpretacion.estado_dato, 'ambiguo');
    const e = r.vista.sintomas.find((s) => s.id === 'R1.8');
    assert.notEqual(e.estado, 'NO REFERIDO');
    assert.notEqual(e.estado, 'APOYADO POR EVIDENCIA');
    ev.pasoDesdeTraza(p, r.traza, 'Dato ambiguo; sin supuesto', true);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A2 · discrepancia entre fuentes: se registra y bloquea el informe hasta su revisión', async () => {
  const p = ev.prueba('A2', 'Discrepancias', 'Apoderado «Sí» vs. colegio «No» en R2.9: se conserva sin resolver por suposición y exige revisión profesional.');
  const api = await iniciarApp();
  try {
    const id = await casoCompleto(api);
    const v = await vista(api, id);
    const c = v.contradicciones.find((x) => x.estado === 'abierta');
    assert.ok(c);
    assert.match(c.descripcion, /se conserva sin resolver/);
    const e = v.sintomas.find((s) => s.id === 'R2.9');
    assert.equal(e.estado, 'CONTRADICTORIO');
    assert.equal(v.requisitos.requisitos.find((r) => r.id === 'contradicciones_revisadas').cumplido, false);
    const sinNota = await api.req('POST', `/api/casos/${id}/contradicciones/${c.id}/revision`, { profesional: 'X' });
    assert.equal(sinNota.status, 400);
    const ok = await api.req('POST', `/api/casos/${id}/contradicciones/${c.id}/revision`, { nota: 'Revisado', profesional: 'Profesional ficticio' });
    assert.equal(ok.body.requisitos.requisitos.find((r) => r.id === 'contradicciones_revisadas').cumplido, true);
    ev.paso(p, { entrada: c.descripcion, accion_resultante: 'Revisión con nota y profesional', esperado: 'Requisito cumplido solo tras la revisión', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A3 · error de la API de IA: contingencia con el intérprete de reglas, sin perder la respuesta', async () => {
  const p = ev.prueba('A3', 'Error de API', 'Caída, tiempo agotado, JSON inválido o alternativa fuera de esquema no detienen la entrevista ni corrompen el expediente.');
  const fallos = [
    ['red caída', async () => { throw new Error('ECONNRESET'); }],
    ['HTTP 529', async () => new Response('sobrecargado', { status: 529 })],
    ['JSON inválido', async () => Response.json({ content: [{ type: 'text', text: 'no es json' }] })],
    ['alternativa fuera de esquema', async () => Response.json({ content: [{ type: 'text', text: '{"codigo":"Z"}' }] })],
  ];
  for (const [nombre, fetchImpl] of fallos) {
    const ia = crearClienteIA({ proveedor: 'anthropic', apiKey: 'clave-de-prueba', fetchImpl, timeoutMs: 500 });
    const api = await iniciarApp({ ia });
    try {
      const v = await crearCaso(api); const id = v.caso.id;
      await hastaPregunta(api, id, 'A09');
      const r = await responder(api, id, { texto: 'Sí, se distrae siempre' });
      assert.ok(r.traza.error_api, nombre);
      assert.equal(r.traza.interpretacion.interprete, 'reglas (contingencia)');
      assert.equal(r.traza.interpretacion.valor, 'si');
      assert.equal(r.traza.decision_motor.pregunta_id, 'R1.8-FRECUENCIA', 'la entrevista continúa');
      const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
      assert.equal(aud.errores.length, 1);
      ev.pasoDesdeTraza(p, r.traza, `Falla «${nombre}» → contingencia y error auditado (${r.traza.error_api})`, true);
    } finally { await api.cerrar(); }
  }
  ev.cerrar(p, true);
});

test('A4 · IA disponible (Anthropic u OpenAI): solo asigna la alternativa; el motor decide la siguiente pregunta', async () => {
  const p = ev.prueba('A4', 'IA acotada', 'La IA recibe la pregunta autorizada y sus alternativas y devuelve solo un código; no elige preguntas.');
  for (const proveedor of ['anthropic', 'openai']) {
    let llamadas = 0;
    const fetchImpl = async (url, init) => {
      llamadas++;
      const cuerpo = JSON.parse(init.body);
      const system = proveedor === 'anthropic' ? cuerpo.system : cuerpo.messages[0].content;
      assert.match(system, /No selecciones, inventes ni reformules preguntas/);
      if (proveedor === 'openai') { assert.match(url, /openai/); assert.equal(init.headers.authorization, 'Bearer k'); }
      const texto = JSON.stringify({ codigo: 'C' });
      return Response.json(proveedor === 'anthropic' ? { content: [{ type: 'text', text: texto }] } : { choices: [{ message: { content: texto } }] });
    };
    const api = await iniciarApp({ ia: crearClienteIA({ proveedor, apiKey: 'k', fetchImpl }) });
    try {
      const v = await crearCaso(api); const id = v.caso.id;
      await hastaPregunta(api, id, 'A09');
      const r = await responder(api, id, { texto: 'Pasa en algunos momentos, depende del día' });
      assert.equal(llamadas, 1);
      assert.equal(r.traza.interpretacion.interprete, 'ia');
      assert.equal(r.traza.interpretacion.valor, 'ocasionalmente');
      assert.equal(r.traza.decision_motor.pregunta_id, 'R1.8-FRECUENCIA', 'el orden lo fija el motor');
      ev.pasoDesdeTraza(p, r.traza, `${proveedor}: código C → Ocasionalmente; la siguiente pregunta la decide el motor`, true);
    } finally { await api.cerrar(); }
  }
  ev.cerrar(p, true);
});

test('A5 · datos faltantes y entradas inválidas', async () => {
  const p = ev.prueba('A5', 'Validación de entradas', 'El backend rechaza entradas incompletas o inválidas sin modificar el expediente.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const checks = [
      ['Respuesta vacía', await api.req('POST', `/api/casos/${id}/respuestas`, { pregunta_id: 'INI-MOTIVO', texto: '  ' }), 400],
      ['Tipo de respuesta no válido', await api.req('POST', `/api/casos/${id}/respuestas`, { pregunta_id: 'INI-MOTIVO', tipo: 'tal_vez' }), 400],
      ['Caso inexistente', await api.req('GET', '/api/casos/no-existe'), 404],
      ['Instrumento fuera del protocolo', await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'INVENTADO', estado: 'realizada', fecha: '2026-10-01' }), 400],
      ['Realizada sin fecha', await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'NESPLORA', estado: 'realizada' }), 400],
      ['No aplica sin justificación', await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'ESCALA-DOCENTE', estado: 'no_aplica' }), 400],
      ['Cambio de ruta antes de la fase inicial', await api.req('POST', `/api/casos/${id}/ruta`, { ruta: 'completa', motivo: 'x' }), 409],
      ['Interpretación sin profesional', await api.req('PUT', `/api/casos/${id}/interpretacion`, { texto: 'x' }), 400],
      ['Informe escolar vacío', await api.req('POST', `/api/casos/${id}/informe-escolar`, { texto: '' }), 400],
      ['Extracción manual sin evidencia', await api.req('POST', `/api/casos/${id}/informe-escolar`, { hechos: [{ sintoma: 'R1.8', slot: 'presencia:informe', valor: 'si' }] }), 400],
      ['Pregunta de colegio inexistente', await api.req('POST', `/api/casos/${id}/colegio`, { respuestas: [{ pregunta_id: 'X99', texto: 'a' }] }), 400],
      ['Entrevista NNA sin edad', await api.req('POST', `/api/casos/${id}/nna`, { pregunta_id: 'D01', texto: 'a' }), 409],
    ];
    for (const [nombre, r, esperado] of checks) {
      assert.equal(r.status, esperado, nombre);
      ev.paso(p, { entrada: nombre, accion_resultante: `HTTP ${r.status}: ${r.body.error}`, esperado: `HTTP ${esperado}`, ok: true });
    }
    const w = await vista(api, id);
    assert.equal(w.hechos.length, 0);
    assert.equal(w.caso.pregunta_actual.id, 'INI-MOTIVO');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A6 · cambio de ruta cuando el informe finalmente no se puede obtener', async () => {
  const p = ev.prueba('A6', 'Cambio de ruta', 'Si el informe anunciado no llega, el profesional cambia a Ruta A y el apoderado aporta lo escolar.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const r = await entrevistar(api, id);
    assert.equal(r.vista.caso.estado_global, 'esperando_informe_escolar');
    const c = await api.req('POST', `/api/casos/${id}/ruta`, { ruta: 'completa', motivo: 'El colegio no entregará el informe' });
    assert.equal(c.status, 200);
    assert.equal(c.body.resultado.pregunta.id, 'RA-C01');
    ev.paso(p, { entrada: 'Cambio de ruta a «completa» con motivo', decision_motor: c.body.resultado.pregunta.justificacion, accion_resultante: `Pregunta: ${c.body.resultado.pregunta.texto}`, esperado: 'Se pregunta lo escolar al apoderado', ok: true });
    const fin = await entrevistar(api, id);
    assert.equal(fin.vista.caso.estado_global, 'entrevista_completa');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A7 · complementación del colegio (Anexo 7-C) y entrevista al niño/niña (Anexo 7-D)', async () => {
  const p = ev.prueba('A7', 'Otras fuentes', 'Solo se envían al colegio las preguntas que el informe no cubre; la entrevista al niño usa el banco D (<12 años) y se puede finalizar.');
  const api = await iniciarApp();
  try {
    const id = await casoCompleto(api);
    let v = await vista(api, id);
    const enviar = v.colegio.filter((c) => c.enviar).map((c) => c.id);
    assert.ok(!enviar.includes('C01'));
    assert.ok(enviar.length > 0);
    v = (await api.req('POST', `/api/casos/${id}/colegio`, { respuestas: [{ pregunta_id: enviar[0], texto: 'En el aula necesita apoyo para organizarse.' }] })).body;
    assert.ok(v.hechos.some((h) => h.fuente === 'profesor' && h.slot === enviar[0]));
    assert.equal(v.nna.fuente, 'nino');
    const q = v.nna.siguiente;
    assert.match(q.id, /^D\d+/);
    v = (await api.req('POST', `/api/casos/${id}/nna`, { pregunta_id: q.id, texto: 'A veces me cuesta poner atención en clases.' })).body;
    assert.equal(v.nna.respondidas, 1);
    v = (await api.req('POST', `/api/casos/${id}/nna`, { finalizar: true })).body;
    assert.equal(v.nna.cerrada, true);
    ev.paso(p, { entrada: `Colegio: ${enviar.length} preguntas por enviar; NNA: ${q.id}`, accion_resultante: 'Respuestas registradas con su fuente (profesor / niño)', esperado: 'Sin preguntar lo ya cubierto', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

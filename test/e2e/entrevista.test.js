// Pruebas E2E obligatorias del brief (§11) sobre el servidor HTTP real y SQLite,
// con el protocolo vigente generado desde los documentos del proyecto.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, vista, responder, entrevistar, crearEvidencia, rutaDBTemporal } from './ayudantes.js';
import { respuestaPara, INFORME_ESCOLAR, SINTOMAS_SI } from '../fixtures/caso-ficticio.js';

const ev = crearEvidencia('entrevista');
after(() => ev.escribir());

const ids = (turnos) => turnos.map((t) => t.pregunta.id);
const sinInforme = (q) => (q.id === 'INI-INF-EXISTE' ? { opcion: 'B' } : respuestaPara(q));

test('E01 · la entrevista comienza en el orden establecido', async () => {
  const p = ev.prueba('E01', 'Orden inicial obligatorio', 'Motivo → edad → informe escolar → disponibilidad → ruta, antes de cualquier síntoma.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    assert.equal(v.caso.pregunta_actual.id, 'INI-MOTIVO');
    const orden = [];
    for (let i = 0; i < 4; i++) {
      const r = await responder(api, v.caso.id, respuestaPara);
      orden.push(r.pregunta.id);
      ev.pasoDesdeTraza(p, r.traza, 'Siguiente paso de la secuencia inicial', true);
    }
    assert.deepEqual(orden, ['INI-MOTIVO', 'INI-EDAD', 'INI-INF-EXISTE', 'INI-INF-DISP']);
    const v2 = await vista(api, v.caso.id);
    assert.equal(v2.caso.ruta, 'con_informe');
    assert.ok(!v2.caso.pregunta_actual.id.startsWith('INI'), 'tras la fase inicial se pasa a los síntomas');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E02 · la ruta cambia según la existencia del informe escolar', async () => {
  const p = ev.prueba('E02', 'Ruta según informe escolar', 'Ruta B: el hogar no pregunta lo escolar hasta tener el informe. Ruta A: el apoderado aporta lo escolar (RA-*), sin preguntar disponibilidad.');
  const api = await iniciarApp();
  try {
    const conInf = await crearCaso(api, 'ruta B');
    const a = await entrevistar(api, conInf.caso.id);
    const idsA = ids(a.turnos);
    assert.equal(a.vista.caso.ruta, 'con_informe');
    assert.ok(!idsA.some((x) => x.startsWith('RA-')), 'no pregunta lo escolar en el hogar antes del informe');
    assert.equal(a.vista.caso.estado_global, 'esperando_informe_escolar');
    ev.paso(p, { entrada: 'Caso A: informe existe y está disponible', decision_motor: `ruta=${a.vista.caso.ruta}`, accion_resultante: `estado=${a.vista.caso.estado_global}; preguntas RA: ${idsA.filter((x) => x.startsWith('RA-')).length}`, esperado: 'con_informe, 0 preguntas escolares, espera el informe', ok: true });

    const sinInf = await crearCaso(api, 'ruta A');
    const b = await entrevistar(api, sinInf.caso.id, { respuesta: sinInforme });
    const idsB = ids(b.turnos);
    assert.equal(b.vista.caso.ruta, 'completa');
    assert.ok(!idsB.includes('INI-INF-DISP'), 'no pregunta disponibilidad si no existe');
    assert.deepEqual(idsB.filter((x) => x.startsWith('RA-')), ['RA-C01', 'RA-C03', 'RA-C04', 'RA-C08']);
    assert.equal(b.vista.caso.estado_global, 'entrevista_completa');
    ev.paso(p, { entrada: 'Caso B: no existe informe', decision_motor: `ruta=${b.vista.caso.ruta}`, accion_resultante: `RA preguntadas: ${idsB.filter((x) => x.startsWith('RA-')).join(', ')}`, esperado: 'completa, explora lo escolar con el apoderado, no pregunta disponibilidad', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E03/E13 · las respuestas persisten entre turnos y sesiones; un caso interrumpido continúa en el punto exacto', async () => {
  const p = ev.prueba('E03-E13', 'Persistencia y recuperación', 'El expediente sobrevive al cierre del servidor y la entrevista continúa en la misma pregunta.');
  const dbPath = rutaDBTemporal();
  let api = await iniciarApp({ dbPath });
  const v = await crearCaso(api, 'interrumpido');
  const id = v.caso.id;
  for (let i = 0; i < 12; i++) await responder(api, id, respuestaPara);
  const antes = await vista(api, id);
  await api.cerrar();
  ev.paso(p, { entrada: 'Servidor detenido tras 12 respuestas', estado_antes: { turno: antes.caso.turno, pregunta: antes.caso.pregunta_actual.id, hechos: antes.hechos.length } });

  api = await iniciarApp({ dbPath });
  try {
    const despues = await vista(api, id);
    assert.equal(despues.caso.pregunta_actual.id, antes.caso.pregunta_actual.id);
    assert.equal(despues.caso.turno, antes.caso.turno);
    assert.equal(despues.hechos.length, antes.hechos.length);
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
    assert.equal(aud.respuestas.length, 12);
    ev.paso(p, { entrada: 'Servidor reiniciado', estado_despues: { turno: despues.caso.turno, pregunta: despues.caso.pregunta_actual.id, hechos: despues.hechos.length }, esperado: 'Mismo turno, misma pregunta, mismos hechos', ok: true });
    const fin = await entrevistar(api, id);
    assert.equal(fin.vista.caso.estado_global, 'esperando_informe_escolar');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E04 · la pregunta siguiente depende de la respuesta y del estado real del expediente', async () => {
  const p = ev.prueba('E04', 'Selección adaptativa', 'La misma pregunta con respuestas distintas produce siguientes pasos distintos (profundizar vs. avanzar).');
  const api = await iniciarApp();
  try {
    const sig = {};
    for (const op of ['A', 'B']) {
      const v = await crearCaso(api, `respuesta ${op}`);
      let q;
      do { q = (await vista(api, v.caso.id)).caso.pregunta_actual; if (q.id !== 'A09') await responder(api, v.caso.id, respuestaPara); } while (q.id !== 'A09');
      const r = await responder(api, v.caso.id, { opcion: op });
      sig[op] = r.traza.decision_motor.pregunta_id;
      ev.pasoDesdeTraza(p, r.traza, op === 'A' ? 'Profundiza R1.8 (frecuencia)' : 'Avanza a otro síntoma', true);
    }
    assert.equal(sig.A, 'R1.8-FRECUENCIA');
    assert.ok(!sig.B.startsWith('R1.8-'));
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E05 · no se repiten preguntas resueltas, ni equivalentes funcionales', async () => {
  const p = ev.prueba('E05', 'Sin repeticiones', 'Ninguna pregunta se formula dos veces y no se formulan dos preguntas de un mismo grupo de equivalencia funcional.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r = await entrevistar(api, v.caso.id, { respuesta: sinInforme });
    const lista = ids(r.turnos);
    assert.equal(new Set(lista).size, lista.length, 'sin preguntas repetidas');
    const prot = (await api.req('GET', '/api/protocolo')).body;
    assert.ok(prot.total_preguntas > 200);
    for (const [a, b] of [['A05', 'A26'], ['A27', 'A50']]) {
      assert.ok(!(lista.includes(a) && lista.includes(b)), `equivalencia ${a} ≡ ${b}`);
    }
    ev.paso(p, { entrada: `Entrevista completa (${lista.length} turnos)`, accion_resultante: `Preguntas únicas: ${new Set(lista).size}`, esperado: 'Sin repeticiones ni equivalentes', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E06 · profundiza un síntoma presente con un máximo de 3 preguntas (frecuencia, desde, contextos)', async () => {
  const p = ev.prueba('E06', 'Profundización acotada', 'Cada síntoma referido se caracteriza con ≤3 preguntas; los síntomas negados no se profundizan.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r = await entrevistar(api, v.caso.id, { respuesta: sinInforme });
    const lista = ids(r.turnos);
    for (const sid of ['R1.1', 'R1.2', 'R1.3', 'R1.8', 'R2.9']) {
      const prof = lista.filter((x) => x.startsWith(`${sid}-`));
      assert.deepEqual(prof, [`${sid}-FRECUENCIA`, `${sid}-DESDE`, `${sid}-CONTEXTOS`], sid);
    }
    for (const sid of ['R2.1', 'R2.5', 'R1.5']) assert.equal(lista.filter((x) => x.startsWith(`${sid}-`)).length, 0, sid);
    const e = r.vista.sintomas.find((s) => s.id === 'R1.8');
    assert.equal(e.estado, 'APOYADO POR EVIDENCIA');
    ev.paso(p, { entrada: 'Síntomas con «Sí»: ' + SINTOMAS_SI.join(', '), accion_resultante: `Profundizaciones: ${lista.filter((x) => /-(FRECUENCIA|DESDE|CONTEXTOS)$/.test(x)).length}`, esperado: '3 por síntoma referido, 0 en negados o desconocidos', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E07 · «no sé» y «no recuerdo» no se interpretan como negativas', async () => {
  const p = ev.prueba('E07', 'Incertidumbre ≠ negativa', 'Las respuestas de incertidumbre se registran como tales y el síntoma queda DESCONOCIDO.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    let q;
    do { q = (await vista(api, v.caso.id)).caso.pregunta_actual; if (q.id !== 'A01') await responder(api, v.caso.id, sinInforme); } while (q.id !== 'A01');
    const r = await responder(api, v.caso.id, { texto: 'La verdad no me acuerdo' });
    assert.equal(r.traza.interpretacion.estado_dato, 'no_recuerda');
    const e = r.vista.sintomas.find((s) => s.id === 'R1.1');
    assert.equal(e.estado, 'DESCONOCIDO');
    ev.pasoDesdeTraza(p, r.traza, 'R1.1 = DESCONOCIDO (no se registra como ausente)', true);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E08 · no se cierra la entrevista sin barrido diferencial ni tamizaje', async () => {
  const p = ev.prueba('E08', 'Gate de cierre (Etapa 9 §J.2)', 'PUEDE_CERRAR_ENTREVISTA solo es verdadero con barrido y tamizaje completos y sin ramas abiertas.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    let w = await vista(api, v.caso.id);
    while (w.caso.pregunta_actual && w.caso.pregunta_actual.id !== 'BARRIDO') { await responder(api, v.caso.id, sinInforme); w = await vista(api, v.caso.id); }
    assert.equal(w.caso.pregunta_actual.id, 'BARRIDO');
    const inf = await api.req('POST', `/api/casos/${v.caso.id}/informes`);
    assert.equal(inf.status, 409);
    const req = inf.body.detalle.requisitos.find((x) => x.id === 'entrevista_apoderado_cerrada');
    assert.match(req.detalle, /Barrido diferencial NO_REALIZADO/);
    ev.paso(p, { entrada: 'Intento de informe final antes del barrido', accion_resultante: `HTTP 409: ${req.detalle}`, esperado: 'Bloqueado', ok: true });
    const fin = await entrevistar(api, v.caso.id, { respuesta: sinInforme });
    assert.equal(fin.vista.estado.barrido, 'COMPLETADO');
    assert.ok(['COMPLETADO', 'COMPLETADO_CON_INCERTIDUMBRE'].includes(fin.vista.estado.tamizaje));
    assert.equal(fin.vista.caso.estado_global, 'entrevista_completa');
    ev.paso(p, { entrada: 'Barrido y tamizaje respondidos', accion_resultante: `barrido=${fin.vista.estado.barrido}; tamizaje=${fin.vista.estado.tamizaje}; estado=${fin.vista.caso.estado_global}`, esperado: 'Entrevista cerrada', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E09 · el tamizaje médico, sensorial y del sueño funciona sin duplicaciones', async () => {
  const p = ev.prueba('E09', 'Tamizaje (Etapa 9 §H.1)', 'El área «Sueño» del barrido deriva la categoría D del tamizaje; cada pregunta se formula una vez.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r = await entrevistar(api, v.caso.id, { respuesta: sinInforme });
    const lista = ids(r.turnos);
    const iB = lista.indexOf('BARRIDO'); const iT = lista.indexOf('TAMIZAJE');
    assert.ok(iB >= 0 && iT > iB, 'el tamizaje sigue al barrido');
    assert.ok(lista.some((x) => x.startsWith('BAR-C-')), 'rama Sueño del barrido');
    const tam = lista.filter((x) => x.startsWith('TAM-'));
    assert.ok(tam.length > 0 && tam.every((x) => x.startsWith('TAM-D-')), 'solo la categoría D');
    assert.ok(tam.length <= 3);
    assert.equal(new Set(tam).size, tam.length);
    assert.equal(r.vista.tamizaje.estado, 'COMPLETADO');
    ev.paso(p, { entrada: 'Barrido: C (Sueño); Tamizaje: D', accion_resultante: `Ramas: ${lista.filter((x) => /^(BAR|TAM)-/.test(x)).join(', ')}`, esperado: 'Sin duplicaciones; ≤3 preguntas por categoría', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E10 · los datos del informe escolar se conservan con su fuente y evidencia literal', async () => {
  const p = ev.prueba('E10', 'Informe escolar', 'La extracción conserva la frase literal y la fuente; la discrepancia entre fuentes se registra sin resolver.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    await entrevistar(api, v.caso.id);
    const r = await api.req('POST', `/api/casos/${v.caso.id}/informe-escolar`, { texto: INFORME_ESCOLAR });
    assert.equal(r.status, 200);
    assert.equal(r.body.metodo, 'reglas');
    for (const h of r.body.extraidos) assert.ok(INFORME_ESCOLAR.includes(h.evidencia), 'evidencia literal');
    const hechos = r.body.vista.hechos.filter((h) => h.fuente === 'informe_escolar');
    assert.ok(hechos.some((h) => h.dimension_id === 'R1.8' && h.valor === 'si'));
    assert.ok(r.body.contradicciones.some((c) => c.dimension_id === 'R2.9'), 'R2.9: apoderado Sí vs. colegio No');
    const col = r.body.vista.colegio;
    assert.ok(col.find((c) => c.id === 'C01').cubierta_por_informe, 'C01 cubierta por el informe → no se envía al colegio');
    ev.paso(p, { entrada: 'Informe escolar ficticio (7 frases)', accion_resultante: r.body.extraidos.map((h) => `${h.dimension_id}:${h.slot}=${h.valor}`).join('; '), esperado: 'Hechos con fuente informe_escolar y evidencia literal; discrepancia R2.9 registrada', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

// Pruebas E2E obligatorias del brief (§11) sobre el servidor HTTP real y SQLite.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, vista, responder, entrevistar, crearEvidencia, rutaDBTemporal } from './ayudantes.js';
import { respuestaPara, respuestaPorDefecto, INFORME_ESCOLAR } from '../fixtures/caso-ficticio.js';

const ev = crearEvidencia('entrevista');
after(() => ev.escribir());

const preguntadas = (turnos) => turnos.map((t) => t.pregunta.id);

test('E01 · la entrevista comienza en el orden establecido', async () => {
  const p = ev.prueba('E01', 'Orden inicial obligatorio', 'Motivo → edad → informe escolar → disponibilidad → ruta, antes de cualquier dimensión.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    assert.equal(v.caso.pregunta_actual.id, 'INI-MOTIVO');
    const orden = [];
    for (const t of ['Se distrae mucho', '9', 'sí', 'sí']) {
      const r = await responder(api, v.caso.id, t);
      orden.push(r.pregunta.id);
      ev.pasoDesdeTraza(p, r.traza, 'Siguiente paso de la secuencia inicial', true);
    }
    assert.deepEqual(orden, ['INI-MOTIVO', 'INI-EDAD', 'INI-INF-EXISTE', 'INI-INF-DISP']);
    const v2 = await vista(api, v.caso.id);
    assert.equal(v2.caso.ruta, 'con_informe');
    assert.ok(!v2.caso.pregunta_actual.id.startsWith('INI'), 'tras la fase inicial se pasa a dimensiones');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E02 · la ruta cambia según la existencia del informe escolar', async () => {
  const p = ev.prueba('E02', 'Ruta según informe escolar', 'Con informe: el hogar no explora lo escolar hasta tener el informe. Sin informe: ruta completa, sin preguntar disponibilidad.');
  const api = await iniciarApp();
  try {
    const conInf = await crearCaso(api, 'ruta con informe');
    const a = await entrevistar(api, conInf.caso.id);
    const idsA = preguntadas(a.turnos);
    assert.equal(a.vista.caso.ruta, 'con_informe');
    assert.ok(!idsA.some((x) => x.startsWith('ESC-')), 'no pregunta dimensiones escolares en el hogar');
    assert.equal(a.vista.caso.estado_global, 'esperando_informe_escolar');
    ev.paso(p, { entrada: 'Caso A: informe existe y está disponible', decision_motor: `ruta=${a.vista.caso.ruta}`, accion_resultante: `estado=${a.vista.caso.estado_global}; preguntas ESC formuladas: ${idsA.filter((x) => x.startsWith('ESC-')).length}`, esperado: 'con_informe, 0 preguntas escolares, espera el informe', ok: true });

    const sinInf = await crearCaso(api, 'ruta completa');
    const b = await entrevistar(api, sinInf.caso.id, { respuesta: (q) => (q.id === 'INI-INF-EXISTE' ? { texto: 'No, nunca nos han dado uno' } : respuestaPara(q)) });
    const idsB = preguntadas(b.turnos);
    assert.equal(b.vista.caso.ruta, 'completa');
    assert.ok(!idsB.includes('INI-INF-DISP'), 'no pregunta disponibilidad si no existe');
    assert.ok(idsB.includes('ESC-REND-P1') && idsB.includes('ESC-AULA-P1'), 'la ruta completa explora lo escolar en la entrevista');
    assert.equal(b.vista.caso.estado_global, 'entrevista_completa');
    ev.paso(p, { entrada: 'Caso B: no existe informe', decision_motor: `ruta=${b.vista.caso.ruta}`, accion_resultante: `ESC preguntadas: ${idsB.filter((x) => x.startsWith('ESC-')).join(', ')}`, esperado: 'completa, explora lo escolar, no pregunta disponibilidad', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E03/E13 · las respuestas persisten entre turnos y sesiones; un caso interrumpido continúa en el punto exacto', async () => {
  const p = ev.prueba('E03-E13', 'Persistencia y recuperación', 'El expediente sobrevive al cierre del servidor y la entrevista continúa en la misma pregunta.');
  const dbPath = rutaDBTemporal();
  let api = await iniciarApp({ dbPath });
  const v = await crearCaso(api, 'interrumpido');
  const id = v.caso.id;
  for (let i = 0; i < 7; i++) await responder(api, id, respuestaPara);
  const antes = await vista(api, id);
  await api.cerrar(); // «se cierra la aplicación»

  api = await iniciarApp({ dbPath }); // nueva sesión, mismo archivo de base de datos
  try {
    const despues = await vista(api, id);
    assert.deepEqual(despues.caso.pregunta_actual, antes.caso.pregunta_actual);
    assert.equal(despues.hechos.length, antes.hechos.length);
    assert.equal(despues.caso.turno, antes.caso.turno);
    ev.paso(p, { entrada: 'Cierre y reapertura del servidor', estado_antes: { turno: antes.caso.turno, pregunta: antes.caso.pregunta_actual.id, hechos: antes.hechos.length },
      estado_despues: { turno: despues.caso.turno, pregunta: despues.caso.pregunta_actual.id, hechos: despues.hechos.length }, esperado: 'Idénticos', ok: true });
    const r = await responder(api, id, respuestaPara);
    assert.equal(r.pregunta.id, antes.caso.pregunta_actual.id);
    ev.pasoDesdeTraza(p, r.traza, 'Continúa desde la pregunta pendiente antes de la interrupción', true);
    const fin = await entrevistar(api, id);
    const todas = (await api.req('GET', `/api/casos/${id}/auditoria`)).body.preguntas.map((x) => x.pregunta_id);
    assert.equal(new Set(todas).size, todas.length, 'ninguna pregunta repetida a pesar de la interrupción');
    ev.paso(p, { entrada: 'Se completa la entrevista tras la reapertura', accion_resultante: fin.vista.caso.estado_global, esperado: 'Sin repeticiones', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E04 · la pregunta siguiente depende de la respuesta y del estado real del expediente', async () => {
  const p = ev.prueba('E04', 'Adaptación a la respuesta', 'Misma pregunta, respuestas distintas → siguiente pregunta distinta.');
  const api = await iniciarApp();
  try {
    const hasta = async (etq) => {
      const v = await crearCaso(api, etq);
      for (let i = 0; i < 40; i++) {
        const w = await vista(api, v.caso.id);
        if (w.caso.pregunta_actual.id === 'HIP-MOT-P1') return v.caso.id;
        await responder(api, v.caso.id, (q) => (q.id.startsWith('INI') ? respuestaPara(q) : respuestaPorDefecto(q)));
      }
      throw new Error('no llegó a HIP-MOT-P1');
    };
    const a = await hasta('responde sí'); const b = await hasta('responde no');
    const ra = await responder(api, a, 'Sí, todo el tiempo');
    const rb = await responder(api, b, 'No');
    ev.pasoDesdeTraza(p, ra.traza, 'Profundiza en inquietud motora', ra.traza.decision_motor.pregunta_id === 'HIP-MOT-FRECUENCIA');
    ev.pasoDesdeTraza(p, rb.traza, 'Pasa a la siguiente dimensión pendiente', rb.traza.decision_motor.pregunta_id === 'IMP-ESPERA-P1');
    assert.equal(ra.traza.decision_motor.pregunta_id, 'HIP-MOT-FRECUENCIA');
    assert.equal(rb.traza.decision_motor.pregunta_id, 'IMP-ESPERA-P1');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E05 · no se repiten preguntas resueltas, ni con otra redacción', async () => {
  const p = ev.prueba('E05', 'Sin redundancia', 'Datos establecidos por mención, equivalencias funcionales y reformulaciones no se vuelven a preguntar.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r = await entrevistar(api, v.caso.id, { respuesta: (q) => (q.id === 'AUT-RUTINAS-P1' ? { texto: 'a veces' } : respuestaPara(q)) });
    const ids = preguntadas(r.turnos);
    assert.equal(new Set(ids).size, ids.length, 'ningún identificador repetido');
    assert.ok(!ids.includes('INA-SOST-P1'), 'la distracción ya estaba en el motivo de consulta: no se pregunta su presencia');
    assert.ok(!ids.includes('TAM-SUENO-P1'), 'el sueño ya estaba en el motivo: no se pregunta su presencia');
    assert.ok(ids.includes('INA-ORG-P1') && !ids.includes('AUT-RUTINAS-P2'), 'AUT-RUTINAS-P2 es equivalente a INA-ORG-P1');
    ev.paso(p, { entrada: `${ids.length} preguntas formuladas`, decision_motor: 'Motivo menciona distracción y sueño; AUT-RUTINAS ambigua', accion_resultante: `INA-SOST-P1 formulada: ${ids.includes('INA-SOST-P1')}; TAM-SUENO-P1: ${ids.includes('TAM-SUENO-P1')}; AUT-RUTINAS-P2: ${ids.includes('AUT-RUTINAS-P2')}`, esperado: 'false, false, false (sin repeticiones)', ok: true });

    const aud = (await api.req('GET', `/api/casos/${v.caso.id}/auditoria`)).body;
    const bloq = aud.decisiones.filter((d) => d.tipo === 'preguntas_bloqueadas').flatMap((d) => d.detalle.bloqueadas);
    // La propuesta de una reformulación es bloqueada por el validador
    const prop = await api.req('POST', `/api/casos/${v.caso.id}/propuestas`, { texto: '¿Necesita recordatorios para completar la tarea que comenzó?', origen: 'ia' });
    assert.equal(prop.body.ok, false);
    assert.ok(prop.body.reglas.some((x) => x.regla === 'no_equivalente' && !x.ok));
    ev.paso(p, { entrada: 'Propuesta externa: «¿Necesita recordatorios para completar la tarea que comenzó?»', decision_motor: 'Validador', accion_resultante: prop.body.reglas.filter((x) => !x.ok).map((x) => `${x.regla}: ${x.detalle}`).join(' | '), esperado: 'Bloqueada: no autorizada y equivalente', ok: true });
    ev.paso(p, { entrada: 'Bloqueos registrados por el motor durante la entrevista', accion_resultante: `${bloq.length} bloqueos`, ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E06 · profundiza cuando una dimensión importante sigue incompleta', async () => {
  const p = ev.prueba('E06', 'Profundización', 'Presencia referida → se caracterizan inmediatamente los datos esenciales; el límite se supera solo con justificación.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r = await entrevistar(api, v.caso.id);
    const ids = preguntadas(r.turnos);
    const i = ids.indexOf('INI-INF-DISP');
    assert.deepEqual(ids.slice(i + 1, i + 5), ['INA-SOST-FRECUENCIA', 'INA-SOST-CONTEXTOS', 'INA-SOST-INICIO', 'INA-SOST-IMPACTO']);
    const iO = ids.indexOf('INA-OLV-P2');
    assert.deepEqual(ids.slice(iO + 1, iO + 5), ['INA-OLV-FRECUENCIA', 'INA-OLV-CONTEXTOS', 'INA-OLV-INICIO', 'INA-OLV-IMPACTO']);
    const exceso = r.turnos.find((t) => /límite orientativo/.test(t.traza.decision_motor.justificacion || ''));
    assert.ok(exceso, 'se justificó superar el límite por dato esencial');
    ev.pasoDesdeTraza(p, r.turnos[i].traza, 'Tras la fase inicial, profundiza la conducta mencionada en el motivo', true);
    ev.pasoDesdeTraza(p, exceso.traza, 'Supera el límite con justificación explícita', true);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E07 · «no sé» y «no recuerdo» no se interpretan como negativas', async () => {
  const p = ev.prueba('E07', 'Incertidumbre', 'No sé / no recuerdo se registran como desconocidos, generan a lo sumo una alternativa y aparecen en el informe.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    for (const t of ['Problemas de conducta', '10', 'no', ]) await responder(api, v.caso.id, t);
    const r1 = await responder(api, v.caso.id, { tipo: 'no_se' }); // INA-SOST-P1
    assert.equal(r1.pregunta.id, 'INA-SOST-P1');
    assert.equal(r1.traza.interpretacion.estado_dato, 'no_sabe');
    assert.equal(r1.traza.decision_motor.pregunta_id, 'INA-SOST-P3');
    ev.pasoDesdeTraza(p, r1.traza, 'no_sabe y una única pregunta alternativa concreta', true);
    const r2 = await responder(api, v.caso.id, 'No me acuerdo, la verdad');
    assert.equal(r2.traza.interpretacion.estado_dato, 'no_recuerda');
    assert.equal(r2.traza.decision_motor.pregunta_id, 'INA-ORG-P1');
    assert.equal(r2.traza.estado_despues.dimensiones['INA-SOST'], 'parcial');
    ev.pasoDesdeTraza(p, r2.traza, 'no_recuerda; dimensión parcial (no «ausente»); continúa', true);
    const hechos = (await vista(api, v.caso.id)).hechos.filter((h) => h.dimension_id === 'INA-SOST');
    assert.ok(hechos.every((h) => h.valor !== 'no'));
    const inf = (await api.req('GET', `/api/casos/${v.caso.id}/informe`)).body.markdown;
    assert.match(inf, /Atención sostenida — Presencia: No recuerda/);
    ev.paso(p, { entrada: 'Informe borrador', accion_resultante: 'Lista «Atención sostenida — Presencia: No recuerda» entre los datos desconocidos', esperado: 'Incertidumbre visible, no negativa', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E08 · no se cierra la entrevista con dominios obligatorios sin explorar', async () => {
  const p = ev.prueba('E08', 'Cierre controlado', 'Mientras haya dimensiones obligatorias pendientes no hay cierre ni informe final.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const id = v.caso.id;
    for (let i = 0; i < 12; i++) {
      await responder(api, id, respuestaPara);
      const w = await vista(api, id);
      const pend = w.dimensiones.filter((d) => d.obligatoria && ['pendiente', 'en_curso'].includes(d.estado));
      if (pend.length) assert.ok(w.caso.pregunta_actual, 'con pendientes siempre hay pregunta');
      assert.ok(!['entrevista_completa'].includes(w.caso.estado_global));
    }
    const r = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(r.status, 409);
    ev.paso(p, { entrada: 'Solicitud de informe final a mitad de entrevista', accion_resultante: `HTTP ${r.status}: ${r.body.error}`, esperado: '409 y lista de requisitos pendientes', ok: true,
      estado_despues: r.body.detalle.requisitos.filter((x) => !x.cumplido).map((x) => x.id) });
    const fin = await entrevistar(api, id);
    assert.ok(fin.vista.dimensiones.filter((d) => d.obligatoria).every((d) => ['resuelta', 'parcial', 'no_aplica', 'pendiente_informe'].includes(d.estado)));
    ev.paso(p, { entrada: 'Fin de la entrevista del hogar', accion_resultante: fin.vista.caso.estado_global, esperado: 'Solo se detiene cuando lo único pendiente es el informe escolar', ok: fin.vista.caso.estado_global === 'esperando_informe_escolar' });
    assert.equal(fin.vista.caso.estado_global, 'esperando_informe_escolar');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E09 · el tamizaje médico, sensorial y del sueño funciona sin duplicaciones', async () => {
  const p = ev.prueba('E09', 'Tamizaje diferencial', 'Abre solo las ramas que corresponden, sin duplicar, y distingue ausente / presente / desconocido / requiere verificación.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r = await entrevistar(api, v.caso.id, { respuesta: (q) => (q.id === 'TAM-VISION-P1' ? { tipo: 'no_se' } : respuestaPara(q)) });
    const tam = preguntadas(r.turnos).filter((x) => x.startsWith('TAM-'));
    assert.equal(new Set(tam).size, tam.length);
    assert.deepEqual(tam.filter((x) => x.startsWith('TAM-SUENO')), ['TAM-SUENO-DESCRIPCION', 'TAM-SUENO-EVALUADO_PROFESIONAL']);
    assert.ok(!tam.some((x) => x.startsWith('TAM-AUDICION-') && x !== 'TAM-AUDICION-P1'), 'audición ausente: no se abren ramas');
    const inf = (await api.req('GET', `/api/casos/${v.caso.id}/informe`)).body.markdown;
    assert.match(inf, /\*\*Sueño:\*\* Situación presente: .*Requiere verificación profesional/);
    assert.match(inf, /\*\*Visión:\*\* Información desconocida .*Requiere verificación profesional/);
    assert.match(inf, /\*\*Audición:\*\* Situación no referida\./);
    ev.paso(p, { entrada: 'Sueño mencionado en el motivo; visión «no sé»; audición «no»', accion_resultante: `Preguntas de tamizaje: ${tam.join(', ')}`, esperado: 'Sueño: sin repetir presencia; ramas solo donde corresponde', ok: true });
    ev.paso(p, { entrada: 'Sección 7 del informe', accion_resultante: inf.split('## 7.')[1].split('## 8.')[0].trim(), ok: true });
    assert.equal(r.vista.dimensiones.filter((d) => d.dominio === 'tamizaje').length, 4);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E10 · los datos del informe escolar se conservan con su fuente y evitan preguntas redundantes', async () => {
  const p = ev.prueba('E10', 'Informe escolar', 'Extracción estructurada con fuente y evidencia; el hogar solo cubre vacíos.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api);
    const r1 = await entrevistar(api, v.caso.id);
    assert.equal(r1.vista.caso.estado_global, 'esperando_informe_escolar');
    const inf = await api.req('POST', `/api/casos/${v.caso.id}/informe-escolar`, { texto: INFORME_ESCOLAR });
    assert.equal(inf.status, 200);
    const escolares = inf.body.vista.hechos.filter((h) => h.fuente === 'informe_escolar');
    assert.ok(escolares.length >= 4);
    assert.ok(escolares.every((h) => h.evidencia && INFORME_ESCOLAR.includes(h.evidencia)), 'cada dato con su frase literal');
    ev.paso(p, { entrada: 'Carga del informe escolar ficticio', accion_resultante: escolares.map((h) => `${h.dimension_id}.${h.slot}=${h.valor}`).join('; '), esperado: 'Hechos con fuente informe_escolar y evidencia literal', ok: true });
    // ESC-REND resuelto por el informe; ESC-AULA no aparece → vacío relevante que se pregunta en el hogar
    assert.equal(inf.body.resultado.pregunta?.id, 'ESC-AULA-P1');
    assert.match(inf.body.resultado.pregunta.justificacion, /vacío relevante/);
    ev.paso(p, { entrada: 'Motor tras el informe', decision_motor: inf.body.resultado.pregunta.justificacion, accion_resultante: `Pregunta: ${inf.body.resultado.pregunta.texto}`, esperado: 'Solo se pregunta lo que el informe no resolvió', ok: true });
    const r2 = await entrevistar(api, v.caso.id);
    assert.ok(!preguntadas(r2.turnos).includes('ESC-REND-P1'));
    assert.equal(r2.vista.caso.estado_global, 'entrevista_completa');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

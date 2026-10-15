// E11–E12 y casos adversos: ambigüedad, contradicciones, equivalencias, errores de API,
// datos faltantes y entradas inválidas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, vista, responder, entrevistar, crearEvidencia } from './ayudantes.js';
import { respuestaPara, INFORME_ESCOLAR, INSTRUMENTOS, INTERPRETACION } from '../fixtures/caso-ficticio.js';
import { crearClienteIA } from '../../src/ia.js';

const ev = crearEvidencia('informe-y-adversos');
after(() => ev.escribir());

async function casoCompleto(api) {
  const v = await crearCaso(api);
  const id = v.caso.id;
  await entrevistar(api, id);
  await api.req('POST', `/api/casos/${id}/informe-escolar`, { texto: INFORME_ESCOLAR });
  await entrevistar(api, id);
  return id;
}

test('E11 · el informe final refleja los datos reales y las incertidumbres', async () => {
  const p = ev.prueba('E11', 'Informe desde el expediente', 'Cada sección proviene del expediente; incertidumbres y contradicciones visibles; sin interpretación automática.');
  const api = await iniciarApp();
  try {
    const id = await casoCompleto(api);
    for (const i of INSTRUMENTOS) assert.equal((await api.req('POST', `/api/casos/${id}/evaluaciones`, i)).status, 200);
    let v = await vista(api, id);
    const contr = v.contradicciones;
    assert.equal(contr.length, 1, 'inquietud motora: apoderado «no» vs informe «sí»');
    ev.paso(p, { entrada: 'Apoderado: HIP-MOT «No»; informe: «Es inquieto»', accion_resultante: contr[0].descripcion, esperado: 'Contradicción registrada sin resolverla', ok: true });
    for (const c of contr) await api.req('POST', `/api/casos/${id}/contradicciones/${c.id}/revision`, { nota: 'Discrepancia entre contextos; se mantiene para la integración clínica.', profesional: 'Profesional de prueba' });
    await api.req('PUT', `/api/casos/${id}/interpretacion`, { texto: INTERPRETACION, profesional: 'Profesional de prueba' });
    v = await vista(api, id);
    assert.equal(v.requisitos.completo, true, JSON.stringify(v.requisitos.requisitos.filter((r) => !r.cumplido)));
    const fin = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(fin.status, 200);
    const md = fin.body.markdown;
    // Datos literales del expediente
    assert.ok(md.includes('Desde primero básico se distrae mucho en clases'), 'motivo literal');
    assert.match(md, /\*\*Edad:\*\* 8 años/);
    assert.match(md, /«Presenta notas bajas en Lenguaje y Matemática durante el primer semestre\.»/, 'evidencia del informe escolar');
    assert.match(md, /Inatención \(ficticio\):\*\* 21\/27/, 'resultado de instrumento');
    assert.match(md, /Organización y finalización de tareas — Inicio: No recuerda/);
    assert.match(md, /Inquietud motora: «presencia» registrado como «no» \(fuente: apoderado\) y luego como «si» \(fuente: informe_escolar\)\. — revisada por Profesional de prueba/);
    assert.match(md, /Instrumento no realizado: Tarea de realidad virtual del proyecto \(opcional\)/);
    assert.match(md, /no determinan por sí solos un diagnóstico/);
    assert.match(md, /\*\*Presencia:\*\* Sí _\(respuesta inicial: respuesta ambigua; aclarada después\)_/, 'olvidos: ambigüedad aclarada');
    assert.ok(md.includes(INTERPRETACION), 'la interpretación es la del profesional, sin agregados');
    assert.match(md, /FINAL — PENDIENTE DE VALIDACIÓN/);
    // Nada inventado: todo valor de la sección del apoderado existe en el expediente
    const valores = new Set(v.hechos.map((h) => h.valor).filter(Boolean));
    const sec2 = md.split('## 2.')[1].split('## 3.')[0];
    for (const m of sec2.matchAll(/^- \*\*[^*]+:\*\* (.+)$/gm)) {
      const limpio = m[1].replace(/ _\(.*\)_$/, '');
      const val = limpio === 'Sí' ? 'si' : limpio === 'No' ? 'no' : limpio;
      if (['No sabe', 'No recuerda', 'Respuesta ambigua'].includes(val)) continue;
      assert.ok(valores.has(val), `valor no presente en el expediente: ${val}`);
    }
    ev.paso(p, { entrada: 'Generación del informe final', accion_resultante: 'Motivo literal, edad, evidencia escolar, instrumentos, «No recuerda», contradicción revisada, RV pendiente', esperado: 'Todo trazable al expediente', ok: true });
    const val = await api.req('POST', `/api/casos/${id}/informes/${fin.body.id}/validacion`, { profesional: 'Profesional de prueba' });
    assert.equal(val.status, 200);
    assert.match(val.body.markdown, /VALIDADO por Profesional de prueba/);
    assert.equal((await vista(api, id)).caso.estado_global, 'validado');
    ev.paso(p, { entrada: 'Validación profesional', accion_resultante: 'Estado: validado', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('E12 · el sistema bloquea preguntas no autorizadas e informes prematuros', async () => {
  const p = ev.prueba('E12', 'Bloqueos', 'Preguntas fuera del banco, fuera de orden, dobles o equivalentes; respuestas a una pregunta no vigente; informe prematuro.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const casos = [
      ['Inventada', { texto: '¿Su hijo tiene TDAH?' }, 'autorizada'],
      ['Fuera de orden (dimensión durante la fase inicial)', { pregunta_id: 'HIP-MOT-P1', texto: '¿Le cuesta quedarse quieto en situaciones en que se espera que lo esté, como en la mesa o en clases?' }, 'orden_inicial'],
      ['Texto alterado de una pregunta autorizada', { pregunta_id: 'INI-MOTIVO', texto: '¿Por qué vino y qué edad tiene?' }, 'autorizada'],
      ['Doble pregunta', { texto: '¿Se distrae? ¿Y duerme bien?' }, 'una_sola_pregunta'],
    ];
    for (const [nombre, cuerpo, regla] of casos) {
      const r = await api.req('POST', `/api/casos/${id}/propuestas`, cuerpo);
      assert.equal(r.body.ok, false, nombre);
      assert.ok(r.body.reglas.some((x) => x.regla === regla && !x.ok), `${nombre} → ${regla}`);
      assert.equal(r.body.pregunta_vigente.id, 'INI-MOTIVO', 'la pregunta vigente no cambia');
      ev.paso(p, { entrada: `${nombre}: «${cuerpo.texto}»`, decision_motor: 'Validador', accion_resultante: r.body.reglas.filter((x) => !x.ok).map((x) => `${x.regla}: ${x.detalle}`).join(' | '), esperado: `Bloqueada (${regla})`, ok: true });
    }
    const otra = await api.req('POST', `/api/casos/${id}/respuestas`, { pregunta_id: 'INI-EDAD', texto: '9' });
    assert.equal(otra.status, 409);
    ev.paso(p, { entrada: 'Respuesta enviada para INI-EDAD cuando la vigente es INI-MOTIVO', accion_resultante: `HTTP ${otra.status}`, esperado: 'Rechazada', ok: true });
    const inf = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(inf.status, 409);
    assert.equal(inf.body.detalle.completo, false);
    ev.paso(p, { entrada: 'Informe final al inicio', accion_resultante: `HTTP ${inf.status}: ${inf.body.error}`, estado_despues: inf.body.detalle.requisitos.filter((x) => !x.cumplido).map((x) => x.id), esperado: 'Bloqueado con lista de faltantes', ok: true });
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body.decisiones.map((d) => d.tipo);
    assert.ok(aud.includes('propuesta_bloqueada') && aud.includes('informe_final_bloqueado') && aud.includes('respuesta_rechazada'));
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A1 · respuestas ambiguas: se aclara con una pregunta más específica, sin suponer', async () => {
  const p = ev.prueba('A1', 'Ambigüedad', '«A veces» no se convierte en sí ni en no.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    for (const t of ['Consulta general', '7', 'no']) await responder(api, id, t);
    await responder(api, id, 'No'); await responder(api, id, 'No'); // INA-SOST, INA-ORG
    const r1 = await responder(api, id, 'Depende del día'); // INA-OLV-P1
    assert.equal(r1.traza.interpretacion.estado_dato, 'ambiguo');
    assert.equal(r1.traza.decision_motor.pregunta_id, 'INA-OLV-P2');
    ev.pasoDesdeTraza(p, r1.traza, 'Pregunta más específica del mismo dato', true);
    const r2 = await responder(api, id, 'Más o menos');
    assert.equal(r2.traza.estado_despues.dimensiones['INA-OLV'], 'parcial');
    assert.equal(r2.traza.decision_motor.pregunta_id, 'HIP-MOT-P1');
    ev.pasoDesdeTraza(p, r2.traza, 'Sin más preguntas específicas: queda parcial (ambigua) y avanza', true);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A2 · contradicción dentro de la misma fuente: se registra y bloquea el informe hasta su revisión', async () => {
  const p = ev.prueba('A2', 'Contradicción', 'Datos que se contradicen no se resuelven por suposición.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    await responder(api, id, 'Consulta'); await responder(api, id, '9');
    await responder(api, id, 'no'); // no existe informe → ruta completa
    // Datos estructurados del colegio que contradicen la edad no aplican; usamos un dato de dimensión:
    const r = await responder(api, id, 'Sí, mucho'); // INA-SOST-P1 = sí
    ev.pasoDesdeTraza(p, r.traza, 'Presencia sí', true);
    const manual = await api.req('POST', `/api/casos/${id}/informe-escolar`, { hechos: [{ dimension_id: 'INA-SOST', slot: 'presencia', valor: 'no', evidencia: 'Mantiene la atención durante toda la clase.' }] });
    assert.equal(manual.status, 200);
    assert.equal(manual.body.contradicciones.length, 1);
    const w = await vista(api, id);
    assert.equal(w.dimensiones.find((d) => d.id === 'INA-SOST').slots.presencia.estado, 'contradiccion');
    assert.equal(w.requisitos.requisitos.find((x) => x.id === 'contradicciones_revisadas').cumplido, false);
    ev.paso(p, { entrada: 'Extracción estructurada contradictoria (presencia «no» con evidencia)', accion_resultante: manual.body.contradicciones[0].descripcion, estado_despues: 'Presencia: contradicción; requisito contradicciones_revisadas = false', esperado: 'Registrada, no resuelta', ok: true });
    const sinNota = await api.req('POST', `/api/casos/${id}/contradicciones/${manual.body.contradicciones[0].id}/revision`, { profesional: 'X' });
    assert.equal(sinNota.status, 400);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A3 · error de la API de IA: contingencia con el intérprete de reglas, sin perder la respuesta', async () => {
  const p = ev.prueba('A3', 'Error de API', 'Caída, tiempo agotado o JSON inválido de la IA no detienen la entrevista ni corrompen el expediente.');
  const fallos = [
    ['red caída', async () => { throw new Error('ECONNRESET'); }],
    ['HTTP 529', async () => new Response('sobrecargado', { status: 529 })],
    ['JSON inválido', async () => Response.json({ content: [{ type: 'text', text: 'no es json' }] })],
    ['clasificación fuera de esquema', async () => Response.json({ content: [{ type: 'text', text: '{"clasificacion":"quizas"}' }] })],
  ];
  for (const [nombre, fetchImpl] of fallos) {
    const ia = crearClienteIA({ apiKey: 'clave-de-prueba', fetchImpl, timeoutMs: 500 });
    const api = await iniciarApp({ ia });
    try {
      const v = await crearCaso(api); const id = v.caso.id;
      const r = await responder(api, id, 'Se distrae mucho');
      assert.ok(r.traza.error_api, nombre);
      assert.equal(r.traza.interpretacion.interprete, 'reglas (contingencia)');
      assert.equal(r.traza.decision_motor.pregunta_id, 'INI-EDAD', 'la entrevista continúa');
      const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
      assert.equal(aud.errores.length, 1);
      assert.equal(aud.respuestas[0].texto_original, 'Se distrae mucho');
      ev.pasoDesdeTraza(p, r.traza, `Falla «${nombre}» → contingencia y error auditado (${r.traza.error_api})`, true);
    } finally { await api.cerrar(); }
  }
  ev.cerrar(p, true);
});

test('A4 · IA disponible: solo interpreta; menciones con dimensiones inválidas se descartan', async () => {
  const p = ev.prueba('A4', 'IA acotada', 'La IA clasifica y detecta menciones, pero no elige preguntas; su salida se valida.');
  let llamadas = 0;
  const fetchImpl = async (_url, init) => {
    llamadas++;
    const cuerpo = JSON.parse(init.body);
    assert.match(cuerpo.system, /Nunca selecciones, inventes ni reformules preguntas/);
    return Response.json({ content: [{ type: 'text', text: JSON.stringify({ clasificacion: 'valor', valor: 'Le cuesta concentrarse', menciones: [{ dimension_id: 'HIP-MOT', evidencia: 'no para quieto' }, { dimension_id: 'INVENTADA', evidencia: 'x' }] }) }] });
  };
  const api = await iniciarApp({ ia: crearClienteIA({ apiKey: 'k', fetchImpl }) });
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const r = await responder(api, id, 'Le cuesta concentrarse y no para quieto');
    assert.equal(llamadas, 1);
    assert.equal(r.traza.interpretacion.interprete, 'ia');
    assert.deepEqual(r.traza.interpretacion.menciones.map((m) => m.dimension_id), ['HIP-MOT']);
    assert.equal(r.traza.decision_motor.pregunta_id, 'INI-EDAD', 'el orden lo sigue fijando el motor');
    ev.pasoDesdeTraza(p, r.traza, 'Mención válida registrada; dimensión inventada descartada; siguiente pregunta la decide el motor', true);
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
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
      ['Instrumento fuera del protocolo', await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'OTRO', estado: 'realizada', fecha: '2026-10-01' }), 400],
      ['Realizada sin fecha', await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'NESPLORA', estado: 'realizada' }), 400],
      ['No aplica sin justificación', await api.req('POST', `/api/casos/${id}/evaluaciones`, { instrumento_id: 'ESCALA-DOCENTE', estado: 'no_aplica' }), 400],
      ['Cambio de ruta antes de la fase inicial', await api.req('POST', `/api/casos/${id}/ruta`, { ruta: 'completa', motivo: 'x' }), 409],
      ['Interpretación sin profesional', await api.req('PUT', `/api/casos/${id}/interpretacion`, { texto: 'x' }), 400],
      ['Informe escolar vacío', await api.req('POST', `/api/casos/${id}/informe-escolar`, { texto: '' }), 400],
      ['Extracción manual sin evidencia', await api.req('POST', `/api/casos/${id}/informe-escolar`, { hechos: [{ dimension_id: 'INA-SOST', slot: 'presencia', valor: 'si' }] }), 400],
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
  const p = ev.prueba('A6', 'Cambio de ruta', 'Si el informe anunciado no llega, el profesional cambia la ruta y la entrevista cubre lo escolar.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const r = await entrevistar(api, id);
    assert.equal(r.vista.caso.estado_global, 'esperando_informe_escolar');
    const c = await api.req('POST', `/api/casos/${id}/ruta`, { ruta: 'completa', motivo: 'El colegio no entregará el informe' });
    assert.equal(c.status, 200);
    assert.ok(c.body.resultado.pregunta.id.startsWith('ESC-'));
    ev.paso(p, { entrada: 'Cambio de ruta a «completa» con motivo', decision_motor: c.body.resultado.pregunta.justificacion, accion_resultante: `Pregunta: ${c.body.resultado.pregunta.texto}`, esperado: 'Se exploran las dimensiones escolares en la entrevista', ok: true });
    const fin = await entrevistar(api, id);
    assert.equal(fin.vista.caso.estado_global, 'entrevista_completa');
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

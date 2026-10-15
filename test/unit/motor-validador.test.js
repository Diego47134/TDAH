// Motor (Etapa 9) y validador: orden inicial, rutas, activación inmediata, profundización
// máxima de 3, equivalencias, barrido, tamizaje y gate de cierre.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { abrirDB } from '../../src/db.js';
import { cargarProtocolo, compilarProtocolo, PROTOCOLO_POR_DEFECTO } from '../../src/protocolo.js';
import { crearServicio } from '../../src/servicio.js';
import { similitud } from '../../src/validador.js';
import { respuestaPara, CONSENTIMIENTO } from '../fixtures/caso-ficticio.js';

const P = cargarProtocolo();
const nuevo = () => crearServicio({ db: abrirDB(':memory:'), protocolo: P });

/** Responde con `fijo[id]` o con la respuesta por defecto del guion hasta `hasta(q)`. */
async function avanzar(s, v, fijo = {}, hasta = () => false, max = 250) {
  for (let i = 0; i < max && v.caso.pregunta_actual; i++) {
    const q = v.caso.pregunta_actual;
    if (hasta(q)) return v;
    const r = fijo[q.id] ?? (typeof fijo.def === 'function' ? fijo.def(q) : null) ?? respuestaPara(q);
    v = (await s.responder(v.caso.id, { pregunta_id: q.id, ...r })).vista;
  }
  return v;
}
const INICIO_SIN_INFORME = { 'INI-MOTIVO': { texto: 'Consulta por dificultades generales.' }, 'INI-EDAD': { texto: '9' }, 'INI-INF-EXISTE': { opcion: 'B' } };

test('protocolo vigente: 18 síntomas, alternativas obligatorias y validación referencial', () => {
  assert.equal(P.estado, 'VIGENTE');
  assert.equal(P.sintomas.length, 18);
  assert.equal(P.fuentes.length, 3);
  for (const q of P.preguntas.values()) {
    if (q.tipo === 'presencia') assert.equal(q.opciones.length, 4, q.id);
  }
  const crudo = JSON.parse(fs.readFileSync(PROTOCOLO_POR_DEFECTO, 'utf8'));
  const malo = structuredClone(crudo); malo.sintomas[0].preguntas = ['NO-EXISTE'];
  assert.throws(() => compilarProtocolo(malo), /preguntas inexistentes/);
  const malo2 = structuredClone(crudo); malo2.alternativas.presencia.pop();
  assert.throws(() => compilarProtocolo(malo2), /SÍ \/ NO \/ OCASIONALMENTE/);
});

test('fase inicial: orden estricto motivo → edad → informe escolar → disponibilidad', async () => {
  const s = nuevo();
  let v = s.crearCaso({ consentimiento: CONSENTIMIENTO });
  const orden = [];
  v = await avanzar(s, v, { 'INI-INF-EXISTE': { opcion: 'A' }, 'INI-INF-DISP': { opcion: 'A' } }, (q) => { orden.push(q.id); return !q.id.startsWith('INI-'); });
  assert.deepEqual(orden.slice(0, 4), ['INI-MOTIVO', 'INI-EDAD', 'INI-INF-EXISTE', 'INI-INF-DISP']);
});

test('fase inicial: la disponibilidad solo se pregunta si el informe existe', async () => {
  const s = nuevo();
  const orden = [];
  await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => { orden.push(q.id); return !q.id.startsWith('INI-'); });
  assert.ok(!orden.includes('INI-INF-DISP'));
});

test('ruta: disponible → Ruta B (con_informe); no existe / no sabe / no disponible → Ruta A (completa)', async () => {
  const casos = [
    [{ 'INI-INF-EXISTE': { opcion: 'A' }, 'INI-INF-DISP': { opcion: 'A' } }, 'con_informe'],
    [{ 'INI-INF-EXISTE': { opcion: 'A' }, 'INI-INF-DISP': { opcion: 'B' } }, 'completa'],
    [{ 'INI-INF-EXISTE': { opcion: 'B' } }, 'completa'],
    [{ 'INI-INF-EXISTE': { opcion: 'C' } }, 'completa'],
  ];
  for (const [fijo, esperada] of casos) {
    const s = nuevo();
    const v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), fijo, (q) => !q.id.startsWith('INI-'));
    assert.equal(v.estado.ruta, esperada, JSON.stringify(fijo));
  }
});

test('activación inmediata (Etapa 9 §14.2): una conducta mencionada en el motivo se caracteriza primero', async () => {
  const s = nuevo();
  const v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), { ...INICIO_SIN_INFORME, 'INI-MOTIVO': { texto: 'Interrumpe todo el tiempo a los demás.' } }, (q) => !q.id.startsWith('INI-'));
  assert.equal(v.caso.pregunta_actual.id, 'A19'); // R2.9 «interrumpe»
  assert.match(v.caso.pregunta_actual.justificacion, /Activación inmediata/);
});

test('profundización: con presencia «Sí» se preguntan como máximo frecuencia, desde y contextos', async () => {
  const s = nuevo();
  const vistas = [];
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), { ...INICIO_SIN_INFORME, 'INI-MOTIVO': { texto: 'Se distrae mucho.' } }, (q) => !q.id.startsWith('INI-'));
  assert.equal(v.caso.pregunta_actual.id, 'A09');
  v = (await s.responder(v.caso.id, { pregunta_id: 'A09', opcion: 'A' })).vista;
  for (let i = 0; i < 3; i++) { vistas.push(v.caso.pregunta_actual.id); v = (await s.responder(v.caso.id, { pregunta_id: v.caso.pregunta_actual.id, ...respuestaPara(v.caso.pregunta_actual) })).vista; }
  assert.deepEqual(vistas, ['R1.8-FRECUENCIA', 'R1.8-DESDE', 'R1.8-CONTEXTOS']);
  assert.ok(!v.caso.pregunta_actual.id.startsWith('R1.8-'), 'no hay una cuarta pregunta sobre el mismo síntoma');
  assert.equal(v.sintomas.find((x) => x.id === 'R1.8').estado, 'APOYADO POR EVIDENCIA');
});

test('ausencia: con «No» no se profundiza el síntoma', async () => {
  const s = nuevo();
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => !q.id.startsWith('INI-'));
  const q1 = v.caso.pregunta_actual;
  v = (await s.responder(v.caso.id, { pregunta_id: q1.id, opcion: 'B' })).vista;
  assert.ok(!/-FRECUENCIA$/.test(v.caso.pregunta_actual.id));
});

test('«No sabe / No recuerda» no es negativa: el síntoma queda DESCONOCIDO, no NO REFERIDO', async () => {
  const s = nuevo();
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => !q.id.startsWith('INI-'));
  const q1 = v.caso.pregunta_actual; // A01 → R1.1
  assert.equal(q1.id, 'A01');
  v = (await s.responder(v.caso.id, { pregunta_id: 'A01', opcion: 'D' })).vista;
  const e = v.sintomas.find((x) => x.id === 'R1.1');
  assert.equal(e.estado, 'DESCONOCIDO');
  assert.notEqual(e.estado, 'NO REFERIDO');
  assert.ok(!v.caso.pregunta_actual.id.startsWith('R1.1-'));
});

test('validador: bloquea preguntas externas, repetidas, reformuladas y equivalentes', async () => {
  const s = nuevo();
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => !q.id.startsWith('INI-'));
  const id = v.caso.id;
  const externa = s.proponerPregunta(id, { texto: '¿Cuál es su color favorito?' });
  assert.equal(externa.ok, false);
  assert.ok(externa.reglas.some((r) => r.regla === 'pertenece_al_proyecto' && !r.ok));
  const doble = s.proponerPregunta(id, { texto: '¿Se distrae? ¿Y olvida cosas?' });
  assert.ok(doble.reglas.some((r) => r.regla === 'una_sola_pregunta' && !r.ok));
  const rep = s.proponerPregunta(id, { pregunta_id: 'INI-EDAD', texto: P.preguntas.get('INI-EDAD').texto });
  assert.equal(rep.ok, false);
  const reform = s.proponerPregunta(id, { texto: '¿Qué está ocurriendo actualmente que motivó la evaluación?' });
  assert.equal(reform.ok, false, 'reformulación del motivo ya resuelto');
  // Equivalencia funcional EQ-TERMINAR (A05 ≡ A26)
  v = await avanzar(s, v, { A04: { opcion: 'D' } }, (q) => q.id === 'A05');
  assert.equal(v.caso.pregunta_actual?.id, 'A05');
  v = (await s.responder(id, { pregunta_id: 'A05', opcion: 'A' })).vista;
  const eq = s.proponerPregunta(id, { pregunta_id: 'A26', texto: P.preguntas.get('A26').texto });
  assert.equal(eq.ok, false);
  assert.ok(eq.reglas.some((r) => !r.ok && /equivalen/i.test(r.detalle)));
  assert.equal(s.vista(id).caso.pregunta_actual.id, v.caso.pregunta_actual.id, 'la propuesta no cambia la pregunta vigente');
});

test('similitud textual detecta reformulaciones', () => {
  assert.ok(similitud('¿Se distrae con facilidad?', '¿Se distrae fácilmente?') >= 0.5);
  assert.ok(similitud('¿Se distrae con facilidad?', '¿Cuántos hermanos tiene?') < 0.2);
});

test('barrido diferencial: el tamizaje no se adelanta al barrido y «Sueño» deriva la categoría D', async () => {
  const s = nuevo();
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => q.id === 'BARRIDO' || q.id === 'TAMIZAJE');
  assert.equal(v.caso.pregunta_actual.id, 'BARRIDO');
  const adelantado = s.proponerPregunta(v.caso.id, { pregunta_id: 'TAMIZAJE', texto: P.preguntas.get('TAMIZAJE').texto });
  assert.equal(adelantado.ok, false);
  v = (await s.responder(v.caso.id, { pregunta_id: 'BARRIDO', opciones: ['C'] })).vista;
  assert.equal(v.caso.pregunta_actual.id, 'BAR-C-1');
  v = await avanzar(s, v, { 'BAR-C-1': { opcion: 'A' } }, (q) => q.id === 'TAMIZAJE');
  v = (await s.responder(v.caso.id, { pregunta_id: 'TAMIZAJE', opciones: ['J'] })).vista; // «Ninguna» no anula lo derivado
  assert.match(v.caso.pregunta_actual?.id ?? '', /^TAM-D-/);
});

test('gate de cierre: no cierra con barrido pendiente; cierra con barrido y tamizaje completos', async () => {
  const s = nuevo();
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => q.id === 'BARRIDO');
  assert.equal(v.caso.estado_global, 'entrevista');
  assert.equal(v.requisitos.requisitos.find((r) => r.id === 'entrevista_apoderado_cerrada').cumplido, false);
  v = await avanzar(s, v, { BARRIDO: { opciones: ['M'] }, TAMIZAJE: { opciones: ['J'] } });
  assert.equal(v.caso.pregunta_actual, null);
  assert.equal(v.caso.estado_global, 'entrevista_completa');
  assert.equal(v.estado.barrido, 'COMPLETADO');
  assert.equal(v.estado.tamizaje, 'COMPLETADO');
  assert.equal(v.requisitos.requisitos.find((r) => r.id === 'entrevista_apoderado_cerrada').cumplido, true);
});

test('tamizaje con «No sabe» queda COMPLETADO_CON_INCERTIDUMBRE (no se interpreta como ausencia)', async () => {
  const s = nuevo();
  const v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), { ...INICIO_SIN_INFORME, BARRIDO: { opciones: ['M'] }, TAMIZAJE: { opciones: ['K'] } });
  assert.equal(v.estado.tamizaje, 'COMPLETADO_CON_INCERTIDUMBRE');
});

test('«Ocasionalmente»: se registra y se evalúa la profundización cuantificando solo la frecuencia (Etapa 9 §6.2)', async () => {
  const s = nuevo();
  let v = await avanzar(s, s.crearCaso({ consentimiento: CONSENTIMIENTO }), INICIO_SIN_INFORME, (q) => !q.id.startsWith('INI-'));
  assert.equal(v.caso.pregunta_actual.id, 'A01');
  v = (await s.responder(v.caso.id, { pregunta_id: 'A01', opcion: 'C' })).vista;
  assert.equal(v.caso.pregunta_actual.id, 'R1.1-FRECUENCIA');
  v = (await s.responder(v.caso.id, { pregunta_id: 'R1.1-FRECUENCIA', opcion: 'D' })).vista;
  assert.ok(!v.caso.pregunta_actual.id.startsWith('R1.1-'), 'no se convierte en una batería de preguntas');
  assert.equal(v.sintomas.find((x) => x.id === 'R1.1').estado, 'POSIBLE');
});

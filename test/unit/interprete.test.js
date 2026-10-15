// Intérprete de respuestas (Etapa 9 §G): alternativas autorizadas, «no sé/no recuerdo» nunca
// como negativa, ambigüedad sin suposiciones y menciones espontáneas con negación.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cargarProtocolo } from '../../src/protocolo.js';
import { interpretarRespuesta, detectarMenciones, ErrorEntrada } from '../../src/interprete.js';

const P = cargarProtocolo();
const Q = (id) => P.preguntas.get(id);

test('presencia: los códigos A–D corresponden a Sí / No / Ocasionalmente / No sabe-No recuerda', () => {
  const q = Q('A09');
  assert.deepEqual(q.opciones.map((o) => o.texto), ['Sí', 'No', 'Ocasionalmente', 'No sabe / No recuerda']);
  assert.equal(interpretarRespuesta(q, { opcion: 'A' }).valor, 'si');
  assert.equal(interpretarRespuesta(q, { opcion: 'B' }).valor, 'no');
  assert.equal(interpretarRespuesta(q, { opcion: 'C' }).valor, 'ocasionalmente');
  const d = interpretarRespuesta(q, { opcion: 'D' });
  assert.equal(d.estado, 'no_sabe');
  assert.equal(d.valor, null);
});

test('texto libre: distingue sí, no, ocasionalmente, no sé y no recuerdo', () => {
  const q = Q('A09');
  const c = (t) => interpretarRespuesta(q, { texto: t });
  assert.equal(c('Sí, siempre').valor, 'si');
  assert.equal(c('claro que sí').valor, 'si');
  assert.equal(c('No').valor, 'no');
  assert.equal(c('a veces').valor, 'ocasionalmente');
  assert.equal(c('no sé').estado, 'no_sabe');
  assert.equal(c('no recuerdo').estado, 'no_recuerda');
});

test('«no sé» y «no recuerdo» nunca se convierten en negativa', () => {
  for (const t of ['no sé', 'No lo sé', 'no recuerdo', 'no me acuerdo']) {
    const r = interpretarRespuesta(Q('A01'), { texto: t });
    assert.notEqual(r.valor, 'no', t);
    assert.ok(['no_sabe', 'no_recuerda'].includes(r.estado), t);
  }
  assert.notEqual(interpretarRespuesta(Q('A01'), { tipo: 'no_se' }).valor, 'no');
});

test('no confunde el reflexivo «no se distrae» con «no sé»', () => {
  assert.equal(interpretarRespuesta(Q('A09'), { texto: 'No se distrae nunca' }).valor, 'no');
});

test('respuestas ambiguas quedan como ambiguas (no se suponen)', () => {
  assert.equal(interpretarRespuesta(Q('A09'), { texto: 'mmm' }).estado, 'ambiguo');
});

test('alternativas inválidas o combinaciones excluyentes se rechazan', () => {
  assert.throws(() => interpretarRespuesta(Q('A09'), { opcion: 'Z' }), ErrorEntrada);
  assert.throws(() => interpretarRespuesta(Q('BARRIDO'), { opciones: ['A', 'M'] }), /excluyente/);
  assert.throws(() => interpretarRespuesta(Q('TAMIZAJE'), { opciones: ['J', 'K'] }), /excluyente/);
  assert.throws(() => interpretarRespuesta(Q('BARRIDO'), { opciones: [] }), ErrorEntrada);
  assert.throws(() => interpretarRespuesta(Q('A09'), { tipo: 'quizas' }), ErrorEntrada);
});

test('selección múltiple: contextos y «No sabe» de contextos', () => {
  assert.equal(interpretarRespuesta(Q('R1.8-CONTEXTOS'), { opciones: ['A', 'B'] }).valor, 'hogar,colegio');
  assert.equal(interpretarRespuesta(Q('R1.8-CONTEXTOS'), { opciones: ['E'] }).estado, 'no_sabe');
});

test('alternativas por texto: frecuencia «varias veces al día» → código A', () => {
  const r = interpretarRespuesta(Q('R1.8-FRECUENCIA'), { texto: 'varias veces al día' });
  assert.equal(r.codigo, 'A');
  assert.equal(r.valor, 'varias_al_dia');
});

test('números: dígitos y palabras', () => {
  assert.equal(interpretarRespuesta(Q('INI-EDAD'), { texto: '8 años' }).valor, '8');
  assert.equal(interpretarRespuesta(Q('INI-EDAD'), { texto: 'ocho años' }).valor, '8');
});

test('texto libre en preguntas abiertas se conserva literal', () => {
  const t = 'Se distrae en clases; en casa depende del día.';
  const r = interpretarRespuesta(Q('INI-MOTIVO'), { texto: t });
  assert.equal(r.valor, t);
  assert.throws(() => interpretarRespuesta(Q('INI-MOTIVO'), { texto: '  ' }), ErrorEntrada);
});

test('menciones espontáneas: detecta conductas y respeta negaciones', () => {
  const m = detectarMenciones(P, 'No se distrae, pero interrumpe y pierde sus cosas');
  const ids = m.map((x) => x.sintoma);
  assert.ok(ids.includes('R2.9'));
  assert.ok(ids.includes('R1.7'));
  assert.ok(!ids.includes('R1.8'), 'la conducta negada no se registra');
  assert.ok(m.every((x) => x.evidencia.length > 0));
});

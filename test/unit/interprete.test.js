import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarReglas, detectarMenciones } from '../../src/interprete.js';
import { cargarProtocolo } from '../../src/protocolo.js';

const sn = (texto, extra = {}) => interpretarReglas({ slotTipo: 'si_no', texto, ...extra });

test('distingue sí, no, no sé y no recuerdo', () => {
  assert.equal(sn('Sí, bastante').estado, 'valor');
  assert.equal(sn('Sí, bastante').valor, 'si');
  assert.equal(sn('No, nunca').valor, 'no');
  assert.equal(sn('No sé').estado, 'no_sabe');
  assert.equal(sn('no se').estado, 'no_sabe');
  assert.equal(sn('No lo sé, la verdad').estado, 'no_sabe');
  assert.equal(sn('No me acuerdo').estado, 'no_recuerda');
  assert.equal(sn('no recuerdo bien').estado, 'no_recuerda');
});

test('«no sé» y «no recuerdo» nunca se convierten en negativa', () => {
  for (const t of ['No sé', 'no lo sé', 'No recuerdo', 'ni idea', 'no estoy segura', 'no sabría decir']) {
    const r = sn(t);
    assert.notEqual(r.valor, 'no', t);
    assert.ok(['no_sabe', 'no_recuerda'].includes(r.estado), `${t} → ${r.estado}`);
  }
});

test('no confunde el reflexivo «no se distrae» con «no sé»', () => {
  assert.equal(sn('No se distrae casi nunca').valor, 'no');
});

test('respuestas ambiguas quedan como ambiguas', () => {
  for (const t of ['a veces', 'depende del día', 'más o menos', 'no siempre', 'un poco']) {
    assert.equal(sn(t).estado, 'ambiguo', t);
  }
});

test('botones declarados tienen prioridad sobre el texto', () => {
  assert.equal(sn('', { tipoDeclarado: 'no_recuerdo' }).estado, 'no_recuerda');
  assert.equal(sn('', { tipoDeclarado: 'si' }).valor, 'si');
});

test('pregunta invertida: un «sí» significa ausencia', () => {
  assert.equal(sn('Sí, la termina', { invertida: true }).valor, 'no');
});

test('números: dígitos y palabras', () => {
  assert.equal(interpretarReglas({ slotTipo: 'numero', texto: '9 años y medio' }).valor, '9');
  assert.equal(interpretarReglas({ slotTipo: 'numero', texto: 'tiene ocho' }).valor, '8');
  assert.equal(interpretarReglas({ slotTipo: 'numero', texto: 'pronto cumple' }).estado, 'ambiguo');
});

test('texto libre se conserva literal', () => {
  const r = interpretarReglas({ slotTipo: 'texto', texto: 'Varias veces al día, sobre todo en la tarde' });
  assert.equal(r.estado, 'valor');
  assert.equal(r.valor, 'Varias veces al día, sobre todo en la tarde');
});

test('menciones espontáneas: detecta conductas y respeta negaciones', () => {
  const p = cargarProtocolo();
  const m = detectarMenciones(p, 'Se distrae mucho en clases y además duerme mal.').map((x) => x.dimension_id);
  assert.deepEqual(m.sort(), ['INA-SOST', 'TAM-SUENO']);
  assert.deepEqual(detectarMenciones(p, 'No se distrae, pero es inquieto').map((x) => x.dimension_id), ['HIP-MOT']);
});

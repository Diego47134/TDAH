import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarProtocolo, compilarProtocolo, ErrorProtocolo } from '../../src/protocolo.js';
import { siguientePaso, ruta, evaluarDimension, estadoSlot } from '../../src/motor.js';
import { validarPregunta, similitud } from '../../src/validador.js';
import fs from 'node:fs';

const P = cargarProtocolo();
let idH = 0; let turno = 0;

/** Contexto sintético: permite probar el motor como función pura, sin base de datos. */
function ctx({ iniciales = {}, hechos = [], preguntas = [], contradicciones = [], informes = 0, ruta_forzada = null } = {}) {
  const hs = [];
  for (const [slot, v] of Object.entries(iniciales)) hs.push(h('INI', slot, v));
  hs.push(...hechos);
  return {
    protocolo: P, caso: { turno: 0, ruta_forzada, estado_global: 'entrevista' },
    hechos: hs, preguntas, contradicciones, informesEscolares: Array.from({ length: informes }, () => ({})), evaluaciones: [],
  };
}
function h(dim, slot, v, fuente = 'apoderado', extra = {}) {
  const inc = ['no_sabe', 'no_recuerda', 'ambiguo'].includes(v);
  return { id: ++idH, dimension_id: dim, slot, estado: inc ? v : 'valor', valor: inc ? null : v, fuente, origen: 'respuesta', respuesta_id: idH, ...extra };
}
function preg(id) {
  const q = P.preguntasPorId.get(id);
  return { pregunta_id: id, dimension_id: q.dimension_id, slot: q.slot, especificidad: q.especificidad, texto: q.texto, turno: ++turno };
}
const INI_COMPLETA = { motivo: 'consulta', edad: '9', informe_existe: 'no' };

test('protocolo: la validación referencial rechaza errores', () => {
  const crudo = JSON.parse(fs.readFileSync('protocol/protocolo.provisional.json', 'utf8'));
  crudo.grupos_equivalencia[0].preguntas.push('NO-EXISTE');
  assert.throws(() => compilarProtocolo(crudo), ErrorProtocolo);
});

test('fase inicial: la primera pregunta es el motivo de consulta', () => {
  const p = siguientePaso(ctx());
  assert.equal(p.pregunta.id, 'INI-MOTIVO');
});

test('fase inicial: orden estricto motivo → edad → informe → disponibilidad', () => {
  assert.equal(siguientePaso(ctx({ iniciales: { motivo: 'x' } })).pregunta.id, 'INI-EDAD');
  assert.equal(siguientePaso(ctx({ iniciales: { motivo: 'x', edad: '8' } })).pregunta.id, 'INI-INF-EXISTE');
  assert.equal(siguientePaso(ctx({ iniciales: { motivo: 'x', edad: '8', informe_existe: 'si' } })).pregunta.id, 'INI-INF-DISP');
});

test('ruta: con informe disponible → con_informe; sin informe → completa; desconocido → completa', () => {
  assert.equal(ruta(ctx({ iniciales: { motivo: 'x', edad: '8', informe_existe: 'si', informe_disponible: 'si' } })), 'con_informe');
  assert.equal(ruta(ctx({ iniciales: { motivo: 'x', edad: '8', informe_existe: 'si', informe_disponible: 'no' } })), 'completa');
  assert.equal(ruta(ctx({ iniciales: INI_COMPLETA })), 'completa');
  const c = ctx({ iniciales: { motivo: 'x', edad: '8', informe_existe: 'no_sabe' } });
  c.preguntas = [preg('INI-INF-EXISTE')];
  assert.equal(ruta(c), 'completa', '«no sé» sobre el informe no se trata como «no», pero por seguridad aplica la ruta completa');
});

test('validador: bloquea preguntas fuera del banco y con más de una pregunta', () => {
  const c = ctx({ iniciales: INI_COMPLETA });
  const v1 = validarPregunta(c, { texto: '¿Necesita que le recuerden que termine?' });
  assert.equal(v1.ok, false);
  assert.ok(v1.reglas.some((r) => r.regla === 'autorizada' && !r.ok));
  const q = P.preguntasPorId.get('HIP-MOT-P1');
  const v2 = validarPregunta(c, { pregunta_id: q.id, texto: `${q.texto} ¿Y en el colegio?` });
  assert.ok(v2.reglas.some((r) => r.regla === 'una_sola_pregunta' && !r.ok));
  assert.ok(v2.reglas.some((r) => r.regla === 'autorizada' && !r.ok), 'texto alterado');
});

test('validador: bloquea dimensiones antes de completar la fase inicial', () => {
  const q = P.preguntasPorId.get('HIP-MOT-P1');
  const v = validarPregunta(ctx({ iniciales: { motivo: 'x' } }), { pregunta_id: q.id, texto: q.texto });
  assert.ok(v.reglas.some((r) => r.regla === 'orden_inicial' && !r.ok));
});

test('validador: bloquea el dato ya presente en el expediente desde otra fuente', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [h('HIP-MOT', 'presencia', 'si', 'informe_escolar')] });
  const q = P.preguntasPorId.get('HIP-MOT-P1');
  const v = validarPregunta(c, { pregunta_id: q.id, texto: q.texto });
  assert.ok(v.reglas.some((r) => r.regla === 'no_en_expediente' && !r.ok && /informe_escolar/.test(r.detalle)));
});

test('validador: equivalencia funcional entre preguntas de distintas dimensiones', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [h('AUT-RUTINAS', 'presencia', 'ambiguo')] });
  c.preguntas = [preg('INA-ORG-P1'), preg('AUT-RUTINAS-P1')];
  const q = P.preguntasPorId.get('AUT-RUTINAS-P2');
  const v = validarPregunta(c, { pregunta_id: q.id, texto: q.texto });
  assert.ok(v.reglas.some((r) => r.regla === 'no_equivalente' && !r.ok));
  // y la dimensión no queda colgada: pasa a parcial (incertidumbre registrada)
  assert.equal(evaluarDimension(c, P.dimensionesPorId.get('AUT-RUTINAS')).estado, 'parcial');
});

test('similitud textual detecta reformulaciones', () => {
  assert.ok(similitud('¿Necesita recordatorios para completar una tarea que ya comenzó?', '¿Necesita recordatorios para completar la tarea que comenzó?') > 0.6);
  assert.ok(similitud('¿Ha notado problemas de sueño?', '¿Le cuesta esperar su turno?') < 0.2);
});

test('motor: presencia referida → profundización inmediata en la misma dimensión', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [h('IMP-ESPERA', 'presencia', 'si')] });
  const p = siguientePaso(c);
  assert.equal(p.pregunta.dimension_id, 'IMP-ESPERA');
  assert.match(p.justificacion, /Profundización/);
});

test('motor: ausencia → no se caracteriza la dimensión; pasa a la siguiente pendiente', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [h('INA-SOST', 'presencia', 'no')] });
  c.preguntas = [preg('INA-SOST-P1')];
  const p = siguientePaso(c);
  assert.equal(p.pregunta.id, 'INA-ORG-P1');
});

test('motor: tras «no sé» intenta una sola alternativa concreta y luego deja la dimensión parcial', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [h('INA-SOST', 'presencia', 'no_sabe')] });
  c.preguntas = [preg('INA-SOST-P1')];
  assert.equal(siguientePaso(c).pregunta.id, 'INA-SOST-P3');
  c.preguntas.push(preg('INA-SOST-P3'));
  c.hechos.push(h('INA-SOST', 'presencia', 'no_recuerda'));
  const e = evaluarDimension(c, P.dimensionesPorId.get('INA-SOST'));
  assert.equal(e.estado, 'parcial');
  assert.notEqual(estadoSlot(c, 'INA-SOST', 'presencia').valor, 'no');
});

test('motor: ambigüedad → pregunta más específica del mismo dato', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [h('HIP-MOT', 'presencia', 'ambiguo')] });
  c.preguntas = [preg('HIP-MOT-P1')];
  const p = siguientePaso(c);
  assert.equal(p.pregunta.id, 'HIP-MOT-P2');
});

test('motor: ruta con informe no explora dimensiones escolares en el hogar antes del informe', () => {
  const ini = { motivo: 'x', edad: '9', informe_existe: 'si', informe_disponible: 'si' };
  const c = ctx({ iniciales: ini });
  assert.equal(evaluarDimension(c, P.dimensionesPorId.get('ESC-REND')).estado, 'pendiente_informe');
  const q = P.preguntasPorId.get('ESC-REND-P1');
  assert.equal(validarPregunta(c, { pregunta_id: q.id, texto: q.texto }).ok, false);
  const c2 = ctx({ iniciales: ini, informes: 1 });
  assert.equal(evaluarDimension(c2, P.dimensionesPorId.get('ESC-REND')).estado, 'pendiente');
});

test('motor: el límite por dimensión no es una cuota; se supera solo con justificación de dato esencial', () => {
  const c = ctx({ iniciales: INI_COMPLETA, hechos: [
    h('HIP-MOT', 'presencia', 'si'), h('HIP-MOT', 'frecuencia', 'diaria'), h('HIP-MOT', 'contextos', 'casa'), h('HIP-MOT', 'inicio', '4 años')] });
  c.preguntas = ['HIP-MOT-P1', 'HIP-MOT-FRECUENCIA', 'HIP-MOT-CONTEXTOS', 'HIP-MOT-INICIO'].map(preg);
  const p = siguientePaso(c);
  assert.equal(p.pregunta.id, 'HIP-MOT-IMPACTO');
  assert.match(p.justificacion, /límite orientativo/);
});

test('motor: con todo explorado cierra; nunca cierra con obligatorias pendientes', () => {
  const hechos = P.dimensiones.map((d) => h(d.id, 'presencia', 'no'));
  assert.equal(siguientePaso(ctx({ iniciales: INI_COMPLETA, hechos })).accion, 'cerrar');
  assert.equal(siguientePaso(ctx({ iniciales: INI_COMPLETA, hechos: hechos.slice(1) })).accion, 'preguntar');
});

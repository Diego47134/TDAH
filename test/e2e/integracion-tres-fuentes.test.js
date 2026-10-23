// Integración de las tres fuentes (entrevista al apoderado, informe escolar y Nesplora) y generación
// del informe según el «Protocolo de integración» (pruebas de aceptación 17–21) y el «Módulo de
// generación del informe». Usa los documentos de ejemplo entregados por el cliente.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { iniciarApp, crearCaso, vista, entrevistar, crearEvidencia } from './ayudantes.js';
import { cargarProtocolo } from '../../src/protocolo.js';
import { extraerTexto } from '../../src/documentos.js';
import { leerNesplora, verificarVinculacion } from '../../src/nesplora.js';
import { leerInformeEscolar } from '../../src/informeEscolar.js';
import { INTERPRETACION } from '../fixtures/caso-ficticio.js';

const ev = crearEvidencia('integracion-tres-fuentes');
after(() => ev.escribir());

const NESPLORA = fs.readFileSync(new URL('../fixtures/documentos/nesplora-aula-ejemplo.pdf', import.meta.url));
const COLEGIO = fs.readFileSync(new URL('../fixtures/documentos/informe-colegio-ejemplo.docx', import.meta.url));
const P = cargarProtocolo();

async function subir(api, id, buf, nombre, clase) {
  const r = await api.req('POST', `/api/casos/${id}/documentos`, { nombre, contenido_base64: buf.toString('base64'), clase, profesional: 'Profesional de prueba' });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  return r.body;
}

/** Caso con las tres fuentes: entrevista completa, informe del colegio (docx) y Nesplora (pdf). */
async function casoTresFuentes(api, { confirmarNesplora = true } = {}) {
  const v = await crearCaso(api, 'Caso de integración');
  const id = v.caso.id;
  await entrevistar(api, id);
  const esc = await subir(api, id, COLEGIO, 'Informe del Colegio (prueba).docx', 'informe_escolar');
  await entrevistar(api, id);
  const nes = await subir(api, id, NESPLORA, 'Informe Nesplora.pdf', 'informe_rv');
  if (confirmarNesplora) {
    const c = await api.req('POST', `/api/casos/${id}/documentos/${nes.id}/vinculacion`, { profesional: 'Profesional de prueba', motivo: 'Informe de ejemplo del cliente: se vincula para la prueba.' });
    assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 300));
  }
  let w = await vista(api, id);
  for (const x of w.contradicciones.filter((y) => y.estado !== 'revisada')) {
    await api.req('POST', `/api/casos/${id}/contradicciones/${x.id}/revision`, { nota: 'Diferencia entre contextos conservada.', profesional: 'Profesional de prueba' });
  }
  await api.req('PUT', `/api/casos/${id}/interpretacion`, { texto: INTERPRETACION, profesional: 'Profesional de prueba' });
  w = await vista(api, id);
  return { id, esc, nes, v: w };
}

test('I0 · lectores: Nesplora (PDF) y colegio (Word) se leen sin IA, con sus datos originales', async () => {
  const p = ev.prueba('I0', 'Lectura de documentos reales', 'El informe de Nesplora Aula y el informe del colegio se leen con reglas propias, conservando los valores y frases originales.');
  const n = leerNesplora((await extraerTexto(NESPLORA, 'x.pdf')).texto);
  assert.equal(n.instrumento, 'Nesplora Aula');
  assert.equal(n.fecha, '2020-11-27'); assert.equal(n.persona.nacimiento, '2014-03-03'); assert.equal(n.valido, true);
  const idx = Object.fromEntries(n.variables.map((v) => [v.id, v]));
  assert.deepEqual([idx.omisiones.pd, idx.omisiones.percentil, idx.omisiones.t, idx.omisiones.rendimiento], [58, 81, 59, 'normal']);
  assert.deepEqual([idx.comisiones.pd, idx.comisiones.percentil, idx.comisiones.t, idx.comisiones.rendimiento], [116, 99, 80, 'muy bajo']);
  assert.deepEqual([idx.tiempo_reaccion.t, idx.tiempo_reaccion.rendimiento, idx.tiempo_reaccion.sentido], [37, 'alto', 'fortaleza']);
  assert.deepEqual([idx.variabilidad_tr.t, idx.actividad_motora.t], [80, 69]);
  assert.equal(n.condiciones.distractores.con.omisiones.t, 73); assert.equal(n.condiciones.distractores.sin.omisiones.t, 57);
  assert.equal(n.condiciones.tareas.vigilancia.omisiones.pd, 10); assert.equal(n.condiciones.canales.auditivo.tiempo_reaccion.pd, 860.78);
  const c = leerInformeEscolar(P, (await extraerTexto(COLEGIO, 'x.docx')).texto);
  const sint = new Set(c.hechos.filter((h) => h.slot === 'presencia:informe' && h.valor === 'si').map((h) => h.dimension_id));
  for (const s of ['R1.1', 'R1.2', 'R1.4', 'R1.8', 'R1.9', 'R2.1', 'R2.2', 'R2.8', 'R2.9']) assert.ok(sint.has(s), `colegio: ${s}`);
  assert.equal(c.datos.filter((d) => d.dato === 'apoyo_previo').length, 3);
  assert.match(c.datos.find((d) => d.dato === 'efectividad_apoyos').valor, /efectividad baja o transitoria/);
  assert.equal(c.documento.autor, 'Marcela Soto G');
  ev.paso(p, { entrada: 'Nesplora PDF + informe del colegio .docx', accion_resultante: `${n.variables.length} índices Nesplora; ${sint.size} conductas del colegio, 3 apoyos previos`, ok: true });
  ev.cerrar(p, true);
});

test('A21 · fuente no atribuible: el informe de RV de otra persona no se integra hasta confirmar la vinculación', async () => {
  const p = ev.prueba('A21', 'Fuente no atribuible', 'El informe de Nesplora es de un niño nacido en 2014 (12 años); el caso tiene 8. Se bloquea la integración hasta que el profesional confirme.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    await entrevistar(api, id);
    const nes = await subir(api, id, NESPLORA, 'Informe Nesplora.pdf', 'otro');
    assert.equal(nes.metodo, 'lector_nesplora', 'se reconoce aunque se suba como «otro»');
    assert.match(nes.detalle, /pendientes de vinculación/);
    assert.match(nes.detalle, /12 años, pero el caso registra 8 años/);
    let w = await vista(api, id);
    const e = w.evaluaciones.find((x) => x.instrumento_id === 'NESPLORA');
    assert.equal(e.estado, 'pendiente_vinculacion');
    assert.equal(w.integracion.realidad_virtual.disponible, false, 'no entra al análisis');
    let md = (await api.req('GET', `/api/casos/${id}/informe`)).body.markdown;
    assert.match(md, /Nesplora Aula no integrado/);
    assert.doesNotMatch(md, /comisiones totales \| Errores por comisión/i);
    assert.equal((await api.req('POST', `/api/casos/${id}/documentos/${nes.id}/vinculacion`, { profesional: 'X' })).status, 400, 'exige cómo se verificó');
    const ok = await api.req('POST', `/api/casos/${id}/documentos/${nes.id}/vinculacion`, { profesional: 'Profesional de prueba', motivo: 'La familia confirmó que el informe es del niño (usa seudónimo).' });
    assert.equal(ok.status, 200);
    w = await vista(api, id);
    assert.equal(w.evaluaciones.find((x) => x.instrumento_id === 'NESPLORA').estado, 'realizada');
    assert.equal(w.integracion.realidad_virtual.disponible, true);
    md = (await api.req('GET', `/api/casos/${id}/informe`)).body.markdown;
    assert.match(md, /Control inhibitorio: comisiones totales \| Errores por comisión/);
    assert.match(md, /Vinculación al caso confirmada por Profesional de prueba/);
    assert.match(md, /se realizó hace 5 año/);
    ev.paso(p, { entrada: 'Nesplora de «Markel» (2014) en un caso de 8 años', accion_resultante: 'pendiente_vinculacion → confirmada por el profesional → integrada', esperado: 'Nunca se atribuye sin verificar', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A17–A20 · integración de las tres fuentes en el informe: convergencia, discrepancias, RV complementaria e insuficiencia', async () => {
  const p = ev.prueba('A17-20', 'Integración de tres fuentes', 'Convergencia sin duplicar síntomas, discrepancias conservadas, RV como evidencia complementaria e información insuficiente declarada.');
  const api = await iniciarApp();
  try {
    const { id, v } = await casoTresFuentes(api);
    // Las tres fuentes alimentan el expediente.
    assert.ok(v.integracion.fuentes.includes('informe_escolar'));
    assert.equal(v.integracion.realidad_virtual.disponible, true);
    const r = await api.req('POST', `/api/casos/${id}/informes`);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
    const md = r.body.markdown;
    if (process.env.VOLCAR_INFORME) fs.writeFileSync(process.env.VOLCAR_INFORME, md);

    // A17 Convergencia: la misma conducta, varias fuentes, contada una vez.
    assert.match(md, /- Se distrae fácilmente: Apoderado y Colegio\./);
    assert.equal((md.match(/\| R1\.8 Se distrae fácilmente \|/g) || []).length, 1, 'un síntoma = una fila, aunque lo describan varias fuentes');
    assert.equal(v.sintomas.filter((s) => s.dominio === 'inatencion').length, 9);
    // A18 Discrepancia entre contextos: conservada, no se declara ausente.
    assert.match(md, /\*\*Discrepancias\*\*/);
    assert.match(md, /Inquietud motora[^\n]*Apoderado «No» \/ Colegio «Sí»|Se levanta cuando[^\n]*Apoderado «No» \/ Colegio «Sí»/);
    assert.match(md, /no equivale a ausencia/);
    // A19 RV: complementaria, con índice exacto y límites; no se usa como diagnóstico.
    assert.match(md, /Control inhibitorio: comisiones totales \| [^|]+\| PD 116 · percentil 99 · T 80 \| rendimiento muy bajo/);
    assert.match(md, /Procesamiento: tiempo de reacción medio \(aciertos\): rendimiento alto/, 'fortaleza objetiva');
    assert.match(md, /no confirma ni descarta TDAH por sí sola/);
    assert.match(md, /rendimiento menor con distractores \(T 73\) que sin distractores \(T 57\)/);
    // A20 Información insuficiente: declarada, sin forzar la conclusión.
    assert.match(md, /R1\.5 Dificultad para organizar tareas y actividades \| (Desconocido \/ no recuerda|Apoyado por evidencia|Probable)/);
    assert.match(md, /## 14\. Información pendiente/);
    assert.match(md, /\*\*Estado diagnóstico establecido por el motor:\*\* /);
    // Fortalezas, recomendaciones vinculadas a hallazgos y uso de los apoyos ya aplicados por el colegio.
    assert.match(md, /## 8\. Fortalezas y capacidades preservadas/);
    assert.match(md, /Revisar la ubicación preferencial que ya se aplica \(el colegio informa efectividad baja o transitoria\)/);
    assert.match(md, /### A\. Aula y profesores/); assert.match(md, /### C\. Familia y hogar/);
    assert.match(md, /## Síntesis para docentes y psicólogos educativos/);
    assert.doesNotMatch(md.split('## Síntesis para docentes')[1].split('## Control de calidad')[0], /TDAH|DSM/, 'la síntesis educativa no presenta un diagnóstico');
    assert.match(md, /\| Diagnóstico no presentado como validado \| Cumple \|/);
    assert.match(md, /PENDIENTE DE VALIDACIÓN PROFESIONAL/);
    ev.paso(p, { entrada: 'Entrevista + informe del colegio (.docx) + Nesplora (.pdf) vinculado', accion_resultante: `Informe de ${md.length} caracteres con las tres fuentes integradas`, esperado: 'Convergencias, discrepancias, RV complementaria, pendientes y recomendaciones', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('A19b · resultado de RV sin correlato cotidiano: se describe como complementario, no como síntoma', () => {
  const lectura = { persona: { nacimiento: '2018-01-10' }, fecha: '2026-09-01', valido: true };
  assert.equal(verificarVinculacion(lectura, { edadCaso: 8, etiqueta: 'Caso A', hoy: new Date('2026-10-23') }).estado, 'verificada');
  assert.equal(verificarVinculacion(lectura, { edadCaso: null, etiqueta: 'Caso A', hoy: new Date('2026-10-23') }).estado, 'requiere_confirmacion', 'sin edad del caso no se puede verificar');
});

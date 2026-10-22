// Preguntas a la app: responde con su propio contenido y, si no encuentra respuesta, busca sola en
// internet (Europe PMC) y muestra fragmentos textuales con su cita. Solo salen términos clínicos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, vista, responder, crearEvidencia } from './ayudantes.js';
import { respuestaPara } from '../fixtures/caso-ficticio.js';
import { crearBuscador } from '../../src/bibliografia.js';

const ev = crearEvidencia('consultas');
after(() => ev.escribir());

const RESULTADO = { hitCount: 2, resultList: { result: [
  { id: '555', source: 'MED', pmid: '555', doi: '10.1000/ficticio.mel', title: 'Melatonin for sleep onset insomnia in children with ADHD (ficticio)', authorString: 'Autor F.', journalTitle: 'Revista Ficticia', pubYear: '2023',
    abstractText: 'Background: sleep problems are frequent. Melatonin advanced sleep onset and increased total sleep time in children with ADHD and chronic sleep onset insomnia. Conclusions: melatonin may be considered for sleep onset insomnia in ADHD after behavioral sleep measures.' },
] } };

function fetchRegistrado(urls, fallar = false) {
  return async (u) => { urls.push(decodeURIComponent(String(u)).replace(/\+/g, ' ')); if (fallar) throw new Error('ECONNREFUSED'); return Response.json(RESULTADO); };
}

test('Q1 · el apoderado pregunta y la app responde con su propio contenido (sin internet)', async () => {
  const p = ev.prueba('Q1', 'Respuesta propia', 'Las dudas frecuentes se responden con el glosario y el protocolo, sin salir a internet.');
  const urls = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchRegistrado(urls) }) });
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    let r = await api.req('POST', '/api/consultas', { pregunta: '¿Qué es el TDAH?', quien: 'apoderado', caso_id: id });
    assert.equal(r.body.origen, 'app');
    assert.match(r.body.respuestas[0].texto, /neurodesarrollo/);
    let q; do { q = (await vista(api, id)).caso.pregunta_actual; if (q.id !== 'A09') await responder(api, id, respuestaPara); } while (q.id !== 'A09');
    r = await api.req('POST', '/api/consultas', { pregunta: '¿Qué significa esta pregunta?', quien: 'apoderado', caso_id: id, pregunta_id: 'A09' });
    assert.equal(r.body.origen, 'app');
    assert.match(r.body.respuestas[0].titulo, /R1\.8/);
    r = await api.req('POST', '/api/consultas', { pregunta: '¿Qué pasa si no sé la respuesta?', quien: 'apoderado', caso_id: id });
    assert.match(r.body.respuestas[0].texto, /no se interpreta como un «no»/);
    assert.equal(urls.length, 0);
    ev.paso(p, { entrada: '¿Qué es el TDAH? / ¿Qué significa esta pregunta? (A09) / ¿Qué pasa si no sé?', accion_resultante: 'Respondidas por la app', esperado: 'Sin consultas a internet', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('Q2 · si la app no sabe, busca sola en internet y muestra fragmentos textuales citados', async () => {
  const p = ev.prueba('Q2', 'Búsqueda automática', 'Sin respuesta propia, la app consulta Europe PMC automáticamente, envía solo términos clínicos y muestra oraciones textuales con su fuente.');
  const urls = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchRegistrado(urls) }) });
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const r = await api.req('POST', '/api/consultas', { pregunta: '¿Juanito Pérez puede tomar melatonina para dormir?', quien: 'profesional', caso_id: id });
    assert.equal(r.status, 200);
    assert.equal(r.body.origen, 'internet');
    assert.equal(urls.length, 1);
    assert.match(urls[0], /query=ADHD melatonin sleep/);
    assert.ok(!/juanito|perez|pérez/i.test(urls[0]), 'el nombre nunca sale a internet');
    assert.match(r.body.respuestas[0].cita, /melatonin/i);
    assert.ok(RESULTADO.resultList.result[0].abstractText.includes(r.body.respuestas[0].cita), 'cita textual, sin modificar');
    assert.equal(r.body.respuestas[0].articulo.url, 'https://doi.org/10.1000/ficticio.mel');
    // La cita encontrada se puede agregar al informe del caso.
    const ref = await api.req('POST', `/api/casos/${id}/referencias`, { referencia_id: r.body.respuestas[0].articulo.id, fuente: 'europepmc', profesional: 'Profesional de prueba' });
    assert.equal(ref.status, 200);
    const w = await vista(api, id);
    assert.equal(w.consultas[0].origen, 'internet');
    ev.paso(p, { entrada: '¿Juanito Pérez puede tomar melatonina para dormir?', accion_resultante: `Consulta enviada: ${urls[0].split('query=')[1].split('&')[0]}`, esperado: 'Solo términos clínicos; cita textual con fuente', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('Q3 · sin respuesta: queda registrada para el profesional, que la marca como atendida', async () => {
  const p = ev.prueba('Q3', 'Pregunta sin respuesta', 'Si ni la app ni internet responden, la pregunta del apoderado queda pendiente para el profesional.');
  const urls = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchRegistrado(urls) }) });
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    const r = await api.req('POST', '/api/consultas', { pregunta: '¿Cuánto dura la consulta de hoy?', quien: 'apoderado', caso_id: id });
    assert.equal(r.body.origen, 'sin_respuesta');
    assert.match(r.body.aviso, /quedó registrada para que el profesional la responda/);
    assert.equal(urls.length, 0, 'sin términos clínicos no se busca en internet');
    let w = await vista(api, id);
    const c = w.consultas.find((x) => x.quien === 'apoderado');
    assert.ok(c && !c.atendida);
    w = (await api.req('POST', `/api/casos/${id}/consultas/${c.id}/atendida`, {})).body;
    assert.ok(w.consultas.find((x) => x.id === c.id).atendida);
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
    assert.ok(aud.decisiones.some((d) => d.tipo === 'consulta_apoderado'));
    ev.paso(p, { entrada: '¿Cuánto dura la consulta de hoy?', accion_resultante: 'Sin respuesta; registrada y luego atendida', esperado: 'Pendiente para el profesional', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('Q4 · internet no disponible: aviso claro, la app sigue funcionando', async () => {
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchRegistrado([], true) }) });
  try {
    const r = await api.req('POST', '/api/consultas', { pregunta: '¿La melatonina sirve en TDAH?', quien: 'profesional' });
    assert.equal(r.status, 200);
    assert.equal(r.body.origen, 'sin_respuesta');
    assert.match(r.body.aviso, /No fue posible buscar en internet/);
    const bad = await api.req('POST', '/api/consultas', { pregunta: 'x', quien: 'profesional' });
    assert.equal(bad.status, 400);
  } finally { await api.cerrar(); }
});

const XML_MLP = `<?xml version="1.0" encoding="UTF-8"?><nlmSearchResult><term>x</term><count>1</count><retstart>0</retstart><retmax>5</retmax><list num="1">
<document rank="0" url="https://medlineplus.gov/spanish/occupationaltherapy.html"><content name="title">Terapia &lt;span class="qt0"&gt;ocupacional&lt;/span&gt;</content>
<content name="organizationName">Biblioteca Nacional de Medicina</content>
<content name="FullSummary">&lt;p&gt;La terapia ocupacional ayuda a las personas a realizar las actividades de la vida diaria. En los niños, la terapia ocupacional puede mejorar la coordinación y la integración sensorial.&lt;/p&gt;</content></document>
<document rank="1" url="https://sitio-falso.example/x"><content name="title">No oficial</content><content name="FullSummary">Texto que no debe mostrarse nunca en la app.</content></document></list></nlmSearchResult>`;

function fetchWeb(urls, { pmcVacio = false } = {}) {
  return async (u) => {
    const s = decodeURIComponent(String(u)).replace(/\+/g, ' ');
    urls.push(s);
    if (s.includes('wsearch.nlm.nih.gov')) return new Response(XML_MLP, { headers: { 'content-type': 'application/xml' } });
    return Response.json(pmcVacio ? { hitCount: 0, resultList: { result: [] } } : RESULTADO);
  };
}

test('Q5 · sin términos clínicos, el profesional confirma palabras y la app busca en la web (MedlinePlus); nombres y números nunca salen', async () => {
  const p = ev.prueba('Q5', 'Búsqueda en la web con confirmación', 'Si la app no sabe la respuesta y no reconoce términos clínicos, propone palabras sin datos personales y busca solo si el profesional confirma.');
  const urls = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchWeb(urls) }) });
  try {
    const v = await crearCaso(api, 'Martina Rojas'); const id = v.caso.id;
    const pregunta = '¿Martina Rojas, de 9 años, necesita fonoaudiología o kinesiología?';
    let r = await api.req('POST', '/api/consultas', { pregunta, quien: 'profesional', caso_id: id });
    assert.equal(r.body.origen, 'sin_respuesta');
    assert.deepEqual(r.body.propuesta_busqueda.palabras, ['fonoaudiologia', 'kinesiologia']);
    assert.equal(urls.length, 0, 'no busca sin confirmación');
    const intruso = await api.req('POST', '/api/consultas', { pregunta, quien: 'profesional', caso_id: id, buscar_en_web: true, palabras: ['martina', 'rojas'] });
    assert.equal(intruso.status, 400, 'solo se aceptan palabras de la propuesta');
    r = await api.req('POST', '/api/consultas', { pregunta, quien: 'profesional', caso_id: id, buscar_en_web: true, palabras: ['fonoaudiologia', 'kinesiologia'] });
    assert.equal(r.body.origen, 'internet');
    assert.equal(r.body.fuente_id, 'medlineplus');
    assert.match(urls[0], /wsearch\.nlm\.nih\.gov\/ws\/query\?db=healthTopicsSpanish&term=fonoaudiologia kinesiologia/);
    assert.ok(urls.every((u) => !/martina|rojas|\b9\b/i.test(u)), 'ni nombre ni edad salen a internet');
    assert.match(r.body.respuestas[0].cita, /terapia ocupacional/);
    assert.equal(r.body.respuestas[0].articulo.url, 'https://medlineplus.gov/spanish/occupationaltherapy.html');
    assert.ok(!JSON.stringify(r.body).includes('sitio-falso'), 'solo enlaces oficiales de medlineplus.gov');
    assert.match(r.body.aviso, /MedlinePlus\.gov/);
    const ref = await api.req('POST', `/api/casos/${id}/referencias`, { referencia_id: r.body.respuestas[0].articulo.id, fuente: 'medlineplus', profesional: 'Profesional de prueba' });
    assert.equal(ref.status, 200);
    ev.paso(p, { entrada: pregunta, accion_resultante: `Propuesta: fonoaudiologia, kinesiologia → confirmada → ${urls[0].split('?')[1]}`, esperado: 'Sin nombre ni edad; fuente oficial citada', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('Q6 · si la literatura científica no responde, la app intenta MedlinePlus; el apoderado recibe primero MedlinePlus', async () => {
  const urls = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchWeb(urls, { pmcVacio: true }) }) });
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    let r = await api.req('POST', '/api/consultas', { pregunta: '¿Qué hacer con la coordinación motora?', quien: 'profesional', caso_id: id });
    assert.equal(r.body.origen, 'internet'); assert.equal(r.body.fuente_id, 'medlineplus');
    assert.ok(urls.findIndex((u) => u.includes('europepmc')) < urls.findIndex((u) => u.includes('wsearch')), 'profesional: primero Europe PMC');
    urls.length = 0;
    r = await api.req('POST', '/api/consultas', { pregunta: '¿Cómo puedo ayudarlo con la lectura?', quien: 'apoderado', caso_id: id });
    assert.equal(r.body.origen, 'internet');
    assert.match(urls[0], /wsearch\.nlm\.nih\.gov/, 'apoderado: primero información en español para público general');
    r = await api.req('POST', '/api/consultas', { pregunta: '¿Cuánto dura la consulta de hoy?', quien: 'apoderado', caso_id: id });
    assert.equal(r.body.origen, 'sin_respuesta'); assert.equal(r.body.propuesta_busqueda, undefined, 'el apoderado nunca envía texto libre a internet');
  } finally { await api.cerrar(); }
});

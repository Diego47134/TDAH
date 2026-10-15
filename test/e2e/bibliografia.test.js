// Búsqueda bibliográfica en internet (Europe PMC / PubMed): resultados normalizados, caché,
// protección de datos (no se envían datos del paciente) y referencias en el informe del caso.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, responder, crearEvidencia } from './ayudantes.js';
import { respuestaPara } from '../fixtures/caso-ficticio.js';
import { crearBuscador, validarConsulta, citar } from '../../src/bibliografia.js';

const ev = crearEvidencia('bibliografia');
after(() => ev.escribir());

// Respuestas con la forma documentada de las API públicas (datos ficticios de prueba).
const EUROPEPMC = { hitCount: 1234, resultList: { result: [
  { id: '11111111', source: 'MED', pmid: '11111111', doi: '10.1000/ficticio.1', title: 'Structured diagnostic interviews for ADHD according to DSM-5 criteria', authorString: 'Autor A, Autor B.', journalTitle: 'Revista Ficticia de Pediatría', pubYear: '2024', abstractText: '<h4>Objetivo</h4>Resumen ficticio de prueba.', isOpenAccess: 'Y' },
  { id: 'PMC222', source: 'PMC', title: 'Parent and teacher agreement on DSM-5 ADHD symptoms', authorString: 'Autor C.', journalTitle: 'Revista Ficticia', pubYear: '2022', isOpenAccess: 'N' },
] } };
const PUBMED_SEARCH = { esearchresult: { count: '2', idlist: ['33333333', '44444444'] } };
const PUBMED_SUMMARY = { result: { uids: ['33333333', '44444444'],
  33333333: { uid: '33333333', title: 'ADHD age of onset criterion in DSM-5.', fulljournalname: 'Revista Ficticia', pubdate: '2021 Mar', authors: [{ name: 'Autor D' }], articleids: [{ idtype: 'doi', value: '10.1000/ficticio.3' }] },
  44444444: { uid: '44444444', title: 'Differential diagnosis of ADHD in children.', source: 'Rev Fict', pubdate: '2020', authors: [{ name: 'Autor E' }], articleids: [] } } };

function fetchFalso(registro) {
  return async (url) => {
    const u = String(url); registro.push(u);
    if (u.includes('europepmc')) return Response.json(EUROPEPMC);
    if (u.includes('esearch')) return Response.json(PUBMED_SEARCH);
    if (u.includes('esummary')) return Response.json(PUBMED_SUMMARY);
    return new Response('no', { status: 404 });
  };
}

test('B1 · búsqueda en Europe PMC y PubMed con resultados normalizados', async () => {
  const p = ev.prueba('B1', 'Buscar evidencia en internet', 'La app consulta Europe PMC y PubMed y devuelve título, autores, revista, año, DOI/PMID y enlace.');
  const llamadas = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchFalso(llamadas) }) });
  try {
    const sug = (await api.req('GET', '/api/bibliografia/sugerencias')).body;
    assert.ok(sug.sugeridas.some((s) => /DSM-5/.test(s.consulta)));
    const r = await api.req('GET', `/api/bibliografia?q=${encodeURIComponent('ADHD DSM-5 diagnostic interview')}&fuente=europepmc&n=5`);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 1234);
    const a = r.body.resultados[0];
    assert.equal(a.titulo, 'Structured diagnostic interviews for ADHD according to DSM-5 criteria');
    assert.equal(a.url, 'https://doi.org/10.1000/ficticio.1');
    assert.equal(a.resumen, 'Objetivo Resumen ficticio de prueba.');
    assert.equal(r.body.resultados[1].url, 'https://europepmc.org/article/PMC/PMC222');
    assert.match(llamadas[0], /query=ADHD\+DSM-5\+diagnostic\+interview/);
    const pm = await api.req('GET', `/api/bibliografia?q=${encodeURIComponent('ADHD age of onset')}&fuente=pubmed`);
    assert.equal(pm.body.resultados.length, 2);
    assert.equal(pm.body.resultados[0].doi, '10.1000/ficticio.3');
    assert.equal(pm.body.resultados[0].anio, 2021);
    assert.equal(pm.body.resultados[1].url, 'https://pubmed.ncbi.nlm.nih.gov/44444444/');
    ev.paso(p, { entrada: 'Europe PMC y PubMed', accion_resultante: `${r.body.resultados.length} + ${pm.body.resultados.length} resultados normalizados`, esperado: 'Resultados con enlace verificable', ok: true });
    // Caché: la misma búsqueda no vuelve a salir a internet
    const n = llamadas.length;
    const c = await api.req('GET', `/api/bibliografia?q=${encodeURIComponent('adhd dsm-5 diagnostic interview')}&fuente=europepmc&n=2`);
    assert.equal(c.body.en_cache, true);
    assert.equal(llamadas.length, n);
    ev.paso(p, { entrada: 'Repetir la búsqueda', accion_resultante: 'Respondida desde caché', esperado: 'Sin nueva consulta a internet', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('B2 · las búsquedas no pueden contener datos personales', async () => {
  const p = ev.prueba('B2', 'Protección de datos', 'Se rechazan búsquedas con RUT, correo o teléfono; solo salen términos clínicos generales.');
  const llamadas = [];
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchFalso(llamadas) }) });
  try {
    for (const q of ['TDAH 12.345.678-9', 'contacto apoderado@correo.cl', 'llamar +56 9 1234 5678', 'ab']) {
      const r = await api.req('GET', `/api/bibliografia?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 400, q);
      ev.paso(p, { entrada: q, accion_resultante: `HTTP 400: ${r.body.error}`, esperado: 'Rechazada', ok: true });
    }
    assert.equal(llamadas.length, 0, 'nada salió a internet');
    assert.throws(() => validarConsulta('x'.repeat(201)));
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('B3 · fuente caída: error claro y auditado, sin afectar la app', async () => {
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }) });
  try {
    const r = await api.req('GET', `/api/bibliografia?q=${encodeURIComponent('ADHD DSM-5')}`);
    assert.equal(r.status, 502);
    assert.match(r.body.error, /No fue posible conectarse/);
    const v = await crearCaso(api);
    assert.equal(v.caso.pregunta_actual.id, 'INI-MOTIVO');
  } finally { await api.cerrar(); }
});

test('B4 · referencias agregadas al caso aparecen en el informe y quedan auditadas', async () => {
  const p = ev.prueba('B4', 'Referencias en el informe', 'Solo se aceptan referencias obtenidas por una búsqueda real; se citan al final del informe.');
  const api = await iniciarApp({ buscador: crearBuscador({ fetchImpl: fetchFalso([]) }) });
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    for (let i = 0; i < 4; i++) await responder(api, id, respuestaPara);
    const b = (await api.req('GET', `/api/bibliografia?q=${encodeURIComponent('ADHD DSM-5 diagnostic interview')}`)).body;
    const inventada = await api.req('POST', `/api/casos/${id}/referencias`, { referencia_id: 'MED:99999', fuente: 'europepmc', profesional: 'Profesional de prueba' });
    assert.equal(inventada.status, 404);
    const sinProf = await api.req('POST', `/api/casos/${id}/referencias`, { referencia_id: b.resultados[0].id, fuente: 'europepmc' });
    assert.equal(sinProf.status, 400);
    const ok = await api.req('POST', `/api/casos/${id}/referencias`, { referencia_id: b.resultados[0].id, fuente: 'europepmc', profesional: 'Profesional de prueba', nota: 'Respaldo de la entrevista estructurada' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.referencias.length, 1);
    const inf = (await api.req('GET', `/api/casos/${id}/informe`)).body.markdown;
    assert.match(inf, /## Bibliografía consultada por el profesional/);
    assert.match(inf, /doi:10\.1000\/ficticio\.1 — Respaldo de la entrevista estructurada/);
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
    assert.ok(aud.decisiones.some((d) => d.tipo === 'referencia_agregada'));
    const q = await api.req('DELETE', `/api/casos/${id}/referencias/${ok.body.referencias[0].id}`, { profesional: 'Profesional de prueba' });
    assert.equal(q.body.referencias.length, 0);
    assert.equal(citar({ autores: 'Autor A.', titulo: 'Título.', revista: 'Revista', anio: 2024, pmid: '1' }), 'Autor A. Título. Revista. 2024. PMID: 1');
    ev.paso(p, { entrada: 'Referencia inventada / sin profesional / válida', accion_resultante: 'HTTP 404 / 400 / 200; citada en el informe; auditada', esperado: 'Solo referencias reales', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

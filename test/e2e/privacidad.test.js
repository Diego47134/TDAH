// Protección de datos sensibles de salud mental: consentimiento informado, asentimiento del NNA,
// IA externa solo con autorización, derecho de acceso/portabilidad y avisos legales.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarApp, crearCaso, vista, responder, crearEvidencia } from './ayudantes.js';
import { respuestaPara, CONSENTIMIENTO } from '../fixtures/caso-ficticio.js';
import { crearClienteIA } from '../../src/ia.js';

const ev = crearEvidencia('privacidad');
after(() => ev.escribir());

test('L1 · sin consentimiento informado del representante legal no se crea el caso', async () => {
  const p = ev.prueba('L1', 'Consentimiento obligatorio', 'Datos de salud mental = datos sensibles: requieren consentimiento expreso (Ley 19.628/21.719; Ley 20.584; Ley 21.331).');
  const api = await iniciarApp();
  try {
    const casos = [
      ['Sin consentimiento', { etiqueta: 'x' }],
      ['Consentimiento no aceptado', { etiqueta: 'x', consentimiento: { ...CONSENTIMIENTO, acepta: false } }],
      ['Sin otorgante', { etiqueta: 'x', consentimiento: { ...CONSENTIMIENTO, otorgante: ' ' } }],
      ['Sin profesional', { etiqueta: 'x', consentimiento: { ...CONSENTIMIENTO, profesional: '' } }],
      ['Relación no válida', { etiqueta: 'x', consentimiento: { ...CONSENTIMIENTO, relacion: 'vecino' } }],
      ['Medio no válido', { etiqueta: 'x', consentimiento: { ...CONSENTIMIENTO, medio: 'whatsapp' } }],
    ];
    for (const [nombre, cuerpo] of casos) {
      const r = await api.req('POST', '/api/casos', cuerpo);
      assert.equal(r.status, 400, nombre);
      ev.paso(p, { entrada: nombre, accion_resultante: `HTTP ${r.status}: ${r.body.error}`, esperado: 'HTTP 400', ok: true });
    }
    assert.equal((await api.req('GET', '/api/casos')).body.length, 0);
    const v = await crearCaso(api);
    assert.equal(v.consentimientos.length, 1);
    assert.equal(v.consentimientos[0].tipo, 'tratamiento_datos');
    assert.match(v.consentimientos[0].version_politica, /^1\.0/);
    const aud = (await api.req('GET', `/api/casos/${v.caso.id}/auditoria`)).body;
    assert.ok(aud.decisiones.some((d) => d.tipo === 'consentimiento_registrado'));
    ev.paso(p, { entrada: 'Consentimiento completo', accion_resultante: 'Caso creado; consentimiento auditado', esperado: 'HTTP 201', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('L2 · la IA externa no recibe datos si el representante no lo autorizó', async () => {
  const p = ev.prueba('L2', 'Comunicación a terceros', 'Las respuestas solo se envían a un proveedor externo de IA con autorización expresa; si no, se usa el intérprete local.');
  let llamadas = 0;
  const fetchImpl = async () => { llamadas++; return Response.json({ content: [{ type: 'text', text: '{"codigo":"A"}' }] }); };
  const api = await iniciarApp({ ia: crearClienteIA({ proveedor: 'anthropic', apiKey: 'k', fetchImpl }) });
  try {
    const r0 = await api.req('POST', '/api/casos', { etiqueta: 'sin IA', consentimiento: { ...CONSENTIMIENTO, acepta_ia_externa: false } });
    const id = r0.body.caso.id;
    assert.equal(r0.body.ia_externa_autorizada, false);
    for (let i = 0; i < 6; i++) await responder(api, id, (q) => (q.tipo === 'presencia' ? { texto: 'sí, siempre' } : respuestaPara(q)));
    assert.equal(llamadas, 0);
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
    assert.ok(aud.respuestas.every((r) => r.interprete === 'reglas'));
    ev.paso(p, { entrada: 'acepta_ia_externa = false; 6 respuestas con texto libre', accion_resultante: `Llamadas a la IA: ${llamadas}`, esperado: '0 llamadas', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('L3 · derecho de acceso y portabilidad: exportación íntegra y auditada del expediente', async () => {
  const p = ev.prueba('L3', 'Acceso y portabilidad', 'El expediente completo se entrega en formato estructurado y la entrega queda registrada.');
  const api = await iniciarApp();
  try {
    const v = await crearCaso(api); const id = v.caso.id;
    for (let i = 0; i < 4; i++) await responder(api, id, respuestaPara);
    const r = await api.req('GET', `/api/casos/${id}/exportar?solicitante=${encodeURIComponent('Representante legal')}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.formato, 'tdah-expediente/1');
    for (const k of ['caso', 'consentimientos', 'hechos', 'respuestas', 'preguntas', 'decisiones']) assert.ok(k in r.body, k);
    assert.equal(r.body.respuestas.length, 4);
    const aud = (await api.req('GET', `/api/casos/${id}/auditoria`)).body;
    const d = aud.decisiones.find((x) => x.tipo === 'expediente_exportado');
    assert.ok(d);
    ev.paso(p, { entrada: 'GET /exportar', accion_resultante: `${Object.keys(r.body).length} secciones; entrega auditada`, esperado: 'Copia íntegra', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('L4 · política de privacidad y términos publicados; el informe declara consentimiento y alcance', async () => {
  const p = ev.prueba('L4', 'Avisos legales', 'Las páginas de privacidad y términos están disponibles y el informe incluye la sección de consentimiento y confidencialidad.');
  const api = await iniciarApp();
  try {
    const base = `http://127.0.0.1:${api.app.server.address().port}`;
    for (const pag of ['/privacidad.html', '/terminos.html']) {
      const r = await fetch(base + pag);
      assert.equal(r.status, 200, pag);
      const t = await r.text();
      assert.match(t, /21\.719/); assert.match(t, /20\.584/); assert.match(t, /21\.331/);
    }
    const v = await crearCaso(api);
    const inf = (await api.req('GET', `/api/casos/${v.caso.id}/informe`)).body;
    assert.match(inf.markdown, /## Consentimiento, confidencialidad y alcance de este informe/);
    assert.match(inf.markdown, /no constituye por sí mismo un diagnóstico/);
    ev.paso(p, { entrada: 'GET /privacidad.html, /terminos.html, borrador del informe', accion_resultante: 'Páginas y sección legal presentes', esperado: 'Disponibles', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

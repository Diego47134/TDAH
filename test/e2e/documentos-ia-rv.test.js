// Documentos adjuntos, extracción con IA verificada contra el texto, y realidad virtual en tiempo real.
// La IA se simula con un fetch falso: no sale nada a internet.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { iniciarApp, crearCaso, vista } from './ayudantes.js';
import { crearClienteIA } from '../../src/ia.js';
import { CONSENTIMIENTO } from '../fixtures/caso-ficticio.js';

const b64 = (s) => Buffer.from(s).toString('base64');

/** .docx mínimo (ZIP sin compresión con word/document.xml). */
function docx(parrafos) {
  const xml = Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${parrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  const nombre = Buffer.from('word/document.xml'); const crc = zlib.crc32(xml);
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(xml.length, 18); loc.writeUInt32LE(xml.length, 22); loc.writeUInt16LE(nombre.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(xml.length, 20); cen.writeUInt32LE(xml.length, 24); cen.writeUInt16LE(nombre.length, 28);
  const cuerpo = Buffer.concat([loc, nombre, xml]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + nombre.length, 12); end.writeUInt32LE(cuerpo.length, 16);
  return Buffer.concat([cuerpo, cen, nombre, end]);
}

/** Cliente de IA con fetch simulado; guarda lo que se le envió. */
function iaFalsa(respuesta) {
  const enviados = [];
  const fetchImpl = async (_url, op) => {
    enviados.push(JSON.parse(op.body));
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(respuesta) } }] }) };
  };
  return { ia: crearClienteIA({ proveedor: 'deepseek', apiKey: 'prueba', fetchImpl }), enviados };
}

const TEXTO_RV = 'Informe de evaluación. Paciente: Tomás Pérez, RUT 12.345.678-9. Omisiones: percentil 8, bajo lo esperado. Errores de comisión dentro de lo esperado. La sesión se realizó tras la jornada escolar.';

test('D1 · documento de RV con IA autorizada: extrae con evidencia literal, descarta lo no verificable y seudonimiza', async () => {
  const { ia, enviados } = iaFalsa({
    documento: { clase: 'informe_rv', instrumento: 'Prueba RV', autor: null, fecha: null, condiciones: 'tras la jornada escolar' },
    rv: { variables: [
      { variable: 'Omisiones', resultado: 'percentil 8', interpretacion_del_documento: 'bajo lo esperado', evidencia: 'Omisiones: percentil 8, bajo lo esperado' },
      { variable: 'Comisiones', resultado: 'normal', interpretacion_del_documento: 'dentro de lo esperado', evidencia: 'Errores de comisión dentro de lo esperado' },
      { variable: 'Tiempo de reacción', resultado: 'lento', interpretacion_del_documento: 'lento', evidencia: 'tiempo de reacción muy lento' },
    ], limitaciones: ['Sesión tras la jornada escolar'] },
  });
  const api = await iniciarApp({ ia });
  try {
    const c = (await api.req('POST', '/api/casos', { etiqueta: 'Caso D1', consentimiento: { ...CONSENTIMIENTO, acepta_ia_externa: true } })).body.caso;
    const r = await api.req('POST', `/api/casos/${c.id}/documentos`, { nombre: 'rv.txt', contenido_base64: b64(TEXTO_RV), clase: 'informe_rv', ocultar: ['Tomás Pérez'], profesional: 'Ps. Prueba' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.metodo, 'ia');
    assert.equal(r.body.aplicado.rv, 2);
    assert.equal(r.body.descartados.length, 1, 'la frase inventada se descarta');
    const enviado = JSON.stringify(enviados[0]);
    assert.ok(!enviado.includes('Tomás') && !enviado.includes('Pérez') && !enviado.includes('12.345.678'), 'no salen nombres ni RUT');
    const v = await vista(api, c.id);
    assert.equal(v.documentos.length, 1);
    assert.ok(v.ia.habilitada && v.ia.autorizada);
    const ev = v.evaluaciones.find((e) => e.instrumento_id === 'RV');
    assert.equal(ev?.estado, 'realizada');
    const arch = await fetch(`${api.base}/api/casos/${c.id}/documentos/${v.documentos[0].id}/archivo`);
    assert.equal(await arch.text(), TEXTO_RV, 'el original se descarga íntegro');
  } finally { await api.cerrar(); }
});

test('D2 · sin autorización de IA no se envía nada al proveedor', async () => {
  const { ia, enviados } = iaFalsa({});
  const api = await iniciarApp({ ia });
  try {
    const c = (await crearCaso(api, 'Caso D2')).caso;
    const r = await api.req('POST', `/api/casos/${c.id}/documentos`, { nombre: 'rv.txt', contenido_base64: b64(TEXTO_RV), clase: 'informe_rv' });
    assert.equal(r.status, 200);
    assert.equal(r.body.metodo, 'sin_extraccion');
    assert.equal(enviados.length, 0);
    assert.equal((await vista(api, c.id)).ia.autorizada, false);
  } finally { await api.cerrar(); }
});

test('D3 · Word (.docx) se lee; formatos no soportados se rechazan', async () => {
  const api = await iniciarApp();
  try {
    const c = (await crearCaso(api, 'Caso D3')).caso;
    const r = await api.req('POST', `/api/casos/${c.id}/documentos`, { nombre: 'nota.docx', contenido_base64: docx(['Primer párrafo del documento de prueba.', 'Segundo párrafo con más texto.']).toString('base64'), clase: 'otro' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await vista(api, c.id);
    assert.equal(v.documentos[0].tipo_mime, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const malo = await api.req('POST', `/api/casos/${c.id}/documentos`, { nombre: 'foto.jpg', contenido_base64: b64('xx'), clase: 'otro' });
    assert.equal(malo.status, 400);
  } finally { await api.cerrar(); }
});

test('V1 · el casco envía datos en tiempo real con su token y la sesión queda en el expediente', async () => {
  const api = await iniciarApp({ rvToken: 'token-casco-prueba' });
  try {
    const c = (await crearCaso(api, 'Caso V1')).caso;
    const casco = { 'x-rv-token': 'token-casco-prueba' };
    const s = await api.req('POST', '/api/rv/sesiones', { caso_codigo: c.codigo, dispositivo: 'Meta Quest 3S' }, casco);
    assert.equal(s.status, 200, JSON.stringify(s.body));
    const sid = s.body.sesion_id;
    const malo = await api.req('POST', `/api/rv/sesiones/${sid}/datos`, { metricas: { inventada: 1 } }, casco);
    assert.equal(malo.status, 400, 'variable no reconocida');
    assert.equal((await api.req('POST', `/api/rv/sesiones/${sid}/datos`, { metricas: { omisiones: { valor: 14, percentil: 9 } }, eventos: 30 }, casco)).status, 200);
    assert.equal((await api.req('POST', `/api/rv/sesiones/${sid}/datos`, { metricas: { comisiones: 3 }, eventos: 20 }, casco)).status, 200);
    let v = await vista(api, c.id);
    assert.equal(v.rv_sesiones[0].estado, 'en_curso');
    assert.equal(v.rv_sesiones[0].eventos, 50);
    assert.deepEqual(Object.keys(v.rv_sesiones[0].metricas).sort(), ['comisiones', 'omisiones']);
    assert.equal((await api.req('POST', `/api/rv/sesiones/${sid}/finalizar`, {}, casco)).status, 200);
    v = await vista(api, c.id);
    assert.equal(v.rv_sesiones[0].estado, 'finalizada');
    assert.equal(v.evaluaciones.find((e) => e.instrumento_id === 'RV')?.estado, 'realizada');
    assert.equal((await api.req('POST', `/api/rv/sesiones/${sid}/datos`, { metricas: { omisiones: 1 } }, casco)).status, 409, 'sesión cerrada no acepta datos');
  } finally { await api.cerrar(); }
});

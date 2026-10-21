// Cifrado en reposo (base de datos, documentos y respaldos) y sistema de licencias por instalación.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { crearApp } from '../../src/server.js';
import { crearCifrador, cargarCifrado, nuevaClave, ErrorCifrado } from '../../src/cifrado.js';
import { abrirDB, SENSIBLES } from '../../src/db.js';
import { respaldar } from '../../src/respaldo.js';
import { firmarLicencia, evaluarLicencia, dominioAutorizado } from '../../src/licencia.js';
import { rutaDBTemporal, crearEvidencia, responder } from './ayudantes.js';
import { CONSENTIMIENTO, respuestaPara } from '../fixtures/caso-ficticio.js';

const ev = crearEvidencia('cifrado-licencias');
after(() => ev.escribir());

const NOMBRE = 'Juanito Pérez Soto';
const MOTIVO = 'Juanito se distrae muchísimo en clases de matemáticas';

async function levantar(opts) {
  const app = crearApp({ tokenAcceso: '', ia: { habilitada: false }, ...opts });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const req = async (metodo, ruta, cuerpo, headers = {}) => {
    const r = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', ...headers }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const texto = await r.text();
    let body; try { body = JSON.parse(texto); } catch { body = texto; }
    return { status: r.status, body };
  };
  return { app, base, req, cerrar: () => app.cerrar() };
}

/** Lee la base SIN la capa de cifrado: lo que vería alguien que copia el archivo. */
function volcadoCrudo(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const filas = [];
    for (const [t, cols] of Object.entries(SENSIBLES)) for (const c of cols) for (const f of db.prepare(`SELECT ${c} AS v FROM ${t} WHERE ${c} IS NOT NULL`).all()) filas.push({ t, c, v: String(f.v) });
    return filas;
  } finally { db.close(); }
}

async function casoConDatos(api) {
  const r = await api.req('POST', '/api/casos', { etiqueta: NOMBRE, consentimiento: { ...CONSENTIMIENTO, otorgante: 'María Soto (madre)' } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.caso.id;
  const apiAyudante = { req: api.req };
  await responder(apiAyudante, id, (q) => (q.id === 'INI-MOTIVO' ? { texto: MOTIVO } : respuestaPara(q)));
  for (let i = 0; i < 4; i++) await responder(apiAyudante, id, respuestaPara);
  return id;
}

test('C1 · los datos clínicos quedan cifrados en la base de datos y la app los lee normalmente', async () => {
  const p = ev.prueba('C1', 'Cifrado de campos', 'Ley 21.719 art. 14 quinquies: cifrado de datos sensibles en reposo (AES-256-GCM).');
  const dbPath = rutaDBTemporal();
  const cifrado = { cifrador: crearCifrador(nuevaClave()), origen: 'entorno' };
  const api = await levantar({ dbPath, cifrado });
  try {
    const id = await casoConDatos(api);
    const v = (await api.req('GET', `/api/casos/${id}`)).body;
    assert.equal(v.caso.etiqueta, NOMBRE, 'la app muestra el dato descifrado');
    const exp = (await api.req('GET', `/api/casos/${id}/exportar`)).body;
    assert.ok(JSON.stringify(exp).includes(MOTIVO), 'la exportación (derecho de acceso) entrega los datos legibles');
    const salud = (await api.req('GET', '/api/salud')).body;
    assert.equal(salud.cifrado.activo, true); assert.equal(salud.cifrado.algoritmo, 'AES-256-GCM');
    assert.equal(salud.cifrado.huella, cifrado.cifrador.huella);
    api.app.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const crudo = volcadoCrudo(dbPath);
    assert.ok(crudo.length > 10);
    const plano = crudo.filter((f) => !f.v.startsWith('enc1:'));
    assert.deepEqual(plano, [], `campos sin cifrar: ${JSON.stringify(plano.slice(0, 3))}`);
    const bytes = fs.readFileSync(dbPath).toString('latin1');
    for (const s of ['Juanito', 'matem', 'María Soto']) assert.ok(!bytes.includes(s), `«${s}» no aparece en el archivo de la base`);
    ev.paso(p, { entrada: `Caso «${NOMBRE}», motivo y consentimiento`, accion_resultante: `${crudo.length} campos sensibles en la base, todos «enc1:…»; nombre ausente del archivo`, esperado: 'Nada legible sin la clave; la app y la exportación los muestran', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('C2 · con otra clave la base no abre; sin clave tampoco', async () => {
  const p = ev.prueba('C2', 'Clave equivocada', 'Una clave distinta nunca lee ni sobrescribe los datos: la app se detiene con un mensaje claro.');
  const dbPath = rutaDBTemporal();
  const clave = nuevaClave();
  const api = await levantar({ dbPath, cifrado: { cifrador: crearCifrador(clave), origen: 'entorno' } });
  await casoConDatos(api); await api.cerrar();
  assert.throws(() => abrirDB(dbPath, { cifrador: crearCifrador(nuevaClave()) }), /no es la que cifró esta base/);
  assert.throws(() => abrirDB(dbPath), /está cifrada/);
  const ok = abrirDB(dbPath, { cifrador: crearCifrador(clave) });
  assert.equal(ok.prepare('SELECT etiqueta FROM casos').get().etiqueta, NOMBRE); ok.close();
  ev.paso(p, { entrada: 'Abrir con otra clave / sin clave / con la clave correcta', accion_resultante: 'Error / Error / datos legibles', ok: true });
  ev.cerrar(p, true);
});

test('C3 · una base anterior en texto plano se cifra automáticamente al actualizar', async () => {
  const p = ev.prueba('C3', 'Migración', 'Las instalaciones existentes se cifran solas al primer arranque con la versión nueva, sin perder datos.');
  const dbPath = rutaDBTemporal();
  let api = await levantar({ dbPath, cifrado: null });
  const id = await casoConDatos(api); await api.cerrar();
  assert.ok(volcadoCrudo(dbPath).some((f) => f.v.includes('Juanito')), 'antes: texto plano');
  api = await levantar({ dbPath, cifrado: { cifrador: crearCifrador(nuevaClave()), origen: 'entorno' } });
  try {
    assert.equal((await api.req('GET', `/api/casos/${id}`)).body.caso.etiqueta, NOMBRE);
    api.app.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    assert.deepEqual(volcadoCrudo(dbPath).filter((f) => !f.v.startsWith('enc1:')), []);
    assert.ok(!fs.readFileSync(dbPath).toString('latin1').includes('Juanito'), 'sin restos en páginas libres (VACUUM + secure_delete)');
    await responder({ req: api.req }, id, respuestaPara);
    ev.paso(p, { entrada: 'Base creada sin cifrado → arranque con clave', accion_resultante: 'Todos los campos cifrados; el caso sigue funcionando', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('C4 · documentos adjuntos cifrados en disco y con nombre opaco', async () => {
  const p = ev.prueba('C4', 'Documentos cifrados', 'El archivo original no es legible en el servidor; se descarga intacto desde la app.');
  const dbPath = rutaDBTemporal();
  const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'tdah-docs-'));
  process.env.DOCS_PATH = docs;
  const api = await levantar({ dbPath, cifrado: { cifrador: crearCifrador(nuevaClave()), origen: 'entorno' } });
  try {
    const id = (await api.req('POST', '/api/casos', { etiqueta: 'Caso C4', consentimiento: CONSENTIMIENTO })).body.caso.id;
    const original = Buffer.from(`Informe de ${NOMBRE}: se distrae en clases y no termina tareas desde hace más de seis meses.`);
    const r = await api.req('POST', `/api/casos/${id}/documentos`, { nombre: `informe-${NOMBRE}.txt`, contenido_base64: original.toString('base64'), clase: 'otro', profesional: 'Prof. Prueba' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const archivos = fs.readdirSync(path.join(docs, id));
    assert.equal(archivos.length, 1);
    assert.match(archivos[0], /^\d+-[0-9a-f]{16}\.enc$/, 'nombre en disco sin datos del paciente');
    const enDisco = fs.readFileSync(path.join(docs, id, archivos[0]));
    assert.equal(enDisco.subarray(0, 8).toString(), 'TDAHENC1');
    assert.ok(!enDisco.includes(Buffer.from('Juanito')));
    const doc = (await api.req('GET', `/api/casos/${id}`)).body.documentos[0];
    const bajada = await fetch(`${api.base}/api/casos/${id}/documentos/${doc.id}/archivo`);
    assert.ok(Buffer.from(await bajada.arrayBuffer()).equals(original), 'la descarga devuelve el original');
    ev.paso(p, { entrada: `Subir «informe-${NOMBRE}.txt»`, accion_resultante: `En disco: ${archivos[0]} (cabecera TDAHENC1); descarga idéntica al original`, ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); delete process.env.DOCS_PATH; fs.rmSync(docs, { recursive: true, force: true }); }
});

test('C5 · respaldos cifrados; se restauran solo con la clave', async () => {
  const p = ev.prueba('C5', 'Respaldos cifrados', 'Los respaldos se pueden guardar fuera del servidor sin exponer datos.');
  const dbPath = rutaDBTemporal();
  const clave = nuevaClave();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdah-resp-'));
  const api = await levantar({ dbPath, cifrado: { cifrador: crearCifrador(clave), origen: 'entorno' } });
  try {
    await casoConDatos(api);
    const archivo = respaldar(api.app.db, dir);
    assert.match(archivo, /\.sqlite\.enc$/);
    const buf = fs.readFileSync(archivo);
    assert.equal(buf.subarray(0, 8).toString(), 'TDAHENC1');
    assert.ok(!buf.includes(Buffer.from('SQLite format')), 'ni siquiera la estructura de la base es visible');
    assert.equal(fs.readdirSync(dir).length, 1, 'no quedan temporales sin cifrar');
    const destino = path.join(dir, 'restaurada.sqlite');
    execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/restaurar-respaldo.js', archivo, destino], { env: { ...process.env, TDAH_CLAVE_CIFRADO: clave } });
    const db = abrirDB(destino, { cifrador: crearCifrador(clave) });
    assert.equal(db.prepare('SELECT etiqueta FROM casos').get().etiqueta, NOMBRE); db.close();
    assert.throws(() => execFileSync(process.execPath, ['scripts/restaurar-respaldo.js', archivo, path.join(dir, 'x.sqlite')], { env: { ...process.env, TDAH_CLAVE_CIFRADO: nuevaClave() }, stdio: 'pipe' }));
    ev.paso(p, { entrada: 'Respaldo → restaurar con la clave / con otra clave', accion_resultante: 'Archivo .sqlite.enc ilegible; restauración correcta solo con la clave', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('C6 · clave de cifrado: variable de entorno, o archivo creado una sola vez con permisos 600', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tdah-clave-'));
  const archivo = path.join(home, '.tdah-clave-cifrado');
  const a = cargarCifrado({ env: { TDAH_ARCHIVO_CLAVE: archivo }, dbPath: path.join(home, 'x.sqlite') });
  assert.equal(a.origen, 'generada');
  assert.equal(fs.statSync(archivo).mode & 0o777, 0o600);
  const b = cargarCifrado({ env: { TDAH_ARCHIVO_CLAVE: archivo }, dbPath: path.join(home, 'x.sqlite') });
  assert.equal(b.origen, 'archivo'); assert.equal(b.cifrador.huella, a.cifrador.huella);
  const clave = fs.readFileSync(archivo, 'utf8');
  const c = cargarCifrado({ env: { TDAH_CLAVE_CIFRADO: clave }, dbPath: path.join(home, 'x.sqlite') });
  assert.equal(c.origen, 'entorno'); assert.equal(c.cifrador.huella, a.cifrador.huella, 'la misma clave en la variable de entorno sirve');
  assert.throws(() => cargarCifrado({ env: { TDAH_CLAVE_CIFRADO: 'corta' }, dbPath: 'x' }), ErrorCifrado);
  const cif = a.cifrador;
  const t = cif.cifrarTexto('dato');
  assert.notEqual(cif.cifrarTexto('dato'), t, 'IV aleatorio: el mismo dato nunca produce el mismo texto cifrado');
  const alterado = t.slice(0, -4) + (t.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
  assert.throws(() => cif.descifrarTexto(alterado), /alterado/);
  fs.rmSync(home, { recursive: true, force: true });
});

// ------------------------------------------------------------------ licencias ---

const PAR = crypto.generateKeyPairSync('ed25519');
const PUBLICA = PAR.publicKey.export({ type: 'spki', format: 'pem' });
const hoy = (dias = 0) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
const lic = (extra = {}) => firmarLicencia({ id: 'LIC-PRUEBA', cliente: 'Centro de Prueba SpA', emitida: hoy(), vence: hoy(365), dominios: [], ...extra }, PAR.privateKey);

test('L1 · en producción sin licencia: solo lectura (consultar y exportar sí; crear no). Con licencia: funciona', async () => {
  const p = ev.prueba('L1', 'Licencia por instalación', 'Sin licencia válida no se crean casos, pero los expedientes siguen accesibles y exportables.');
  const dbPath = rutaDBTemporal();
  const token = 'token-de-prueba-0123456789';
  const H = { authorization: `Bearer ${token}` };
  // Caso creado antes (p. ej. con una licencia que luego venció).
  let api = await levantar({ dbPath, cifrado: null });
  const id = (await api.req('POST', '/api/casos', { etiqueta: 'Caso previo', consentimiento: CONSENTIMIENTO })).body.caso.id;
  await api.cerrar();
  api = await levantar({ dbPath, cifrado: null, produccion: true, tokenAcceso: token, clavePublicaLicencias: PUBLICA, licenciaEntorno: '' });
  try {
    const s = (await api.req('GET', '/api/salud')).body;
    assert.equal(s.licencia.estado, 'ausente'); assert.equal(s.licencia.permite_escritura, false);
    assert.ok(s.advertencias.some((a) => /Licencia/.test(a)));
    const crear = await api.req('POST', '/api/casos', { etiqueta: 'Nuevo', consentimiento: CONSENTIMIENTO }, H);
    assert.equal(crear.status, 402); assert.match(crear.body.error, /solo lectura/);
    assert.equal((await api.req('GET', `/api/casos/${id}`, null, H)).status, 200, 'consultar sigue permitido');
    assert.equal((await api.req('GET', `/api/casos/${id}/exportar`, null, H)).status, 200, 'exportar (derecho de acceso) sigue permitido');
    ev.paso(p, { entrada: 'Producción sin licencia: crear caso / ver / exportar', accion_resultante: `${crear.status} / 200 / 200`, esperado: 'Solo lectura', ok: true });

    const falsa = lic().replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    assert.equal((await api.req('POST', '/api/licencia', { licencia: falsa }, H)).status, 400, 'firma alterada');
    const otraFirma = firmarLicencia({ id: 'X', cliente: 'Pirata', emitida: hoy(), vence: null }, crypto.generateKeyPairSync('ed25519').privateKey);
    const r0 = await api.req('POST', '/api/licencia', { licencia: otraFirma }, H);
    assert.equal(r0.status, 400); assert.match(r0.body.error, /firma/);
    assert.equal((await api.req('POST', '/api/licencia', { licencia: lic() })).status, 401, 'instalar exige la clave de acceso');
    const ins = await api.req('POST', '/api/licencia', { licencia: lic() }, H);
    assert.equal(ins.status, 200); assert.equal(ins.body.estado, 'valida');
    assert.equal((await api.req('POST', '/api/casos', { etiqueta: 'Nuevo', consentimiento: CONSENTIMIENTO }, H)).status, 201);
    ev.paso(p, { entrada: 'Licencia alterada / firmada por otro / válida', accion_resultante: '400 / 400 / 200 y se pueden crear casos', ok: true });
    ev.cerrar(p, true);
  } finally { await api.cerrar(); }
});

test('L2 · vencimiento con gracia, dominio autorizado y máximo de casos', async () => {
  const ahora = new Date();
  assert.equal(evaluarLicencia(lic({ vence: hoy(10) }), { clavePublica: PUBLICA, ahora, host: 'x' }).estado, 'por_vencer');
  const g = evaluarLicencia(lic({ vence: hoy(-5) }), { clavePublica: PUBLICA, ahora, host: 'x' });
  assert.equal(g.estado, 'gracia'); assert.equal(g.permite_escritura, true);
  const v = evaluarLicencia(lic({ vence: hoy(-20) }), { clavePublica: PUBLICA, ahora, host: 'x' });
  assert.equal(v.estado, 'vencida'); assert.equal(v.permite_escritura, false);
  assert.equal(evaluarLicencia(lic({ vence: null }), { clavePublica: PUBLICA, ahora, host: 'x' }).estado, 'valida');
  assert.ok(dominioAutorizado(['evaluacion.ejemplo.cl'], 'evaluacion.ejemplo.cl:443'));
  assert.ok(dominioAutorizado(['*.ejemplo.cl'], 'app.ejemplo.cl'));
  assert.ok(!dominioAutorizado(['evaluacion.ejemplo.cl'], 'otro-sitio.cl'));

  const token = 'token-de-prueba-0123456789'; const H = { authorization: `Bearer ${token}` };
  const api = await levantar({ dbPath: rutaDBTemporal(), cifrado: null, produccion: true, tokenAcceso: token, clavePublicaLicencias: PUBLICA,
    licenciaEntorno: lic({ dominios: ['127.0.0.1'], casos_max: 1 }) });
  try {
    assert.equal((await api.req('POST', '/api/casos', { etiqueta: 'Uno', consentimiento: CONSENTIMIENTO }, H)).status, 201);
    const dos = await api.req('POST', '/api/casos', { etiqueta: 'Dos', consentimiento: CONSENTIMIENTO }, H);
    assert.equal(dos.status, 402); assert.match(dos.body.error, /permite 1 caso/);
    // Misma instalación servida desde un dominio no autorizado (cabecera Host distinta).
    const otroDominio = await new Promise((ok, fallo) => {
      const rq = http.request(`${api.base}/api/consultas`, { method: 'POST', headers: { ...H, host: 'copia-no-autorizada.cl', 'content-type': 'application/json' } }, (res) => { res.resume(); res.on('end', () => ok(res.statusCode)); });
      rq.on('error', fallo); rq.end(JSON.stringify({ pregunta: '¿Qué es el TDAH?' }));
    });
    assert.equal(otroDominio, 402);
    assert.equal((await api.req('POST', '/api/licencia', { licencia: lic() }, H)).status, 409, 'definida por entorno: no se reemplaza desde la app');
  } finally { await api.cerrar(); }
});

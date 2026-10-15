// Configuración de producción (Hostinger): token obligatorio, cabeceras de seguridad,
// punto de entrada server.js, base de datos fuera de la carpeta de despliegue y respaldos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { crearApp } from '../../src/server.js';
import { rutaDBTemporal, crearEvidencia } from './ayudantes.js';

const ev = crearEvidencia('produccion');
after(() => ev.escribir());

async function levantar(opts) {
  const app = crearApp({ dbPath: rutaDBTemporal(), ia: { habilitada: false }, ...opts });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { app, base };
}

test('P1 · en producción sin APP_ACCESS_TOKEN la API queda bloqueada con un mensaje claro', async () => {
  const p = ev.prueba('P1', 'Token obligatorio en producción', 'Un dominio público nunca expone el expediente sin token.');
  const { app, base } = await levantar({ produccion: true, tokenAcceso: '', advertencias: [] });
  try {
    const r = await fetch(`${base}/api/casos`);
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /APP_ACCESS_TOKEN/);
    const s = await (await fetch(`${base}/api/salud`)).json();
    assert.equal(s.entorno, 'produccion');
    assert.ok(s.advertencias.some((a) => /APP_ACCESS_TOKEN/.test(a)));
    assert.equal((await fetch(`${base}/`)).status, 200, 'la interfaz carga y muestra el mensaje');
    ev.paso(p, { entrada: 'GET /api/casos sin token configurado', accion_resultante: `HTTP ${r.status}`, esperado: '503 con instrucción', ok: true });
    ev.cerrar(p, true);
  } finally { await app.cerrar(); }
});

test('P2 · con token: sin cabecera 401, con cabecera 200; cabeceras de seguridad presentes', async () => {
  const p = ev.prueba('P2', 'Acceso con token y cabeceras', 'Bearer token y CSP en todas las respuestas.');
  const token = 'token-de-prueba-0123456789';
  const { app, base } = await levantar({ produccion: true, tokenAcceso: token, advertencias: [] });
  try {
    const sin = await fetch(`${base}/api/casos`);
    const con = await fetch(`${base}/api/casos`, { headers: { authorization: `Bearer ${token}` } });
    const mal = await fetch(`${base}/api/casos`, { headers: { authorization: 'Bearer otro' } });
    assert.equal(sin.status, 401); assert.equal(mal.status, 401); assert.equal(con.status, 200);
    const pag = await fetch(`${base}/`);
    assert.match(pag.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(pag.headers.get('x-frame-options'), 'DENY');
    ev.paso(p, { entrada: 'Sin token / token incorrecto / token correcto', accion_resultante: `${sin.status} / ${mal.status} / ${con.status}`, esperado: '401 / 401 / 200', ok: true });
    ev.cerrar(p, true);
  } finally { await app.cerrar(); }
});

function peticionSocket(socketPath, ruta, headers = {}) {
  return new Promise((ok, fallo) => {
    const req = http.request({ socketPath, path: ruta, headers }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => ok({ status: res.statusCode, body: d }));
    });
    req.on('error', fallo); req.end();
  });
}

test('P3 · server.js (entrada de Hostinger): socket, datos fuera de la carpeta de despliegue, respaldo y cierre ordenado', async () => {
  const p = ev.prueba('P3', 'Entrada de producción', 'Simula Hostinger: HOME propio, PORT como socket, token configurado, SIGTERM por inactividad.');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tdah-home-'));
  const socket = path.join(home, 'app.sock');
  const token = 'token-de-prueba-0123456789';
  const env = { ...process.env, HOME: home, PORT: socket, APP_ACCESS_TOKEN: token, NODE_ENV: '', DB_PATH: '', HOST: '' };
  delete env.NODE_ENV; delete env.DB_PATH; delete env.HOST;
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env, cwd: process.cwd() });
  let salida = '';
  proc.stdout.on('data', (d) => { salida += d; }); proc.stderr.on('data', (d) => { salida += d; });
  try {
    for (let i = 0; i < 50 && !fs.existsSync(socket); i++) await new Promise((r) => setTimeout(r, 100));
    const r = await peticionSocket(socket, '/api/casos', { authorization: `Bearer ${token}` });
    assert.equal(r.status, 200, salida);
    const db = path.join(home, 'tdah-datos', 'tdah.sqlite');
    assert.ok(fs.existsSync(db), 'base de datos en ~/tdah-datos');
    const respaldos = fs.readdirSync(path.join(home, 'tdah-datos', 'respaldos'));
    assert.equal(respaldos.length, 1, 'respaldo inicial creado');
    assert.doesNotMatch(salida, /ADVERTENCIA/, salida);
    ev.paso(p, { entrada: 'node server.js con HOME temporal y PORT=socket', accion_resultante: `GET /api/casos → ${r.status}; BD: ~/tdah-datos/tdah.sqlite; respaldos: ${respaldos.join(', ')}`, esperado: '200, datos y respaldo fuera de la app', ok: true });
    const fin = new Promise((ok) => proc.once('exit', ok));
    proc.kill('SIGTERM');
    assert.equal(await fin, 0, 'cierre ordenado');
    ev.paso(p, { entrada: 'SIGTERM (detención por inactividad)', accion_resultante: 'Proceso terminó con código 0', ok: true });
    ev.cerrar(p, true);
  } finally {
    if (proc.exitCode == null) proc.kill('SIGKILL');
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('P4 · advierte si la base de datos quedaría dentro de la carpeta de despliegue', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tdah-home-'));
  const env = { ...process.env, HOME: home, PORT: path.join(home, 's.sock'), APP_ACCESS_TOKEN: 'token-de-prueba-0123456789', DB_PATH: path.join(process.cwd(), 'data', `t-${Date.now()}.sqlite`), BACKUP_DISABLED: '1' };
  const proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env });
  let salida = '';
  proc.stdout.on('data', (d) => { salida += d; }); proc.stderr.on('data', (d) => { salida += d; });
  try {
    for (let i = 0; i < 50 && !/ADVERTENCIA/.test(salida); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(salida, /dentro de la carpeta de despliegue/);
  } finally {
    proc.kill('SIGTERM');
    await new Promise((ok) => proc.once('exit', ok));
    for (const f of fs.readdirSync('data').filter((f) => f.startsWith('t-'))) fs.rmSync(path.join('data', f));
    fs.rmSync(home, { recursive: true, force: true });
  }
});

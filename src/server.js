// Servidor HTTP: API REST + archivos estáticos de la PWA. Sin dependencias externas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirDB } from './db.js';
import { cargarProtocolo, resumenProtocolo } from './protocolo.js';
import { crearServicio, ErrorServicio } from './servicio.js';
import { crearClienteIA } from './ia.js';
import { registrarError } from './expediente.js';
import { crearControlAcceso } from './acceso.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

export function crearApp({ dbPath, protocoloPath, ia, tokenAcceso = process.env.APP_ACCESS_TOKEN,
  produccion = process.env.NODE_ENV === 'production', advertencias = [] } = {}) {
  const db = abrirDB(dbPath);
  // En producción (dominio público) la API exige token o clave: sin ellos no expone datos.
  const acceso = crearControlAcceso({ db, tokenEntorno: tokenAcceso || '', produccion });
  if (produccion && tokenAcceso && tokenAcceso.length < 16) advertencias.push('APP_ACCESS_TOKEN es corto; use al menos 16 caracteres aleatorios.');
  const protocolo = cargarProtocolo(protocoloPath);
  const clienteIA = ia ?? crearClienteIA();
  const svc = crearServicio({ db, protocolo, ia: clienteIA });

  const rutas = [];
  const on = (metodo, patron, fn) => {
    const claves = [];
    const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, k) => { claves.push(k); return '([^/]+)'; }) + '$');
    rutas.push({ metodo, re, claves, fn });
  };

  on('GET', '/api/salud', () => ({ ok: true, protocolo: protocolo.version, protocolo_estado: protocolo.estado, ia: clienteIA.habilitada ? clienteIA.modelo : 'deshabilitada (intérprete de reglas)', requiere_token: acceso.modo() !== 'abierto', configuracion_inicial_pendiente: acceso.modo() === 'pendiente',
    entorno: produccion ? 'produccion' : 'desarrollo',
    advertencias: [...advertencias, ...(acceso.modo() === 'pendiente' ? ['Falta crear la clave de acceso (abra la aplicación para configurarla).'] : [])] }));
  on('POST', '/api/configuracion-inicial', (_, b) => acceso.configurar(b.clave));
  on('GET', '/api/protocolo', () => resumenProtocolo(protocolo));
  on('GET', '/api/casos', () => svc.listarCasos());
  on('POST', '/api/casos', (_, b) => svc.crearCaso(b));
  on('GET', '/api/casos/:id', (p) => svc.vista(p.id));
  on('POST', '/api/casos/:id/respuestas', (p, b) => svc.responder(p.id, b));
  on('POST', '/api/casos/:id/informe-escolar', (p, b) => svc.cargarInformeEscolar(p.id, b));
  on('POST', '/api/casos/:id/ruta', (p, b) => svc.cambiarRuta(p.id, b));
  on('POST', '/api/casos/:id/evaluaciones', (p, b) => svc.registrarEvaluacion(p.id, b));
  on('POST', '/api/casos/:id/contradicciones/:cid/revision', (p, b) => svc.revisarContradiccion(p.id, p.cid, b));
  on('PUT', '/api/casos/:id/interpretacion', (p, b) => svc.guardarInterpretacion(p.id, b));
  on('GET', '/api/casos/:id/informe', (p) => svc.informe(p.id));
  on('POST', '/api/casos/:id/informes', (p) => svc.generarInformeFinal(p.id));
  on('GET', '/api/casos/:id/informes/:iid', (p) => svc.obtenerInformeFinal(p.id, p.iid));
  on('POST', '/api/casos/:id/informes/:iid/validacion', (p, b) => svc.validarInforme(p.id, p.iid, b));
  on('POST', '/api/casos/:id/propuestas', (p, b) => svc.proponerPregunta(p.id, b));
  on('GET', '/api/casos/:id/auditoria', (p) => svc.auditoria(p.id));

  const enviar = (res, status, cuerpo) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(cuerpo));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('content-security-policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    if (url.pathname.startsWith('/api/')) {
      const libre = url.pathname === '/api/salud' || url.pathname === '/api/configuracion-inicial';
      const modo = acceso.modo();
      if (!libre && modo === 'pendiente') {
        return enviar(res, 503, { error: 'La aplicación aún no tiene clave de acceso. Ábrala en el navegador para crearla.', configuracion_inicial: true });
      }
      if (!libre && (modo === 'entorno' || modo === 'clave')) {
        const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        const v = acceso.verificar(t, ip);
        if (v === 'bloqueado') return enviar(res, 429, { error: 'Demasiados intentos fallidos. Espere unos minutos.' });
        if (v !== 'ok') return enviar(res, 401, { error: 'Clave de acceso inválida o ausente.' });
      }
      const r = rutas.find((x) => x.metodo === req.method && x.re.test(url.pathname));
      if (!r) return enviar(res, 404, { error: 'Ruta no encontrada.' });
      const m = url.pathname.match(r.re);
      const params = Object.fromEntries(r.claves.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        let body = {};
        if (['POST', 'PUT'].includes(req.method)) {
          const chunks = []; let n = 0;
          for await (const c of req) { n += c.length; if (n > 2_000_000) throw new ErrorServicio(413, 'Cuerpo demasiado grande.'); chunks.push(c); }
          const raw = Buffer.concat(chunks).toString('utf8');
          try { body = raw ? JSON.parse(raw) : {}; } catch { throw new ErrorServicio(400, 'JSON inválido.'); }
        }
        const out = await r.fn(params, body);
        return enviar(res, req.method === 'POST' && r.re.source.includes('casos$') ? 201 : 200, out);
      } catch (e) {
        if (e instanceof ErrorServicio) return enviar(res, e.status, { error: e.message, detalle: e.detalle ?? null });
        console.error(e);
        try { registrarError(db, params.id ?? null, 'servidor', e.message, { stack: String(e.stack).slice(0, 2000) }); } catch { /* sin bucle de errores */ }
        return enviar(res, 500, { error: 'Error interno; quedó registrado en la auditoría.' });
      }
    }
    // Archivos estáticos (PWA)
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || !path.extname(rel)) rel = '/index.html';
    const archivo = path.normalize(path.join(PUBLICO, rel));
    if (!archivo.startsWith(PUBLICO)) { res.writeHead(403); return res.end(); }
    fs.readFile(archivo, (err, data) => {
      if (err) { res.writeHead(404); return res.end('No encontrado'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(archivo)] || 'application/octet-stream', 'cache-control': rel === '/sw.js' ? 'no-cache' : 'public, max-age=300' });
      res.end(data);
    });
  });

  return { server, db, svc, protocolo, cerrar: () => new Promise((ok) => server.close(() => { db.close(); ok(); })) };
}

/**
 * Arranca el servidor. PORT puede ser un número o la ruta de un socket (algunos
 * hostings administrados entregan un socket al proceso Node).
 */
export function iniciarServidor(opciones = {}) {
  const app = crearApp(opciones);
  const puerto = process.env.PORT || 3000;
  const destino = /^\d+$/.test(String(puerto)) ? [Number(puerto), process.env.HOST || '127.0.0.1'] : [puerto];
  app.server.listen(...destino, () => {
    console.log(`Sistema de evaluación TDAH escuchando en ${destino.length > 1 ? `${destino[1]}:${destino[0]}` : destino[0]}`);
    console.log(`Protocolo ${app.protocolo.version} (${app.protocolo.estado}) · IA: ${process.env.ANTHROPIC_API_KEY ? 'habilitada' : 'deshabilitada (intérprete de reglas)'}`);
    for (const a of opciones.advertencias || []) console.warn(`ADVERTENCIA: ${a}`);
  });
  // Cierre ordenado: el hosting puede detener el proceso por inactividad.
  const cerrar = (senal) => { console.log(`${senal}: cerrando`); app.cerrar().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.once('SIGTERM', () => cerrar('SIGTERM'));
  process.once('SIGINT', () => cerrar('SIGINT'));
  return app;
}

// Ejecución directa en desarrollo: node src/server.js
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciarServidor({ advertencias: [] });
}

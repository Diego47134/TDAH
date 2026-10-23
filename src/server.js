// Servidor HTTP: API REST + archivos estáticos de la PWA. Sin dependencias externas.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirDB } from './db.js';
import { cargarProtocolo, resumenProtocolo } from './protocolo.js';
import { crearServicio, ErrorServicio } from './servicio.js';
import { registrarError } from './expediente.js';
import { crearControlAcceso } from './acceso.js';
import { crearClienteIA } from './ia.js';
import { carpetaDocumentos, cifrarDocumentosExistentes } from './documentos.js';
import { cargarCifrado } from './cifrado.js';
import { crearGestorLicencias, CLAVE_PUBLICA_LICENCIAS } from './licencia.js';
import crypto from 'node:crypto';

// Rutas que funcionan aunque la licencia no permita escribir (configurar acceso e instalar licencia).
const LIBRES_DE_LICENCIA = new Set(['/api/configuracion-inicial', '/api/licencia']);
const hostDe = (req) => String(req.headers['x-forwarded-host'] || req.headers.host || '');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(__dirname, '..', 'public');

// Páginas legales: los datos del responsable del tratamiento se configuran por variables de entorno.
const PAGINAS_LEGALES = new Set(['/privacidad.html', '/terminos.html']);
const DATOS_RESPONSABLE = {
  RESPONSABLE_NOMBRE: 'nombre del prestador o institución responsable',
  RESPONSABLE_RUT: 'RUT',
  RESPONSABLE_DOMICILIO: 'domicilio',
  RESPONSABLE_CORREO: 'correo de contacto para privacidad',
};
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function completarDatosResponsable(html, env = process.env) {
  return html.replace(/\{\{(RESPONSABLE_[A-Z]+)\}\}/g, (_, k) => (env[k]?.trim()
    ? escHtml(env[k].trim())
    : `<mark class="pendiente">[completar: ${DATOS_RESPONSABLE[k] || k}]</mark>`));
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

export function crearApp({ dbPath, protocoloPath, buscador, ia, rvToken = process.env.RV_DEVICE_TOKEN, tokenAcceso = process.env.APP_ACCESS_TOKEN,
  produccion = process.env.NODE_ENV === 'production', advertencias = [],
  cifrado, clavePublicaLicencias = CLAVE_PUBLICA_LICENCIAS, licenciaRequerida = produccion, licenciaEntorno = process.env.TDAH_LICENCIA } = {}) {
  const rutaDB = dbPath || process.env.DB_PATH || 'data/tdah.sqlite';
  // Cifrado en reposo: activo siempre, salvo que se desactive explícitamente con cifrado: null.
  const cif = cifrado === undefined ? cargarCifrado({ dbPath: rutaDB, produccion }) : cifrado;
  const db = abrirDB(rutaDB, { cifrador: cif?.cifrador || null });
  const avisos = [];
  if (cif?.origen === 'generada') console.log(`Clave de cifrado generada en ${cif.archivo}. Guarde una copia fuera del servidor.`);
  if (produccion && ['archivo', 'generada'].includes(cif?.origen)) {
    avisos.push(`La clave de cifrado está en el archivo ${cif.archivo}. Guarde una copia fuera del servidor (sin ella los respaldos no se pueden restaurar) o defínala en la variable TDAH_CLAVE_CIFRADO.`);
  }
  const carpetaDocs = carpetaDocumentos(dbPath || process.env.DB_PATH);
  const migrados = cifrarDocumentosExistentes(db, carpetaDocs);
  if (migrados) console.log(`Cifrado: ${migrados} documento(s) anteriores quedaron cifrados.`);
  const licencias = crearGestorLicencias({ db, clavePublica: clavePublicaLicencias, requerida: licenciaRequerida, licenciaEntorno });
  // En producción (dominio público) la API exige token o clave: sin ellos no expone datos.
  const acceso = crearControlAcceso({ db, tokenEntorno: tokenAcceso || '', produccion });
  if (produccion && tokenAcceso && tokenAcceso.length < 16) advertencias.push('APP_ACCESS_TOKEN es corto; use al menos 16 caracteres aleatorios.');
  const protocolo = cargarProtocolo(protocoloPath);
  const clienteIA = ia ?? crearClienteIA();
  const svc = crearServicio({ db, protocolo, ia: clienteIA, carpetaDocs, ...(buscador ? { buscador } : {}) });

  const rutas = [];
  const on = (metodo, patron, fn) => {
    const claves = [];
    const re = new RegExp('^' + patron.replace(/:(\w+)/g, (_, k) => { claves.push(k); return '([^/]+)'; }) + '$');
    rutas.push({ metodo, re, claves, fn });
  };

  const resumenLicencia = (host) => {
    const l = licencias.estado(host);
    return { estado: l.estado, requerida: l.requerida, permite_escritura: l.permite_escritura, mensaje: l.mensaje, origen: l.origen,
      cliente: l.licencia?.cliente || null, vence: l.licencia?.vence || null, dias_restantes: l.dias_restantes ?? null };
  };
  on('GET', '/api/salud', (_p, _b, _q, { host }) => {
    const lic = resumenLicencia(host);
    return { ok: true, protocolo: protocolo.version, protocolo_estado: protocolo.estado, ia: clienteIA.habilitada ? `${clienteIA.nombre}:${clienteIA.modelo}` : 'no configurada', requiere_token: acceso.modo() !== 'abierto', configuracion_inicial_pendiente: acceso.modo() === 'pendiente',
      entorno: produccion ? 'produccion' : 'desarrollo',
      cifrado: { activo: Boolean(cif?.cifrador), algoritmo: cif?.cifrador ? 'AES-256-GCM' : null, origen_clave: cif?.origen || null, huella: cif?.cifrador?.huella || null },
      licencia: lic,
      avisos: [...avisos, ...(lic.requerida && ['por_vencer', 'gracia'].includes(lic.estado) ? [lic.mensaje] : [])],
      advertencias: [...advertencias, ...(acceso.modo() === 'pendiente' ? ['Falta crear la clave de acceso (abra la aplicación para configurarla).'] : []),
        ...(lic.requerida && !lic.permite_escritura ? [`Licencia: ${lic.mensaje}`] : [])] };
  });
  on('GET', '/api/licencia', (_p, _b, _q, { host }) => licencias.estado(host));
  on('POST', '/api/licencia', (_p, b, _q, { host }) => {
    try { return licencias.instalar(b.licencia, host); } catch (e) { throw new ErrorServicio(e.status || 400, e.message); }
  });
  on('POST', '/api/configuracion-inicial', (_, b) => acceso.configurar(b.clave));
  on('GET', '/api/protocolo', () => resumenProtocolo(protocolo));
  on('GET', '/api/casos', () => svc.listarCasos());
  on('POST', '/api/casos', (_, b, _q, { host }) => {
    const max = licencias.casosMax(host);
    if (max != null && svc.listarCasos().length >= max) throw new ErrorServicio(402, `La licencia permite ${max} caso(s) y ya se alcanzó el máximo. Solicite una ampliación de la licencia.`);
    return svc.crearCaso(b);
  });
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
  on('GET', '/api/casos/:id/colegio', (p) => svc.colegioPendiente(p.id));
  on('POST', '/api/casos/:id/colegio', (p, b) => svc.responderColegio(p.id, b));
  on('POST', '/api/casos/:id/nna', (p, b) => svc.responderNNA(p.id, b));
  on('GET', '/api/bibliografia/sugerencias', () => svc.bibliografiaSugerencias());
  on('GET', '/api/bibliografia', (_p, _b, q) => svc.buscarBibliografia({ consulta: q.get('q'), fuente: q.get('fuente') || 'europepmc', cantidad: q.get('n') }));
  on('POST', '/api/casos/:id/documentos', (p, b) => svc.subirDocumento(p.id, b));
  on('POST', '/api/casos/:id/documentos/:did/vinculacion', (p, b) => svc.vincularDocumento(p.id, p.did, b));
  on('GET', '/api/casos/:id/documentos/:did/archivo', (p) => ({ __archivo: svc.descargarDocumento(p.id, p.did) }));
  on('POST', '/api/rv/sesiones', (_p, b) => svc.rvIniciar(b.caso_id || svc.idPorCodigo(b.caso_codigo), b));
  on('POST', '/api/rv/sesiones/:sid/datos', (p, b) => svc.rvDatos(p.sid, b));
  on('POST', '/api/rv/sesiones/:sid/finalizar', (p, b) => svc.rvFinalizar(p.sid, b));
  on('POST', '/api/consultas', (_p, b) => svc.preguntar(b));
  on('POST', '/api/casos/:id/consultas/:cid/atendida', (p, b) => svc.marcarConsultaAtendida(p.id, p.cid, b));
  on('POST', '/api/casos/:id/referencias', (p, b) => svc.agregarReferencia(p.id, b));
  on('DELETE', '/api/casos/:id/referencias/:rid', (p, b) => svc.quitarReferencia(p.id, p.rid, b));
  on('GET', '/api/casos/:id/auditoria', (p) => svc.auditoria(p.id));
  on('GET', '/api/casos/:id/exportar', (p, _b, q) => svc.exportar(p.id, { solicitante: q?.get?.('solicitante') }));

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
      // El casco de realidad virtual se autentica con su propio token y solo accede a /api/rv/*.
      const tokRV = String(req.headers['x-rv-token'] || '');
      const esCasco = url.pathname.startsWith('/api/rv/') && rvToken && tokRV.length === rvToken.length && crypto.timingSafeEqual(Buffer.from(tokRV), Buffer.from(rvToken));
      if (!libre && !esCasco && (modo === 'entorno' || modo === 'clave')) {
        const t = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
        const v = acceso.verificar(t, ip);
        if (v === 'bloqueado') return enviar(res, 429, { error: 'Demasiados intentos fallidos. Espere unos minutos.' });
        if (v !== 'ok') return enviar(res, 401, { error: 'Clave de acceso inválida o ausente.' });
      }
      const r = rutas.find((x) => x.metodo === req.method && x.re.test(url.pathname));
      if (!r) return enviar(res, 404, { error: 'Ruta no encontrada.' });
      // Licencia: sin licencia válida (en producción) la app queda en solo lectura.
      const host = hostDe(req);
      if (req.method !== 'GET' && !LIBRES_DE_LICENCIA.has(url.pathname) && !licencias.permiteEscritura(host)) {
        const l = licencias.estado(host);
        return enviar(res, 402, { error: `Aplicación en solo lectura: ${l.mensaje}`, licencia: { estado: l.estado, mensaje: l.mensaje } });
      }
      const m = url.pathname.match(r.re);
      const params = Object.fromEntries(r.claves.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      try {
        let body = {};
        if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
          const chunks = []; let n = 0;
          const limite = /\/documentos$/.test(url.pathname) ? 22_000_000 : 2_000_000;
          for await (const c of req) { n += c.length; if (n > limite) throw new ErrorServicio(413, 'Cuerpo demasiado grande.'); chunks.push(c); }
          const raw = Buffer.concat(chunks).toString('utf8');
          try { body = raw ? JSON.parse(raw) : {}; } catch { throw new ErrorServicio(400, 'JSON inválido.'); }
        }
        const out = await r.fn(params, body, url.searchParams, { host });
        if (out && out.__archivo) {
          const a = out.__archivo;
          res.writeHead(200, { 'content-type': a.tipo_mime || 'application/octet-stream', 'cache-control': 'no-store',
            'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.nombre)}` });
          return res.end(a.contenido);
        }
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
      res.end(PAGINAS_LEGALES.has(rel) ? completarDatosResponsable(data.toString('utf8')) : data);
    });
  });

  return { server, db, svc, protocolo, licencias, cifrado: cif, cerrar: () => new Promise((ok) => server.close(() => { db.close(); ok(); })) };
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
    console.log(`Protocolo ${app.protocolo.version} (${app.protocolo.estado})`);
    console.log(`Cifrado en reposo: ${app.cifrado?.cifrador ? `AES-256-GCM (clave: ${app.cifrado.origen}, huella ${app.cifrado.cifrador.huella})` : 'desactivado'}`);
    const lic = app.licencias.estado('');
    console.log(`Licencia: ${lic.licencia ? `${lic.licencia.cliente} (${lic.licencia.vence ? `vence ${lic.licencia.vence}` : 'perpetua'})` : 'sin licencia instalada'}${lic.requerida ? '' : ' — no exigida fuera de producción'}`);
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

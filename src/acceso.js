// Control de acceso.
// Modos:
//  - entorno:   APP_ACCESS_TOKEN definido en las variables de entorno.
//  - clave:     clave creada en la configuración inicial desde la propia app (guardada con scrypt).
//  - pendiente: producción sin token ni clave → solo se permite crear la clave inicial.
//  - abierto:   desarrollo local sin token.
import crypto from 'node:crypto';
import { ErrorServicio } from './servicio.js';

const MIN_CLAVE = 12;
const VENTANA_MS = 10 * 60_000;
const MAX_FALLOS = 20;

export function crearControlAcceso({ db, tokenEntorno, produccion }) {
  db.exec('CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
  const leer = () => db.prepare("SELECT valor FROM config WHERE clave = 'acceso'").get()?.valor;
  const verificados = new Set();
  const fallos = new Map();

  function modo() {
    if (tokenEntorno) return 'entorno';
    if (leer()) return 'clave';
    return produccion ? 'pendiente' : 'abierto';
  }

  function bloqueado(ip) {
    const f = fallos.get(ip);
    if (!f || Date.now() - f.desde > VENTANA_MS) return false;
    return f.n >= MAX_FALLOS;
  }
  function registrarFallo(ip) {
    const f = fallos.get(ip);
    if (!f || Date.now() - f.desde > VENTANA_MS) fallos.set(ip, { n: 1, desde: Date.now() });
    else f.n++;
  }

  function verificar(token, ip = '') {
    if (bloqueado(ip)) return 'bloqueado';
    let ok = false;
    const m = modo();
    if (token) {
      if (m === 'entorno') {
        const a = Buffer.from(token); const b = Buffer.from(tokenEntorno);
        ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      } else if (m === 'clave') {
        const huella = crypto.createHash('sha256').update(token).digest('hex');
        if (verificados.has(huella)) ok = true;
        else {
          const { sal, hash } = JSON.parse(leer());
          const dk = crypto.scryptSync(token, Buffer.from(sal, 'hex'), 64);
          ok = crypto.timingSafeEqual(dk, Buffer.from(hash, 'hex'));
          if (ok) verificados.add(huella);
        }
      }
    }
    if (!ok) registrarFallo(ip);
    return ok ? 'ok' : 'invalido';
  }

  function configurar(clave) {
    if (modo() !== 'pendiente') throw new ErrorServicio(409, 'La clave de acceso ya fue configurada.');
    if (typeof clave !== 'string' || clave.length < MIN_CLAVE) {
      throw new ErrorServicio(400, `La clave debe tener al menos ${MIN_CLAVE} caracteres.`);
    }
    const sal = crypto.randomBytes(16);
    const hash = crypto.scryptSync(clave, sal, 64).toString('hex');
    try {
      db.prepare("INSERT INTO config (clave, valor) VALUES ('acceso', ?)")
        .run(JSON.stringify({ sal: sal.toString('hex'), hash, creada: new Date().toISOString() }));
    } catch {
      throw new ErrorServicio(409, 'La clave de acceso ya fue configurada.');
    }
    return { ok: true };
  }

  return { modo, verificar, configurar, MIN_CLAVE };
}

#!/usr/bin/env node
// Herramienta del TITULAR del software para emitir y revisar licencias.
// La clave privada nunca se sube al repositorio ni al servidor del cliente.
//
//   node scripts/licencias.js emitir --privada ~/claves/tdah-licencias-CLAVE-PRIVADA.pem \
//        --cliente "Centro Ejemplo SpA" --rut 76.123.456-7 --dominio evaluacion.ejemplo.cl \
//        --vence 2027-12-31 --profesionales 3 [--casos 500] [--nota "Plan anual"]
//   node scripts/licencias.js verificar <licencia | archivo.txt>
//   node scripts/licencias.js claves <carpeta>     (crea un PAR NUEVO; invalida las licencias anteriores)
//
// --vence se omite (o «perpetua») para una licencia sin vencimiento. --dominio se puede repetir y
// acepta comodines («*.ejemplo.cl»); sin --dominio la licencia sirve en cualquier dominio.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { firmarLicencia, evaluarLicencia, decodificarLicencia, CLAVE_PUBLICA_LICENCIAS } from '../src/licencia.js';

const [, , comando, ...resto] = process.argv;

function opciones(args) {
  const o = { dominio: [] };
  for (let i = 0; i < args.length; i++) {
    const k = args[i].replace(/^--/, '');
    const v = args[i + 1];
    if (k === 'dominio') { o.dominio.push(v); i++; } else { o[k] = v; i++; }
  }
  return o;
}
const salir = (msg) => { console.error(`Error: ${msg}`); process.exit(1); };
const fecha = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) salir(`fecha no válida «${s}» (use AAAA-MM-DD)`); return s; };

if (comando === 'emitir') {
  const o = opciones(resto);
  if (!o.privada) salir('indique --privada <archivo .pem de la clave privada>');
  if (!o.cliente) salir('indique --cliente "<nombre del cliente>"');
  const privada = crypto.createPrivateKey(fs.readFileSync(o.privada));
  const publicaDeLaPrivada = crypto.createPublicKey(privada).export({ type: 'spki', format: 'pem' }).toString().trim();
  if (publicaDeLaPrivada !== CLAVE_PUBLICA_LICENCIAS.trim()) {
    salir('esa clave privada no corresponde a la clave pública de la app (src/licencia.js). Las licencias no serían aceptadas.');
  }
  const datos = {
    id: `LIC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    cliente: o.cliente.trim(),
    ...(o.rut ? { rut: o.rut.trim() } : {}),
    dominios: o.dominio.filter(Boolean).map((d) => d.trim().toLowerCase()),
    emitida: new Date().toISOString().slice(0, 10),
    vence: !o.vence || o.vence === 'perpetua' ? null : fecha(o.vence),
    casos_max: o.casos ? Number(o.casos) : null,
    profesionales: o.profesionales ? Number(o.profesionales) : null,
    ...(o.nota ? { nota: o.nota } : {}),
  };
  const lic = firmarLicencia(datos, privada);
  console.error(`Licencia ${datos.id} para ${datos.cliente}${datos.vence ? `, vence ${datos.vence}` : ', perpetua'}${datos.dominios.length ? `, dominios: ${datos.dominios.join(', ')}` : ''}`);
  console.log(lic);
} else if (comando === 'verificar') {
  const arg = resto[0] || salir('indique la licencia o un archivo que la contenga');
  const texto = fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg;
  try { console.log(JSON.stringify(decodificarLicencia(texto), null, 2)); } catch (e) { salir(e.message); }
  const e = evaluarLicencia(texto, { host: resto[1] || (decodificarLicencia(texto).dominios || [])[0] || 'localhost' });
  console.log(`Estado: ${e.estado} — ${e.mensaje}`);
} else if (comando === 'claves') {
  const dir = path.resolve(resto[0] || salir('indique la carpeta donde guardar la clave privada (fuera del repositorio)'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const destino = path.join(dir, 'tdah-licencias-CLAVE-PRIVADA.pem');
  if (fs.existsSync(destino)) salir(`ya existe ${destino}; no se sobrescribe`);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(destino, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.error(`Clave privada guardada en ${destino}. Guárdela en un lugar seguro y con respaldo.`);
  console.error('Reemplace CLAVE_PUBLICA_LICENCIAS en src/licencia.js por esta clave pública (las licencias anteriores dejarán de valer):');
  console.log(publicKey.export({ type: 'spki', format: 'pem' }).toString().trim());
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(comando ? 1 : 0);
}

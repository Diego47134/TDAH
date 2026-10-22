#!/usr/bin/env node
// Descifra un respaldo «tdah-….sqlite.enc» para restaurarlo.
//
//   TDAH_CLAVE_CIFRADO=<clave> node scripts/restaurar-respaldo.js respaldo.sqlite.enc tdah.sqlite
//   node scripts/restaurar-respaldo.js respaldo.sqlite.enc tdah.sqlite --archivo-clave ~/.tdah-clave-cifrado
//
// El archivo resultante sigue teniendo los campos clínicos cifrados: la app lo abre con la MISMA clave.
// Para restaurar: detenga la app, reemplace ~/tdah-datos/tdah.sqlite por el archivo descifrado y vuelva a iniciarla.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearCifrador, leerClave } from '../src/cifrado.js';

const [, , origen, destino, flag, archivoClave] = process.argv;
if (!origen || !destino) { console.error('Uso: node scripts/restaurar-respaldo.js <respaldo.sqlite.enc> <destino.sqlite> [--archivo-clave <ruta>]'); process.exit(1); }
const textoClave = process.env.TDAH_CLAVE_CIFRADO
  || fs.readFileSync(flag === '--archivo-clave' && archivoClave ? archivoClave : path.join(os.homedir(), '.tdah-clave-cifrado'), 'utf8');
const cif = crearCifrador(leerClave(textoClave));
if (fs.existsSync(destino)) { console.error(`Error: ${destino} ya existe; no se sobrescribe.`); process.exit(1); }
try {
  fs.writeFileSync(destino, cif.descifrarArchivo(fs.readFileSync(origen)), { mode: 0o600 });
} catch (e) { console.error(`Error: ${e.message}`); process.exit(1); }
console.log(`Respaldo descifrado en ${destino} (clave con huella ${cif.huella}).`);

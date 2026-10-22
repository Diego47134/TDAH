// Cifrado en reposo (Ley 21.719, art. 14 quinquies: seudonimización y cifrado como medidas de seguridad).
//
// - Campos clínicos de la base de datos: AES-256-GCM por valor, con IV aleatorio y etiqueta de
//   autenticación (detecta cualquier alteración). Formato de texto: «enc1:<huella>:<base64>».
// - Documentos adjuntos y respaldos: el mismo algoritmo sobre el archivo completo, con cabecera
//   «TDAHENC1». Los archivos sin cabecera (anteriores al cifrado) se siguen leyendo.
// - Las subclaves de campos y de archivos se derivan de una clave maestra de 32 bytes con HKDF-SHA256.
//
// La clave maestra NUNCA se guarda en la base de datos ni en los respaldos. Origen, en este orden:
//   1. Variable de entorno TDAH_CLAVE_CIFRADO (base64 o hex de 32 bytes) — recomendado.
//   2. Archivo de clave (TDAH_ARCHIVO_CLAVE; por defecto ~/.tdah-clave-cifrado en producción),
//      que se crea automáticamente la primera vez con permisos 600.
// Sin la clave, los datos cifrados y los respaldos no se pueden recuperar.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PREFIJO = 'enc1:';
const MAGIA = Buffer.from('TDAHENC1');
const IV = 12; const TAG = 16;

export class ErrorCifrado extends Error {}

/** Interpreta una clave en base64 o hexadecimal; debe tener exactamente 32 bytes. */
export function leerClave(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(t) ? Buffer.from(t, 'hex') : Buffer.from(t, 'base64');
  if (buf.length !== 32) throw new ErrorCifrado('La clave de cifrado debe tener 32 bytes (44 caracteres en base64 o 64 en hexadecimal).');
  return buf;
}

export const nuevaClave = () => crypto.randomBytes(32).toString('base64');

export function crearCifrador(claveMaestra) {
  const clave = Buffer.isBuffer(claveMaestra) ? claveMaestra : leerClave(claveMaestra);
  if (!clave || clave.length !== 32) throw new ErrorCifrado('Clave de cifrado no válida.');
  const derivar = (info) => Buffer.from(crypto.hkdfSync('sha256', clave, Buffer.alloc(0), info, 32));
  const kCampos = derivar('tdah-campos-v1');
  const kArchivos = derivar('tdah-archivos-v1');
  // Huella pública de la clave (no permite reconstruirla): detecta que se usa la clave equivocada.
  const huella = crypto.createHash('sha256').update(derivar('tdah-huella-v1')).digest('hex').slice(0, 8);

  const sellar = (k, datos) => {
    const iv = crypto.randomBytes(IV);
    const c = crypto.createCipheriv('aes-256-gcm', k, iv);
    const ct = Buffer.concat([c.update(datos), c.final()]);
    return { iv, tag: c.getAuthTag(), ct };
  };
  const abrir = (k, iv, tag, ct) => {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]);
    } catch {
      throw new ErrorCifrado('No se pudo descifrar: el dato fue alterado o la clave no corresponde.');
    }
  };

  return {
    huella,
    cifrarTexto(v) {
      if (v == null) return v;
      const s = typeof v === 'string' ? v : String(v);
      if (s.startsWith(PREFIJO)) return s;
      const { iv, tag, ct } = sellar(kCampos, Buffer.from(s, 'utf8'));
      return `${PREFIJO}${huella}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
    },
    descifrarTexto(v) {
      if (typeof v !== 'string' || !v.startsWith(PREFIJO)) return v;
      const [h, b64] = v.slice(PREFIJO.length).split(':');
      if (h !== huella) throw new ErrorCifrado(`El dato fue cifrado con otra clave (huella ${h}; la clave actual es ${huella}).`);
      const buf = Buffer.from(b64 || '', 'base64');
      return abrir(kCampos, buf.subarray(0, IV), buf.subarray(IV, IV + TAG), buf.subarray(IV + TAG)).toString('utf8');
    },
    cifrarArchivo(buf) {
      if (esArchivoCifrado(buf)) return buf;
      const { iv, tag, ct } = sellar(kArchivos, buf);
      return Buffer.concat([MAGIA, Buffer.from(huella, 'hex'), iv, tag, ct]);
    },
    descifrarArchivo(buf) {
      if (!esArchivoCifrado(buf)) return buf; // archivo anterior al cifrado
      const h = buf.subarray(MAGIA.length, MAGIA.length + 4).toString('hex');
      if (h !== huella) throw new ErrorCifrado(`El archivo fue cifrado con otra clave (huella ${h}; la clave actual es ${huella}).`);
      const p = MAGIA.length + 4;
      return abrir(kArchivos, buf.subarray(p, p + IV), buf.subarray(p + IV, p + IV + TAG), buf.subarray(p + IV + TAG));
    },
  };
}

export const esArchivoCifrado = (buf) => Buffer.isBuffer(buf) && buf.length >= MAGIA.length && buf.subarray(0, MAGIA.length).equals(MAGIA);
export const esTextoCifrado = (v) => typeof v === 'string' && v.startsWith(PREFIJO);

/**
 * Obtiene la clave maestra. Devuelve { cifrador, origen, archivo }.
 * origen: 'entorno' | 'archivo' | 'generada' | 'memoria'
 */
export function cargarCifrado({ env = process.env, dbPath, produccion = env.NODE_ENV === 'production' } = {}) {
  const deEntorno = leerClave(env.TDAH_CLAVE_CIFRADO);
  if (deEntorno) return { cifrador: crearCifrador(deEntorno), origen: 'entorno', archivo: null };
  if (!dbPath || dbPath === ':memory:') return { cifrador: crearCifrador(crypto.randomBytes(32)), origen: 'memoria', archivo: null };
  const archivo = path.resolve(env.TDAH_ARCHIVO_CLAVE
    || (produccion ? path.join(os.homedir(), '.tdah-clave-cifrado') : path.join(path.dirname(path.resolve(dbPath)), '.tdah-clave-cifrado')));
  if (fs.existsSync(archivo)) return { cifrador: crearCifrador(leerClave(fs.readFileSync(archivo, 'utf8'))), origen: 'archivo', archivo };
  fs.mkdirSync(path.dirname(archivo), { recursive: true, mode: 0o700 });
  const clave = nuevaClave();
  try {
    fs.writeFileSync(archivo, `${clave}\n`, { mode: 0o600, flag: 'wx' });
  } catch (e) {
    // Otro proceso la creó al mismo tiempo: usar esa.
    if (e.code === 'EEXIST') return { cifrador: crearCifrador(leerClave(fs.readFileSync(archivo, 'utf8'))), origen: 'archivo', archivo };
    throw e;
  }
  return { cifrador: crearCifrador(clave), origen: 'generada', archivo };
}

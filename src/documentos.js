// Documentos adjuntos al caso: guarda el archivo original fuera de la carpeta de la app y extrae
// su texto (TXT, Word .docx y PDF con texto). Los PDF escaneados (imágenes) no tienen texto
// legible: se guardan y se informa que deben transcribirse.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { esArchivoCifrado } from './cifrado.js';

export const CLASES = {
  entrevista_apoderado: 'Entrevista al apoderado (realizada fuera de la app)',
  informe_escolar: 'Informe o escala del colegio',
  informe_rv: 'Informe de realidad virtual / Nesplora',
  consentimiento: 'Consentimiento firmado',
  otro: 'Otro documento',
};
export const MAX_BYTES = 15 * 1024 * 1024;
const EXT = { '.txt': 'text/plain', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.pdf': 'application/pdf' };

export class ErrorDocumento extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

export function carpetaDocumentos(dbPath) {
  if (process.env.DOCS_PATH) return path.resolve(process.env.DOCS_PATH);
  if (!dbPath || dbPath === ':memory:') return path.join(process.env.TMPDIR || '/tmp', 'tdah-documentos');
  return path.join(path.dirname(path.resolve(dbPath)), 'documentos');
}

/** Lector mínimo de ZIP (para .docx) usando solo zlib de Node. */
function leerZip(buf, buscado) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new ErrorDocumento(400, 'El archivo Word está dañado o no es un .docx.');
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const metodo = buf.readUInt16LE(p + 10); const tam = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28); const le = buf.readUInt16LE(p + 30); const lc = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42); const nombre = buf.toString('utf8', p + 46, p + 46 + ln);
    if (nombre === buscado) {
      const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const datos = buf.subarray(inicio, inicio + tam);
      if (metodo === 0) return datos;
      if (metodo === 8) return zlib.inflateRawSync(datos);
      throw new ErrorDocumento(400, 'Compresión del archivo Word no soportada.');
    }
    p += 46 + ln + le + lc;
  }
  return null;
}

function textoDocx(buf) {
  const xml = leerZip(buf, 'word/document.xml');
  if (!xml) throw new ErrorDocumento(400, 'El archivo Word no contiene texto.');
  return xml.toString('utf8')
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function textoPdf(buf) {
  let unpdf;
  try { unpdf = await import('unpdf'); } catch { throw new ErrorDocumento(501, 'La lectura de PDF no está instalada en el servidor (dependencia «unpdf»). Suba el documento en Word o texto.'); }
  try {
    const pdf = await unpdf.getDocumentProxy(new Uint8Array(buf));
    const { text } = await unpdf.extractText(pdf, { mergePages: true });
    return String(text || '').replace(/[ \t]+\n/g, '\n').trim();
  } catch { throw new ErrorDocumento(400, 'No se pudo leer el PDF (dañado o protegido con contraseña).'); }
}

/** Devuelve { texto, tipo_mime, advertencia }. */
export async function extraerTexto(buf, nombre) {
  const ext = path.extname(String(nombre || '')).toLowerCase();
  if (!EXT[ext]) throw new ErrorDocumento(400, 'Formato no soportado. Use PDF, Word (.docx) o texto (.txt).');
  let texto;
  if (ext === '.txt') texto = buf.toString('utf8').trim();
  else if (ext === '.docx') texto = textoDocx(buf);
  else texto = await textoPdf(buf);
  const advertencia = texto.replace(/\s/g, '').length < 40
    ? (ext === '.pdf' ? 'El PDF no tiene texto legible (probablemente es un documento escaneado). Quedó guardado; transcriba su contenido o súbalo en Word.' : 'El documento no tiene texto.')
    : null;
  return { texto, tipo_mime: EXT[ext], advertencia };
}

/**
 * Guarda el archivo original. Con `cifrador`, el contenido queda cifrado (AES-256-GCM) y el nombre
 * en disco es opaco (el nombre real, que puede contener datos del paciente, va cifrado en la base).
 */
export function guardarArchivo(carpeta, casoId, nombre, buf, cifrador = null) {
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const rel = cifrador
    ? path.join(casoId, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.enc`)
    : path.join(casoId, `${Date.now()}-${sha256.slice(0, 12)}-${String(nombre).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-120)}`);
  const destino = path.join(carpeta, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true, mode: 0o700 });
  fs.writeFileSync(destino, cifrador ? cifrador.cifrarArchivo(buf) : buf, { mode: 0o600 });
  return { archivo: rel, sha256, bytes: buf.length };
}

/** Lee el archivo original (lo descifra si está cifrado; los anteriores al cifrado se leen tal cual). */
export function leerArchivo(carpeta, rel, cifrador = null) {
  const p = path.normalize(path.join(carpeta, rel));
  if (!p.startsWith(path.normalize(carpeta))) throw new ErrorDocumento(400, 'Ruta no válida.');
  const buf = fs.readFileSync(p);
  return cifrador ? cifrador.descifrarArchivo(buf) : buf;
}

/**
 * Cifra los documentos guardados antes del cifrado: los reescribe cifrados con nombre opaco,
 * actualiza la ruta en la base y borra el original. Devuelve cuántos cifró.
 */
export function cifrarDocumentosExistentes(db, carpeta) {
  const cif = db.cifrador;
  if (!cif) return 0;
  let n = 0;
  for (const d of db.prepare("SELECT id, caso_id, archivo FROM documentos WHERE archivo NOT LIKE '%.enc'").all()) {
    const origen = path.normalize(path.join(carpeta, d.archivo));
    if (!origen.startsWith(path.normalize(carpeta)) || !fs.existsSync(origen)) continue;
    const buf = fs.readFileSync(origen);
    const rel = path.join(d.caso_id, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.enc`);
    fs.writeFileSync(path.join(carpeta, rel), esArchivoCifrado(buf) ? buf : cif.cifrarArchivo(buf), { mode: 0o600 });
    db.prepare('UPDATE documentos SET archivo = ? WHERE id = ?').run(rel, d.id);
    fs.rmSync(origen, { force: true });
    n++;
  }
  return n;
}

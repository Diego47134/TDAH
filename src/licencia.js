// Sistema de licencias por instalación.
//
// Una licencia es un texto «TDAH1.<datos>.<firma>» firmado con Ed25519 por el titular del software
// con su CLAVE PRIVADA (que nunca está en este repositorio ni en el servidor del cliente). La app
// solo contiene la CLAVE PÚBLICA: puede verificar licencias, pero no fabricarlas.
//
// Datos de la licencia: id, cliente, rut, dominios autorizados, fecha de emisión, vencimiento
// (o perpetua), máximo de casos y número de profesionales contratados.
//
// En producción, sin licencia válida la app queda en SOLO LECTURA: se pueden consultar y exportar
// los expedientes (los derechos de los titulares de datos nunca se bloquean), pero no crear casos
// ni registrar información nueva. Tras el vencimiento hay 15 días de gracia con aviso.
//
// Emitir licencias: scripts/licencias.js (ver docs/LICENCIAS.md).
import crypto from 'node:crypto';

/** Clave pública oficial del titular del software para verificar licencias. */
export const CLAVE_PUBLICA_LICENCIAS = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA9NF+Va+Ir3pRwIJDTgH1r8IXLqWgag1WM/B0VmS+5iM=
-----END PUBLIC KEY-----`;

export const PREFIJO_LICENCIA = 'TDAH1';
export const DIAS_GRACIA = 15;
export const DIAS_AVISO = 30;
const DIA = 86_400_000;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** Firma una licencia (lo usa solo el script del titular, con la clave privada). */
export function firmarLicencia(datos, clavePrivada) {
  const cuerpo = b64url(JSON.stringify({ v: 1, ...datos }));
  const firma = crypto.sign(null, Buffer.from(`${PREFIJO_LICENCIA}.${cuerpo}`), clavePrivada);
  return `${PREFIJO_LICENCIA}.${cuerpo}.${b64url(firma)}`;
}

/** Decodifica y verifica la firma. Devuelve los datos o lanza un Error con el motivo. */
export function decodificarLicencia(texto, clavePublica = CLAVE_PUBLICA_LICENCIAS) {
  const t = String(texto ?? '').replace(/\s+/g, '');
  const partes = t.split('.');
  if (partes.length !== 3 || partes[0] !== PREFIJO_LICENCIA) throw new Error('El texto no tiene el formato de una licencia (debe comenzar con «TDAH1.»).');
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(`${partes[0]}.${partes[1]}`), clavePublica, Buffer.from(partes[2], 'base64url')); } catch { ok = false; }
  if (!ok) throw new Error('La firma de la licencia no es válida (fue alterada o no la emitió el titular del software).');
  let datos;
  try { datos = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')); } catch { throw new Error('Licencia dañada.'); }
  if (datos.v !== 1 || !datos.id || !datos.cliente || !datos.emitida) throw new Error('Licencia incompleta.');
  return datos;
}

const normalizarHost = (h) => String(h || '').toLowerCase().split(',')[0].trim().replace(/:\d+$/, '').replace(/\.$/, '');

/** ¿El dominio de la petición está autorizado? «*.ejemplo.cl» autoriza subdominios. */
export function dominioAutorizado(dominios, host) {
  if (!Array.isArray(dominios) || !dominios.length) return true;
  const h = normalizarHost(host);
  if (!h) return false;
  return dominios.some((d) => {
    const x = normalizarHost(d);
    return x.startsWith('*.') ? h === x.slice(2) || h.endsWith(x.slice(1)) : h === x;
  });
}

/**
 * Estado de una licencia en un momento dado.
 * estado: 'valida' | 'por_vencer' | 'gracia' | 'vencida' | 'invalida' | 'ausente' | 'dominio_no_autorizado'
 */
export function evaluarLicencia(texto, { clavePublica = CLAVE_PUBLICA_LICENCIAS, ahora = new Date(), host } = {}) {
  if (!String(texto ?? '').trim()) return { estado: 'ausente', permite_escritura: false, mensaje: 'No hay licencia instalada.' };
  let datos;
  try { datos = decodificarLicencia(texto, clavePublica); } catch (e) { return { estado: 'invalida', permite_escritura: false, mensaje: e.message }; }
  const publico = { id: datos.id, cliente: datos.cliente, rut: datos.rut || null, dominios: datos.dominios || [], emitida: datos.emitida,
    vence: datos.vence || null, casos_max: datos.casos_max ?? null, profesionales: datos.profesionales ?? null, nota: datos.nota || null };
  if (!dominioAutorizado(datos.dominios, host)) {
    return { estado: 'dominio_no_autorizado', permite_escritura: false, licencia: publico,
      mensaje: `La licencia no autoriza el dominio «${normalizarHost(host)}» (autorizados: ${datos.dominios.join(', ')}).` };
  }
  if (!datos.vence) return { estado: 'valida', permite_escritura: true, licencia: publico, mensaje: `Licencia perpetua de ${datos.cliente}.` };
  const fin = new Date(`${datos.vence}T23:59:59`).getTime();
  const dias = Math.ceil((fin - ahora.getTime()) / DIA);
  if (dias >= 0) {
    return { estado: dias <= DIAS_AVISO ? 'por_vencer' : 'valida', permite_escritura: true, licencia: publico, dias_restantes: dias,
      mensaje: dias <= DIAS_AVISO ? `La licencia vence en ${dias} día(s) (${datos.vence}). Solicite la renovación.` : `Licencia vigente hasta ${datos.vence}.` };
  }
  if (-dias <= DIAS_GRACIA) {
    return { estado: 'gracia', permite_escritura: true, licencia: publico, dias_restantes: dias,
      mensaje: `La licencia venció el ${datos.vence}. Quedan ${DIAS_GRACIA + dias} día(s) de gracia antes de pasar a solo lectura.` };
  }
  return { estado: 'vencida', permite_escritura: false, licencia: publico, dias_restantes: dias,
    mensaje: `La licencia venció el ${datos.vence}. La aplicación está en solo lectura hasta instalar una licencia vigente.` };
}

/**
 * Gestor de la licencia de esta instalación.
 * La licencia se toma de TDAH_LICENCIA (si existe) o de la que se instaló desde la app (tabla config).
 */
export function crearGestorLicencias({ db, clavePublica = CLAVE_PUBLICA_LICENCIAS, requerida, licenciaEntorno = process.env.TDAH_LICENCIA }) {
  db.exec('CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)');
  const guardada = () => db.prepare("SELECT valor FROM config WHERE clave = 'licencia'").get()?.valor || '';
  const texto = () => (licenciaEntorno && licenciaEntorno.trim()) || guardada();

  return {
    requerida,
    estado(host) {
      const e = evaluarLicencia(texto(), { clavePublica, host });
      const origen = licenciaEntorno && licenciaEntorno.trim() ? 'entorno' : guardada() ? 'instalada' : null;
      // Fuera de producción (desarrollo y pruebas) la licencia no se exige.
      if (!requerida) return { ...e, origen, requerida: false, permite_escritura: true };
      return { ...e, origen, requerida: true };
    },
    permiteEscritura(host) { return this.estado(host).permite_escritura; },
    /** Instala una licencia desde la app. Verifica la firma antes de guardarla. */
    instalar(nueva, host) {
      if (licenciaEntorno && licenciaEntorno.trim()) {
        throw Object.assign(new Error('La licencia está definida en la variable de entorno TDAH_LICENCIA; cámbiela en el panel del hosting.'), { status: 409 });
      }
      const e = evaluarLicencia(nueva, { clavePublica, host });
      if (['invalida', 'ausente'].includes(e.estado)) throw Object.assign(new Error(e.mensaje), { status: 400 });
      if (e.estado === 'dominio_no_autorizado') throw Object.assign(new Error(e.mensaje), { status: 400 });
      if (e.estado === 'vencida') throw Object.assign(new Error(e.mensaje), { status: 400 });
      db.prepare("INSERT INTO config (clave, valor) VALUES ('licencia', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor")
        .run(String(nueva).replace(/\s+/g, ''));
      return this.estado(host);
    },
    /** Límite de casos de la licencia (null = sin límite). */
    casosMax(host) { return requerida ? this.estado(host).licencia?.casos_max ?? null : null; },
  };
}

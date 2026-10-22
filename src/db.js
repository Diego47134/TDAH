// Base de datos persistente integrada (SQLite embebido en Node, sin servidor externo).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ErrorCifrado, PREFIJO } from './cifrado.js';

const ESQUEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT);

-- Expediente único por persona evaluada
CREATE TABLE IF NOT EXISTS casos (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  etiqueta TEXT NOT NULL,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  protocolo_version TEXT NOT NULL,
  ruta TEXT,                       -- con_informe | completa | NULL (aún no determinada)
  ruta_forzada TEXT,               -- cambio manual de ruta (p.ej. informe finalmente no obtenible)
  ruta_motivo TEXT,
  estado_global TEXT NOT NULL,     -- fase_inicial | entrevista | esperando_informe_escolar | entrevista_completa | informe_final | validado
  turno INTEGER NOT NULL DEFAULT 0,
  pregunta_actual TEXT,            -- JSON de la pregunta presentada y su justificación
  interpretacion TEXT,
  interpretacion_profesional TEXT,
  interpretacion_fecha TEXT
);

-- Preguntas formuladas (con identificador del banco y justificación del motor)
CREATE TABLE IF NOT EXISTS preguntas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  turno INTEGER NOT NULL,
  pregunta_id TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  especificidad INTEGER NOT NULL,
  texto TEXT NOT NULL,
  justificacion TEXT NOT NULL,
  presentada TEXT NOT NULL,
  respondida TEXT,
  estado TEXT NOT NULL DEFAULT 'presentada'   -- presentada | respondida | retirada
);

-- Respuestas originales del apoderado (texto literal) y su interpretación
CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  turno INTEGER NOT NULL,
  pregunta_id TEXT NOT NULL,
  texto_original TEXT NOT NULL,
  tipo_declarado TEXT,
  clasificacion TEXT NOT NULL,
  valor TEXT,
  interprete TEXT NOT NULL,        -- reglas
  detalle TEXT,
  creado TEXT NOT NULL
);

-- Hechos del expediente: cada dato con su fuente
CREATE TABLE IF NOT EXISTS hechos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  dimension_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  estado TEXT NOT NULL,            -- valor | no_sabe | no_recuerda | ambiguo | no_informado
  valor TEXT,
  fuente TEXT NOT NULL,            -- apoderado | informe_escolar | profesor | nino | adolescente | instrumento | profesional
  origen TEXT NOT NULL,            -- respuesta | mencion_espontanea | extraccion | registro_manual
  evidencia TEXT,
  respuesta_id INTEGER,
  pregunta_id TEXT,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_hechos ON hechos(caso_id, dimension_id, slot);

CREATE TABLE IF NOT EXISTS contradicciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  dimension_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  hecho_a INTEGER NOT NULL,
  hecho_b INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierta',   -- abierta | revisada
  nota_revision TEXT,
  revisado_por TEXT,
  revisado TEXT,
  creado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS informes_escolares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  texto TEXT NOT NULL,
  extraccion TEXT NOT NULL,
  metodo TEXT NOT NULL,
  creado TEXT NOT NULL
);

-- Instrumentos del protocolo (escalas, Nesplora, realidad virtual)
CREATE TABLE IF NOT EXISTS evaluaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  instrumento_id TEXT NOT NULL,
  estado TEXT NOT NULL,            -- pendiente | realizada | no_aplica
  fecha TEXT,
  aplicador TEXT,
  resultados TEXT,
  observaciones TEXT,
  actualizado TEXT NOT NULL,
  UNIQUE(caso_id, instrumento_id)
);

-- Historial de decisiones del motor (auditoría)
CREATE TABLE IF NOT EXISTS decisiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL,
  turno INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  detalle TEXT NOT NULL,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_decisiones ON decisiones(caso_id, id);

CREATE TABLE IF NOT EXISTS errores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT,
  origen TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  detalle TEXT,
  creado TEXT NOT NULL
);

-- Consentimiento informado del representante legal y asentimiento del niño/niña/adolescente
-- (Ley 19.628 / 21.719: datos sensibles de salud; Ley 20.584 y 21.331: consentimiento libre e informado)
CREATE TABLE IF NOT EXISTS consentimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  tipo TEXT NOT NULL,              -- tratamiento_datos | asentimiento_nna
  otorgante TEXT NOT NULL,         -- nombre o referencia al documento firmado
  relacion TEXT,                   -- madre | padre | tutor_legal | otro_representante | nna
  medio TEXT NOT NULL,             -- escrito_firmado | electronico | verbal_registrado
  profesional TEXT NOT NULL,
  acepta_ia_externa INTEGER NOT NULL DEFAULT 0,
  version_politica TEXT NOT NULL,
  revocado TEXT,
  creado TEXT NOT NULL
);

-- Búsquedas bibliográficas en internet (solo términos de búsqueda; nunca datos del paciente)
CREATE TABLE IF NOT EXISTS busquedas_bibliograficas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consulta TEXT NOT NULL,
  fuente TEXT NOT NULL,
  total INTEGER,
  resultados TEXT NOT NULL,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_busquedas ON busquedas_bibliograficas(fuente, consulta, creado);

-- Preguntas del profesional o del apoderado y cómo se respondieron (app, internet o sin respuesta)
CREATE TABLE IF NOT EXISTS consultas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT,
  quien TEXT NOT NULL,             -- profesional | apoderado
  pregunta TEXT NOT NULL,
  pregunta_id TEXT,                -- pregunta de la entrevista en pantalla, si aplica
  origen TEXT NOT NULL,            -- app | internet | sin_respuesta
  respuesta TEXT NOT NULL,
  atendida TEXT,                   -- fecha en que el profesional la revisó
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_consultas ON consultas(caso_id, id);

-- Referencias que el profesional asocia a un caso (aparecen en el informe)
CREATE TABLE IF NOT EXISTS referencias_caso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  referencia TEXT NOT NULL,
  nota TEXT,
  profesional TEXT NOT NULL,
  creado TEXT NOT NULL,
  UNIQUE(caso_id, referencia)
);

-- Documentos adjuntos al caso (archivo original en disco, texto extraído y resultado de la extracción)
CREATE TABLE IF NOT EXISTS documentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  clase TEXT NOT NULL,             -- entrevista_apoderado | informe_escolar | informe_rv | consentimiento | otro
  nombre TEXT NOT NULL,
  tipo_mime TEXT,
  bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  archivo TEXT NOT NULL,           -- ruta relativa dentro de la carpeta de documentos
  texto TEXT,                      -- texto extraído (seudonimizado)
  metodo TEXT,                     -- ia | reglas | sin_extraccion
  extraccion TEXT,                 -- JSON verificado
  estado TEXT NOT NULL,            -- procesado | guardado | error
  detalle TEXT,
  profesional TEXT,
  creado TEXT NOT NULL
);

-- Sesiones de realidad virtual recibidas en tiempo real desde el casco (aplicación del proyecto)
CREATE TABLE IF NOT EXISTS rv_sesiones (
  id TEXT PRIMARY KEY,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  estado TEXT NOT NULL,            -- en_curso | finalizada | cancelada
  dispositivo TEXT,
  tarea TEXT,
  metricas TEXT NOT NULL,          -- JSON: última medición de cada variable
  eventos INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS informes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  tipo TEXT NOT NULL,              -- final
  estado TEXT NOT NULL,            -- pendiente_validacion | validado
  contenido_md TEXT NOT NULL,
  requisitos TEXT NOT NULL,
  generado TEXT NOT NULL,
  validado_por TEXT,
  validado TEXT
);
`;

/**
 * Campos con datos clínicos o personales que se guardan cifrados (AES-256-GCM, ver cifrado.js).
 * Ninguna consulta SQL filtra ni ordena por estos campos: se comparan en JavaScript ya descifrados.
 */
export const SENSIBLES = {
  casos: ['etiqueta', 'interpretacion', 'interpretacion_profesional'],
  respuestas: ['texto_original', 'valor', 'detalle'],
  hechos: ['valor', 'evidencia'],
  contradicciones: ['descripcion', 'nota_revision'],
  informes_escolares: ['texto', 'extraccion'],
  evaluaciones: ['resultados', 'observaciones'],
  consentimientos: ['otorgante'],
  consultas: ['pregunta', 'respuesta'],
  documentos: ['nombre', 'texto', 'extraccion', 'detalle'],
  rv_sesiones: ['metricas'],
  informes: ['contenido_md', 'redaccion'],
  decisiones: ['detalle'],
  errores: ['detalle'],
  referencias_caso: ['nota'],
};
const SENSIBLES_SET = Object.fromEntries(Object.entries(SENSIBLES).map(([t, c]) => [t, new Set(c)]));

/** Divide una lista SQL por comas de nivel superior (fuera de paréntesis y comillas). */
function dividir(lista) {
  const out = []; let nivel = 0; let comilla = null; let actual = '';
  for (const ch of lista) {
    if (comilla) { if (ch === comilla) comilla = null; actual += ch; continue; }
    if (ch === "'" || ch === '"') comilla = ch;
    else if (ch === '(') nivel++;
    else if (ch === ')') nivel--;
    else if (ch === ',' && nivel === 0) { out.push(actual.trim()); actual = ''; continue; }
    actual += ch;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}
const contarParametros = (s) => (String(s).replace(/'[^']*'/g, '').match(/\?/g) || []).length;

/**
 * Para INSERT/UPDATE: tabla y, por cada «?» en orden, la columna que recibe ese valor (o null).
 * Devuelve null para otras sentencias.
 */
export function mapaParametros(sql) {
  const s = sql.replace(/\s+/g, ' ').trim();
  let m = s.match(/^INSERT (?:OR \w+ )?INTO (\w+) ?\(([^)]*)\) VALUES ?\((.*?)\)(.*)$/i);
  if (m) {
    const cols = dividir(m[2]); const vals = dividir(m[3]); const cols2 = [];
    if (cols.length !== vals.length) return { tabla: m[1], columnas: null };
    vals.forEach((v, i) => { const n = contarParametros(v); for (let k = 0; k < n; k++) cols2.push(v === '?' ? cols[i] : null); });
    for (let k = 0; k < contarParametros(m[4]); k++) cols2.push(null);
    return { tabla: m[1], columnas: cols2 };
  }
  m = s.match(/^UPDATE (\w+) SET (.*?)( WHERE .*)?$/i);
  if (m) {
    const cols2 = [];
    for (const a of dividir(m[2])) {
      const i = a.indexOf('='); const col = a.slice(0, i).trim(); const expr = a.slice(i + 1).trim();
      const n = contarParametros(expr);
      for (let k = 0; k < n; k++) cols2.push(expr === '?' ? col : null);
    }
    for (let k = 0; k < contarParametros(m[3] || ''); k++) cols2.push(null);
    return { tabla: m[1], columnas: cols2 };
  }
  return null;
}

/** Envuelve la base: cifra al escribir columnas sensibles y descifra al leer cualquier valor cifrado. */
function envolver(db, cif) {
  const prepararOriginal = db.prepare.bind(db);
  const descifrarFila = (f) => {
    if (!f || typeof f !== 'object') return f;
    for (const k of Object.keys(f)) if (typeof f[k] === 'string' && f[k].startsWith(PREFIJO)) f[k] = cif.descifrarTexto(f[k]);
    return f;
  };
  db.prepare = (sql) => {
    const st = prepararOriginal(sql);
    const mapa = mapaParametros(sql);
    const sensibles = mapa && SENSIBLES_SET[mapa.tabla];
    if (sensibles && !mapa.columnas) throw new ErrorCifrado(`No se pudo determinar qué columnas cifrar en: ${sql.slice(0, 80)}`);
    const cifrarArgs = sensibles
      ? (args) => args.map((v, i) => (v != null && sensibles.has(mapa.columnas[i]) ? cif.cifrarTexto(v) : v))
      : (args) => args;
    return new Proxy(st, {
      get(obj, prop) {
        if (prop === 'run') return (...a) => obj.run(...cifrarArgs(a));
        if (prop === 'get') return (...a) => descifrarFila(obj.get(...cifrarArgs(a)));
        if (prop === 'all') return (...a) => obj.all(...cifrarArgs(a)).map(descifrarFila);
        if (prop === 'iterate') return function* (...a) { for (const f of obj.iterate(...cifrarArgs(a))) yield descifrarFila(f); };
        const v = Reflect.get(obj, prop);
        return typeof v === 'function' ? v.bind(obj) : v;
      },
    });
  };
  db.cifrador = cif;
  return db;
}

/** Cifra los datos que quedaron en texto plano (bases creadas antes del cifrado). Devuelve cuántos valores cifró. */
function cifrarExistentes(db, cif) {
  let n = 0;
  transaccion(db, () => {
    for (const [tabla, cols] of Object.entries(SENSIBLES)) {
      for (const col of cols) {
        const filas = db.prepare(`SELECT rowid AS r, ${col} AS v FROM ${tabla} WHERE ${col} IS NOT NULL AND substr(${col}, 1, ${PREFIJO.length}) <> '${PREFIJO}'`).all();
        const up = db.prepare(`UPDATE ${tabla} SET ${col} = ? WHERE rowid = ?`);
        for (const f of filas) { up.run(cif.cifrarTexto(f.v), f.r); n++; }
      }
    }
  });
  return n;
}

/**
 * Abre (o crea) la base de datos.
 * @param cifrador  resultado de crearCifrador(); si se entrega, los campos sensibles quedan cifrados.
 */
export function abrirDB(ruta = process.env.DB_PATH || 'data/tdah.sqlite', { cifrador = null } = {}) {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(ESQUEMA);
  migrar(db);
  db.prepare("INSERT OR IGNORE INTO meta(clave, valor) VALUES ('esquema_version', '1')").run();
  const huella = db.prepare("SELECT valor FROM meta WHERE clave = 'cifrado_huella'").get()?.valor;
  if (!cifrador) {
    if (huella) { db.close(); throw new ErrorCifrado(`La base de datos está cifrada (huella ${huella}) y no se entregó la clave de cifrado.`); }
    return db;
  }
  if (huella && huella !== cifrador.huella) {
    db.close();
    throw new ErrorCifrado(`La clave de cifrado configurada (huella ${cifrador.huella}) no es la que cifró esta base de datos (huella ${huella}). `
      + 'Revise TDAH_CLAVE_CIFRADO o el archivo de clave: con otra clave los datos no se pueden leer.');
  }
  // Borrado seguro: las páginas liberadas se sobrescriben con ceros (no quedan restos en texto plano).
  db.exec('PRAGMA secure_delete = ON');
  if (!huella) {
    const n = cifrarExistentes(db, cifrador);
    db.prepare("INSERT INTO meta(clave, valor) VALUES ('cifrado_huella', ?)").run(cifrador.huella);
    db.prepare("INSERT OR REPLACE INTO meta(clave, valor) VALUES ('cifrado_desde', ?)").run(ahora());
    if (n > 0 && ruta !== ':memory:') { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.exec('VACUUM'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }
  }
  return envolver(db, cifrador);
}

/** Migraciones aditivas para bases existentes (nunca borran datos). */
function migrar(db) {
  const columnas = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
  if (!columnas('consentimientos').includes('acepta_ia_externa')) db.exec('ALTER TABLE consentimientos ADD COLUMN acepta_ia_externa INTEGER NOT NULL DEFAULT 0');
  if (!columnas('informes').includes('redaccion')) db.exec('ALTER TABLE informes ADD COLUMN redaccion TEXT');
}

/** Ejecuta fn dentro de una transacción; revierte ante cualquier error. */
export function transaccion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const ahora = () => new Date().toISOString();

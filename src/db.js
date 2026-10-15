// Base de datos persistente integrada (SQLite embebido en Node, sin servidor externo).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

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
  interprete TEXT NOT NULL,        -- reglas | ia
  detalle TEXT,
  creado TEXT NOT NULL
);

-- Hechos del expediente: cada dato con su fuente
CREATE TABLE IF NOT EXISTS hechos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caso_id TEXT NOT NULL REFERENCES casos(id),
  dimension_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  estado TEXT NOT NULL,            -- valor | no_sabe | no_recuerda | ambiguo
  valor TEXT,
  fuente TEXT NOT NULL,            -- apoderado | informe_escolar | instrumento | observacion | profesional | otra
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

export function abrirDB(ruta = process.env.DB_PATH || 'data/tdah.sqlite') {
  if (ruta !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(ESQUEMA);
  db.prepare("INSERT OR IGNORE INTO meta(clave, valor) VALUES ('esquema_version', '1')").run();
  return db;
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

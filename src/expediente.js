// Repositorio del expediente: lectura/escritura de hechos, preguntas, contradicciones y auditoría.
import crypto from 'node:crypto';
import { ahora } from './db.js';

const json = (v) => (v == null ? null : JSON.stringify(v));
const parse = (v) => (v == null ? null : JSON.parse(v));

export function crearCaso(db, protocolo, { etiqueta }) {
  const id = crypto.randomUUID();
  const n = db.prepare('SELECT COUNT(*) AS n FROM casos').get().n + 1;
  const codigo = `CASO-${String(n).padStart(4, '0')}`;
  const t = ahora();
  db.prepare(`INSERT INTO casos (id, codigo, etiqueta, creado, actualizado, protocolo_version, estado_global)
              VALUES (?, ?, ?, ?, ?, ?, 'fase_inicial')`)
    .run(id, codigo, etiqueta || codigo, t, t, protocolo.version);
  return obtenerCaso(db, id);
}

export function obtenerCaso(db, id) {
  const c = db.prepare('SELECT * FROM casos WHERE id = ?').get(id);
  if (!c) return null;
  return { ...c, pregunta_actual: parse(c.pregunta_actual) };
}

export function listarCasos(db) {
  return db.prepare('SELECT id, codigo, etiqueta, creado, actualizado, ruta, estado_global, turno FROM casos ORDER BY actualizado DESC').all();
}

export function actualizarCaso(db, id, campos) {
  const claves = Object.keys(campos);
  const valores = claves.map((k) => (k === 'pregunta_actual' ? json(campos[k]) : campos[k]));
  db.prepare(`UPDATE casos SET ${claves.map((k) => `${k} = ?`).join(', ')}, actualizado = ? WHERE id = ?`)
    .run(...valores, ahora(), id);
}

export function hechos(db, casoId) {
  return db.prepare('SELECT * FROM hechos WHERE caso_id = ? ORDER BY id').all(casoId);
}

export function preguntasFormuladas(db, casoId) {
  return db.prepare("SELECT * FROM preguntas WHERE caso_id = ? AND estado <> 'retirada' ORDER BY id").all(casoId);
}

export function retirarPregunta(db, casoId, turno) {
  db.prepare("UPDATE preguntas SET estado = 'retirada' WHERE caso_id = ? AND turno = ? AND estado = 'presentada'").run(casoId, turno);
}

export function contradicciones(db, casoId) {
  return db.prepare('SELECT * FROM contradicciones WHERE caso_id = ? ORDER BY id').all(casoId);
}

export function informesEscolares(db, casoId) {
  return db.prepare('SELECT * FROM informes_escolares WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((r) => {
      const ex = parse(r.extraccion);
      return Array.isArray(ex) ? { ...r, extraccion: ex, documento: null, datos: [], puntajes: [] }
        : { ...r, extraccion: ex?.hechos || [], documento: ex?.documento || null, datos: ex?.datos || [], puntajes: ex?.puntajes || [] };
    });
}

export function evaluaciones(db, casoId) {
  return db.prepare('SELECT * FROM evaluaciones WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((r) => ({ ...r, resultados: parse(r.resultados) }));
}

export function respuestas(db, casoId) {
  return db.prepare('SELECT * FROM respuestas WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((r) => ({ ...r, detalle: parse(r.detalle) }));
}

/**
 * Agrega un hecho. Si contradice un hecho previo DE LA MISMA FUENTE con valor distinto en la misma
 * dimensión/slot (datos categóricos), registra la contradicción SIN resolverla. Las diferencias entre
 * fuentes (p. ej. frecuencia en casa y en el colegio) no son contradicciones de un informante: se
 * conservan por fuente y las discrepancias de presencia se registran aparte (Etapa 9 §11).
 */
export function agregarHecho(db, protocolo, casoId, h) {
  const t = ahora();
  const r = db.prepare(`INSERT INTO hechos (caso_id, dimension_id, slot, estado, valor, fuente, origen, evidencia, respuesta_id, pregunta_id, creado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(casoId, h.dimension_id, h.slot, h.estado, h.valor ?? null, h.fuente, h.origen, h.evidencia ?? null,
      h.respuesta_id ?? null, h.pregunta_id ?? null, t);
  const nuevoId = Number(r.lastInsertRowid);
  let contradiccion = null;
  // Solo datos categóricos (presencia, alternativas, edad) pueden contradecirse; el texto libre se acumula.
  if (h.estado === 'valor' && h.categorico) {
    // El valor está cifrado en la base: se compara en JavaScript, ya descifrado.
    const previo = db.prepare(`SELECT * FROM hechos WHERE caso_id = ? AND dimension_id = ? AND slot = ? AND estado = 'valor'
                               AND id <> ? ORDER BY id DESC`)
      .all(casoId, h.dimension_id, h.slot, nuevoId).find((x) => x.fuente === h.fuente && x.valor != null && String(x.valor) !== String(h.valor));
    if (previo) {
      const desc = `«${h.slot}» registrado como «${previo.valor}» (fuente: ${previo.fuente}) y luego como «${h.valor}» (fuente: ${h.fuente}).`;
      const rc = db.prepare(`INSERT INTO contradicciones (caso_id, dimension_id, slot, hecho_a, hecho_b, descripcion, creado)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(casoId, h.dimension_id, h.slot, previo.id, nuevoId, desc, t);
      contradiccion = { id: Number(rc.lastInsertRowid), dimension_id: h.dimension_id, slot: h.slot, descripcion: desc };
    }
  }
  return { id: nuevoId, contradiccion };
}

export function registrarPregunta(db, casoId, turno, q, justificacion) {
  db.prepare(`INSERT INTO preguntas (caso_id, turno, pregunta_id, dimension_id, slot, especificidad, texto, justificacion, presentada)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(casoId, turno, q.id, q.objetivo[0], q.objetivo[1], 0, q.texto, justificacion, ahora());
}

/**
 * Registra una discrepancia sobre un mismo síntoma (Etapa 9 §11), si no existe ya una para el mismo
 * par de fuentes: una tercera fuente que discrepa genera su propio registro.
 */
export function registrarDiscrepancia(db, casoId, dim, slot, hechoA, hechoB, descripcion) {
  const fuenteDe = (id) => db.prepare('SELECT fuente FROM hechos WHERE id = ?').get(id)?.fuente;
  const par = [fuenteDe(hechoA), fuenteDe(hechoB)].sort().join('|');
  const previas = db.prepare('SELECT hecho_a, hecho_b FROM contradicciones WHERE caso_id = ? AND dimension_id = ? AND slot = ?').all(casoId, dim, slot);
  if (previas.some((c) => [fuenteDe(c.hecho_a), fuenteDe(c.hecho_b)].sort().join('|') === par)) return null;
  const r = db.prepare(`INSERT INTO contradicciones (caso_id, dimension_id, slot, hecho_a, hecho_b, descripcion, creado) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(casoId, dim, slot, hechoA, hechoB, descripcion, ahora());
  return { id: Number(r.lastInsertRowid), dimension_id: dim, slot, descripcion };
}

export function marcarRespondida(db, casoId, turno) {
  db.prepare("UPDATE preguntas SET respondida = ?, estado = 'respondida' WHERE caso_id = ? AND turno = ?").run(ahora(), casoId, turno);
}

export function registrarRespuesta(db, casoId, turno, d) {
  const r = db.prepare(`INSERT INTO respuestas (caso_id, turno, pregunta_id, texto_original, tipo_declarado, clasificacion, valor, interprete, detalle, creado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(casoId, turno, d.pregunta_id, d.texto_original, d.tipo_declarado ?? null, d.clasificacion, d.valor ?? null,
      d.interprete, json(d.detalle), ahora());
  return Number(r.lastInsertRowid);
}

export function registrarDecision(db, casoId, turno, tipo, detalle) {
  db.prepare('INSERT INTO decisiones (caso_id, turno, tipo, detalle, creado) VALUES (?, ?, ?, ?, ?)')
    .run(casoId, turno, tipo, JSON.stringify(detalle), ahora());
}

export function decisiones(db, casoId) {
  return db.prepare('SELECT * FROM decisiones WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((d) => ({ ...d, detalle: parse(d.detalle) }));
}

export function registrarError(db, casoId, origen, mensaje, detalle) {
  db.prepare('INSERT INTO errores (caso_id, origen, mensaje, detalle, creado) VALUES (?, ?, ?, ?, ?)')
    .run(casoId ?? null, origen, mensaje, json(detalle), ahora());
}

export function errores(db, casoId) {
  return db.prepare('SELECT * FROM errores WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((e) => ({ ...e, detalle: parse(e.detalle) }));
}

/** Contexto completo que consumen el motor, el validador y el generador de informes. */
export function contexto(db, protocolo, casoId) {
  const caso = obtenerCaso(db, casoId);
  if (!caso) return null;
  return {
    protocolo,
    caso,
    hechos: hechos(db, casoId),
    preguntas: preguntasFormuladas(db, casoId),
    contradicciones: contradicciones(db, casoId),
    informesEscolares: informesEscolares(db, casoId),
    evaluaciones: evaluaciones(db, casoId),
    consentimientos: consentimientos(db, casoId),
    referencias: referenciasCaso(db, casoId),
    documentos: db.prepare('SELECT id, clase, nombre, tipo_mime, bytes, sha256, metodo, estado, detalle, profesional, creado, extraccion FROM documentos WHERE caso_id = ? ORDER BY id').all(casoId).map((d) => ({ ...d, extraccion: d.extraccion ? JSON.parse(d.extraccion) : null })),
    consultas: db.prepare('SELECT * FROM consultas WHERE caso_id = ? ORDER BY id').all(casoId).map((c) => ({ ...c, respuesta: JSON.parse(c.respuesta) })),
  };
}

export function referenciasCaso(db, casoId) {
  return db.prepare('SELECT * FROM referencias_caso WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((r) => ({ ...r, referencia: JSON.parse(r.referencia) }));
}

export function consentimientos(db, casoId) {
  return db.prepare('SELECT * FROM consentimientos WHERE caso_id = ? ORDER BY id').all(casoId)
    .map((c) => ({ ...c, acepta_ia_externa: Boolean(c.acepta_ia_externa) }));
}

export function registrarConsentimiento(db, casoId, c) {
  const r = db.prepare(`INSERT INTO consentimientos (caso_id, tipo, otorgante, relacion, medio, profesional, acepta_ia_externa, version_politica, creado)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(casoId, c.tipo, c.otorgante, c.relacion ?? null, c.medio, c.profesional, c.acepta_ia_externa ? 1 : 0, c.version_politica, ahora());
  return Number(r.lastInsertRowid);
}

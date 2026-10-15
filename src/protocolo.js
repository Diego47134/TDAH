// Carga y compila el protocolo vigente (protocol/protocolo.json, generado por
// scripts/construir_protocolo.py desde los documentos del proyecto).
// El protocolo es DATOS: el motor no contiene preguntas ni contenido clínico propio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROTOCOLO_POR_DEFECTO = path.join(__dirname, '..', 'protocol', 'protocolo.json');

export class ErrorProtocolo extends Error {}

export function cargarProtocolo(ruta = process.env.PROTOCOLO_PATH || PROTOCOLO_POR_DEFECTO) {
  return compilarProtocolo(JSON.parse(fs.readFileSync(ruta, 'utf8')));
}

export function normalizar(t) {
  return String(t ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"«»“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sinSignos = (t) => t.replace(/^¿/, '').replace(/\?$/, '');

/** Construye el índice de preguntas y valida la integridad referencial. */
export function compilarProtocolo(crudo) {
  const p = structuredClone(crudo);
  const errores = [];
  p.preguntas = new Map();
  const alt = (nombre) => {
    const a = p.alternativas[nombre];
    if (!a) errores.push(`Alternativas inexistentes: ${nombre}`);
    return a || [];
  };
  const registrar = (q, extra) => {
    const preg = { fuente: 'apoderado', ...q, ...extra };
    if (preg.tipo === 'presencia') preg.opciones = alt('presencia');
    else if (preg.tipo === 'opciones') preg.opciones = alt(preg.alternativas);
    else if (preg.tipo === 'multiple' && preg.alternativas) preg.opciones = alt(preg.alternativas);
    if (!preg.texto?.trim()) errores.push(`Pregunta ${preg.id} sin texto`);
    if (!preg.objetivo) errores.push(`Pregunta ${preg.id} sin objetivo`);
    if (p.preguntas.has(preg.id)) errores.push(`Pregunta duplicada ${preg.id}`);
    p.preguntas.set(preg.id, preg);
    return preg;
  };

  for (const q of p.inicio) registrar(q, { grupo: 'inicio' });

  p.sintomasPorId = new Map();
  for (const s of p.sintomas) {
    p.sintomasPorId.set(s.id, s);
    s.palabras_clave = s.palabras_clave.map(normalizar);
    s.profundizacion = [];
  }
  for (const q of p.banco) registrar(q, { grupo: q.sintoma ? 'sintoma' : 'banco', fase: q.sintoma ? (q.sintoma.startsWith('R1') ? 'F2' : 'F3') : undefined });
  // Preguntas de profundización por síntoma (máx. 3; Etapa 9 §14), referidas a la conducta del banco.
  for (const s of p.sintomas) {
    const inexistentes = (s.preguntas || []).filter((id) => !p.preguntas.has(id));
    if (!s.preguntas?.length || inexistentes.length) {
      errores.push(`Síntoma ${s.id}: preguntas inexistentes en el banco (${inexistentes.join(', ') || 'ninguna asignada'})`);
      continue;
    }
    const ref = sinSignos(p.preguntas.get(s.preguntas[0]).texto);
    const conducta = ref.charAt(0).toLowerCase() + ref.slice(1);
    s.conducta = conducta;
    for (const d of p.profundizacion_sintoma) {
      const q = registrar({
        id: `${s.id}-${d.dimension.toUpperCase()}`, tipo: d.tipo, alternativas: d.alternativas,
        texto: `Sobre «${conducta}»: ${d.base}`, objetivo: [s.id, d.dimension], origen: d.origen,
      }, { grupo: 'profundizacion', sintoma: s.id, dimension: d.dimension, fase: s.id.startsWith('R1') ? 'F2' : 'F3' });
      s.profundizacion.push(q.id);
    }
  }
  p.bloquesPorPregunta = new Map();
  for (const b of p.bloques) {
    for (const qid of b.preguntas) {
      if (!p.preguntas.has(qid)) errores.push(`Bloque ${b.id}: pregunta inexistente ${qid}`);
      else { p.bloquesPorPregunta.set(qid, b); p.preguntas.get(qid).fase = b.fase; p.preguntas.get(qid).bloque = b.id; }
    }
  }

  // Barrido diferencial (Etapa 9 §H) y sus ramas.
  registrar({ id: p.barrido.id, texto: p.barrido.texto, tipo: 'multiple', opciones: p.barrido.opciones, objetivo: ['BARRIDO', 'areas'], fase: 'F7', origen: p.barrido.origen }, { grupo: 'barrido' });
  for (const [area, qs] of Object.entries(p.barrido.ramas)) {
    qs.forEach((q, i) => registrar({ ...q, objetivo: [`BAR-${area}`, q.id], fase: 'F7' }, { grupo: 'rama_barrido', area, orden: i }));
  }
  // Tamizaje médico, sensorial y del sueño (Etapa 9 §H.1).
  registrar({ id: p.tamizaje.id, texto: p.tamizaje.texto, tipo: 'multiple', opciones: p.tamizaje.opciones, objetivo: ['TAMIZAJE', 'categorias'], fase: 'F6', origen: p.tamizaje.origen }, { grupo: 'tamizaje' });
  for (const [cat, c] of Object.entries(p.tamizaje.categorias)) {
    c.preguntas.forEach((q, i) => registrar({ ...q, objetivo: [`TAM-${cat}`, q.id], fase: 'F6' }, { grupo: 'rama_tamizaje', categoria: cat, orden: i }));
  }
  for (const q of p.ruta_a_escolar) registrar({ ...q, objetivo: ['RA', q.id], fase: 'F4' }, { grupo: 'ruta_a' });
  for (const q of p.colegio) registrar({ ...q, objetivo: ['COL', q.id] }, { grupo: 'colegio' });
  for (const q of [...p.nino, ...p.adolescente]) registrar({ ...q, objetivo: ['NNA', q.id] }, { grupo: 'nna' });

  // Equivalencias funcionales.
  p.grupoDe = new Map();
  for (const g of p.equivalencias) {
    for (const id of g.preguntas) {
      if (!id.includes(':') && !p.preguntas.has(id)) errores.push(`Equivalencia ${g.id}: pregunta inexistente ${id}`);
      p.grupoDe.set(id, g);
    }
  }
  // Integridad de alternativas de presencia/ausencia (Etapa 9 §G).
  const pres = p.alternativas.presencia.map((o) => o.valor).join(',');
  if (pres !== 'si,no,ocasionalmente,no_sabe') errores.push('Las alternativas de presencia deben ser exactamente SÍ / NO / OCASIONALMENTE / NO SABE-NO RECUERDA');

  p.areasPorId = new Map(p.areas.map((a) => [a.id, a]));
  p.instrumentosPorId = new Map(p.instrumentos.map((i) => [i.id, i]));
  p.ordenFases = p.fases.map((f) => f.id);
  if (errores.length) throw new ErrorProtocolo('Protocolo inválido:\n- ' + errores.join('\n- '));
  return p;
}

/** Vista pública del protocolo para la interfaz. */
export function resumenProtocolo(p) {
  return {
    id: p.id, version: p.version, estado: p.estado, aviso: p.aviso, fuentes: p.fuentes, parametros: p.parametros,
    fases: p.fases, alternativas: p.alternativas,
    sintomas: p.sintomas.map(({ id, dominio, nombre, preguntas }) => ({ id, dominio, nombre, preguntas })),
    instrumentos: p.instrumentos, areas: p.areas.map(({ id, nombre }) => ({ id, nombre })),
    barrido: { opciones: p.barrido.opciones }, tamizaje: { opciones: p.tamizaje.opciones, estados: p.tamizaje.estados, resultados: p.tamizaje.resultados },
    total_preguntas: p.preguntas.size,
  };
}

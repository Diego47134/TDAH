// Carga y valida el protocolo (codificación de Etapa 4, Etapa 7 y reglas de Etapa 9).
// El protocolo es DATOS: el código del motor no contiene preguntas ni reglas clínicas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROTOCOLO_POR_DEFECTO = path.join(__dirname, '..', 'protocol', 'protocolo.provisional.json');

export class ErrorProtocolo extends Error {}

export function cargarProtocolo(ruta = process.env.PROTOCOLO_PATH || PROTOCOLO_POR_DEFECTO) {
  const crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  return compilarProtocolo(crudo);
}

/** Expande plantillas, construye índices y valida la integridad referencial. */
export function compilarProtocolo(crudo) {
  const errores = [];
  const p = structuredClone(crudo);
  p.preguntasPorId = new Map();
  p.dimensionesPorId = new Map();

  for (const q of p.fase_inicial) {
    q.dimension_id = 'INI';
    q.fase = 'inicial';
    if (!p.slots[q.slot]) errores.push(`Pregunta ${q.id}: slot desconocido ${q.slot}`);
    registrar(q);
  }

  for (const d of p.dimensiones) {
    if (p.dimensionesPorId.has(d.id)) errores.push(`Dimensión duplicada ${d.id}`);
    p.dimensionesPorId.set(d.id, d);
    const perfil = p.perfiles[d.perfil];
    if (!perfil) { errores.push(`Dimensión ${d.id}: perfil desconocido ${d.perfil}`); continue; }
    if (!p.orden_dominios.includes(d.dominio)) errores.push(`Dimensión ${d.id}: dominio fuera de orden_dominios`);
    d.esenciales = perfil.esenciales_si_presente;
    d.preguntas = d.preguntas || [];
    // Expandir plantillas para los slots esenciales que no tengan pregunta explícita.
    const plantillas = p.plantillas[d.perfil] || {};
    for (const slot of d.esenciales) {
      if (!d.preguntas.some((q) => q.slot === slot)) {
        if (!plantillas[slot]) { errores.push(`Dimensión ${d.id}: sin pregunta ni plantilla para ${slot}`); continue; }
        d.preguntas.push({
          id: `${d.id}-${slot.toUpperCase()}`, slot, especificidad: 1,
          texto: plantillas[slot].replace('{tema}', d.tema), de_plantilla: true,
        });
      }
    }
    if (!d.preguntas.some((q) => q.slot === 'presencia')) errores.push(`Dimensión ${d.id}: sin pregunta de presencia`);
    d.palabras_clave = (d.palabras_clave || []).map(normalizar);
    for (const q of d.preguntas) {
      q.dimension_id = d.id;
      q.fase = 'dimensiones';
      if (!p.slots[q.slot]) errores.push(`Pregunta ${q.id}: slot desconocido ${q.slot}`);
      registrar(q);
    }
  }

  p.grupoDePregunta = new Map();
  for (const g of p.grupos_equivalencia || []) {
    for (const qid of g.preguntas) {
      if (!p.preguntasPorId.has(qid)) errores.push(`Grupo ${g.id}: pregunta inexistente ${qid}`);
      p.grupoDePregunta.set(qid, g);
    }
  }
  p.instrumentosPorId = new Map((p.instrumentos || []).map((i) => [i.id, i]));
  p.ordenDimension = (d) => p.orden_dominios.indexOf(d.dominio) * 1000 + p.dimensiones.indexOf(d);

  if (errores.length) throw new ErrorProtocolo('Protocolo inválido:\n- ' + errores.join('\n- '));
  return p;

  function registrar(q) {
    if (p.preguntasPorId.has(q.id)) errores.push(`Pregunta duplicada ${q.id}`);
    if (!q.texto || !q.texto.trim()) errores.push(`Pregunta ${q.id} sin texto`);
    p.preguntasPorId.set(q.id, q);
  }
}

export function normalizar(t) {
  return String(t ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Vista pública del protocolo (sin índices internos). */
export function resumenProtocolo(p) {
  return {
    id: p.id, version: p.version, estado: p.estado, aviso: p.aviso, fuentes: p.fuentes,
    limites: p.limites, slots: p.slots,
    fase_inicial: p.fase_inicial,
    dimensiones: p.dimensiones.map(({ id, dominio, nombre, perfil, ambito, obligatoria, esenciales, preguntas, categoria_tamizaje }) =>
      ({ id, dominio, nombre, perfil, ambito, obligatoria, esenciales, categoria_tamizaje, preguntas })),
    grupos_equivalencia: p.grupos_equivalencia, instrumentos: p.instrumentos,
    requisitos_informe_final: p.requisitos_informe_final,
  };
}

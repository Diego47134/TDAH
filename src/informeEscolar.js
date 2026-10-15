// Recepción y extracción estructurada del informe escolar.
// Cada hecho extraído conserva su fuente (informe_escolar) y la frase literal que lo respalda.
import { normalizar } from './protocolo.js';

const FRECUENCIA = /\b(siempre|frecuentemente|a menudo|diariamente|constantemente|todos los dias|varias veces al dia|casi siempre|ocasionalmente|a veces)\b/;

function frases(texto) {
  return String(texto).split(/(?<=[.!?;])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

/** Extracción por reglas (sin IA). Conservadora: solo lo afirmado explícitamente. */
export function extraerPorReglas(protocolo, texto) {
  const hechos = [];
  const vistos = new Set();
  for (const f of frases(texto)) {
    const n = ` ${normalizar(f)} `;
    for (const d of protocolo.dimensiones) {
      if (vistos.has(d.id)) continue;
      let presencia = null;
      for (const kw of d.palabras_clave || []) {
        const i = n.indexOf(` ${kw} `);
        if (i < 0) continue;
        const previo = n.slice(Math.max(0, i - 20), i).trim().split(' ').slice(-2);
        presencia = (previo.includes('no') || previo.includes('nunca')) ? 'no' : 'si';
        break;
      }
      if (!presencia) {
        for (const kw of (d.palabras_clave_ausencia || []).map(normalizar)) {
          if (n.includes(` ${kw} `)) { presencia = 'no'; break; }
        }
      }
      if (!presencia) continue;
      vistos.add(d.id);
      hechos.push({ dimension_id: d.id, slot: 'presencia', valor: presencia, evidencia: f });
      if (presencia === 'si' && d.esenciales.includes('contextos')) {
        hechos.push({ dimension_id: d.id, slot: 'contextos', valor: 'Colegio (según informe escolar)', evidencia: f });
      }
      if (presencia === 'si' && d.esenciales.includes('descripcion')) {
        hechos.push({ dimension_id: d.id, slot: 'descripcion', valor: f, evidencia: f });
      }
      const fr = normalizar(f).match(FRECUENCIA);
      if (presencia === 'si' && fr && d.esenciales.includes('frecuencia')) {
        hechos.push({ dimension_id: d.id, slot: 'frecuencia', valor: `${fr[0]} (según informe escolar)`, evidencia: f });
      }
    }
  }
  return hechos;
}

/** Valida una extracción estructurada aportada manualmente (JSON). */
export function validarExtraccionManual(protocolo, hechos) {
  if (!Array.isArray(hechos)) throw new Error('Se esperaba un arreglo «hechos».');
  return hechos.map((h, i) => {
    const d = protocolo.dimensionesPorId.get(h.dimension_id);
    if (!d) throw new Error(`hechos[${i}]: dimensión desconocida ${h.dimension_id}`);
    if (!['presencia', ...d.esenciales].includes(h.slot)) throw new Error(`hechos[${i}]: slot no válido ${h.slot}`);
    if (h.slot === 'presencia' && !['si', 'no'].includes(h.valor)) throw new Error(`hechos[${i}]: presencia debe ser si/no`);
    if (!h.evidencia || !String(h.evidencia).trim()) throw new Error(`hechos[${i}]: falta evidencia (frase del informe)`);
    return { dimension_id: h.dimension_id, slot: h.slot, valor: String(h.valor), evidencia: String(h.evidencia) };
  });
}

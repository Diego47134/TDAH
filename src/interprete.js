// Interpretación de respuestas. Distingue sí / no / no sé / no recuerdo / ambiguo / valor.
// «No sé» y «No recuerdo» NUNCA se convierten en negativas.
import { normalizar } from './protocolo.js';

const NUMEROS = { uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18 };

export const TIPOS_DECLARADOS = ['si', 'no', 'no_se', 'no_recuerdo'];

function incertidumbre(original) {
  const n = normalizar(original);
  if (/\bno (lo )?(recuerdo|me acuerdo)\b|\bno tengo (memoria|recuerdo)\b|\bya no me acuerdo\b|\bno lo tengo claro\b/.test(n)) return 'no_recuerdo';
  // «no sé» con tilde es inequívoco; sin tilde solo si va aislado (para no confundir «no se distrae»).
  if (/(^|[^a-záéíóúñ])no (lo )?sé([^a-záéíóúñ]|$)/i.test(original) || /\bno lo se\b/.test(n) || /^no se$/.test(n) || /^no se (bien|decir|si)\b/.test(n)
    || /\bni idea\b|\bdesconozco\b|\bno estoy segur[oa]\b|\bno sabria\b|\bno tengo idea\b/.test(n)) return 'no_se';
  return null;
}

const AMBIGUO = /\b(a veces|depende|mas o menos|no siempre|de vez en cuando|puede ser|quizas|tal vez|un poco|no mucho|no tanto|algunas veces|en ocasiones|a ratos)\b/;
const NEGATIVO = /^(no|nunca|jamas|para nada|en absoluto|ninguna?|nada)\b/;
const AFIRMATIVO = /^(si|claro|siempre|bastante|mucho|frecuentemente|a menudo|seguido|todo el tiempo|harto|obvio|efectivamente|correcto|totalmente|muchisimo|casi siempre)\b/;

/**
 * @param slotTipo 'si_no' | 'texto' | 'numero'
 * @param texto respuesta literal
 * @param tipoDeclarado opcional: si | no | no_se | no_recuerdo (botones de la interfaz)
 * @param invertida la pregunta está formulada a la inversa (un «sí» indica ausencia)
 */
export function interpretarReglas({ slotTipo, texto = '', tipoDeclarado, invertida = false }) {
  const original = String(texto).trim();
  const n = normalizar(original);
  let clasificacion; let valor = null;

  if (tipoDeclarado && TIPOS_DECLARADOS.includes(tipoDeclarado)) {
    clasificacion = tipoDeclarado;
  } else {
    const inc = incertidumbre(original);
    if (inc) clasificacion = inc;
    else if (!n) clasificacion = 'ambiguo';
    else if (slotTipo === 'texto') { clasificacion = 'valor'; valor = original; }
    else if (slotTipo === 'numero') {
      const m = n.match(/\d+([.,]\d+)?/);
      const palabra = n.split(' ').find((w) => NUMEROS[w] != null);
      if (m) { clasificacion = 'valor'; valor = String(Math.floor(Number(m[0].replace(',', '.')))); }
      else if (palabra) { clasificacion = 'valor'; valor = String(NUMEROS[palabra]); }
      else clasificacion = 'ambiguo';
    } else if (AMBIGUO.test(n)) clasificacion = 'ambiguo';
    else if (NEGATIVO.test(n)) clasificacion = 'no';
    else if (AFIRMATIVO.test(n) || /(^|[^a-záéíóúñ])sí([^a-záéíóúñ]|$)/i.test(original)) clasificacion = 'si';
    else clasificacion = 'ambiguo';
  }

  // Normalización a estado de hecho
  let estado; let valorHecho = valor;
  if (clasificacion === 'si' || clasificacion === 'no') {
    estado = 'valor';
    valorHecho = clasificacion;
    if (slotTipo === 'si_no' && invertida) valorHecho = clasificacion === 'si' ? 'no' : 'si';
    if (slotTipo === 'texto') valorHecho = original || clasificacion;
    if (slotTipo === 'numero') { estado = 'ambiguo'; valorHecho = null; }
  } else if (clasificacion === 'no_se') estado = 'no_sabe';
  else if (clasificacion === 'no_recuerdo') estado = 'no_recuerda';
  else if (clasificacion === 'valor') estado = 'valor';
  else estado = 'ambiguo';

  return { clasificacion, estado, valor: valorHecho, interprete: 'reglas' };
}

/** Detecta conductas mencionadas espontáneamente (palabras clave del protocolo, sin negación previa). */
export function detectarMenciones(protocolo, texto) {
  const n = ` ${normalizar(texto)} `;
  const res = [];
  for (const d of protocolo.dimensiones) {
    for (const kw of d.palabras_clave || []) {
      const i = n.indexOf(` ${kw} `);
      if (i < 0) continue;
      const previo = n.slice(Math.max(0, i - 20), i).trim().split(' ').slice(-2);
      if (previo.includes('no') || previo.includes('nunca') || previo.includes('ni')) continue;
      const frase = extraerFrase(texto, kw);
      res.push({ dimension_id: d.id, palabra_clave: kw, evidencia: frase });
      break;
    }
  }
  return res;
}

function extraerFrase(texto, kw) {
  const frases = String(texto).split(/(?<=[.!?;])\s+|\n+/);
  return (frases.find((f) => normalizar(f).includes(kw)) || texto).trim().slice(0, 300);
}

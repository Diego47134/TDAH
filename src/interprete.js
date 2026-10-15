// Interpretación de respuestas (Etapa 7 §16; Etapa 9 §6.2).
// Estados distinguidos: SÍ, NO, OCASIONALMENTE, NO SABE, NO RECUERDA, INFORMACIÓN PARCIAL.
// «No sé» y «No recuerdo» NUNCA se convierten en negativas.
import { normalizar } from './protocolo.js';

export class ErrorEntrada extends Error {}

const NUMEROS = { uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18 };
export const TIPOS_DECLARADOS = ['si', 'no', 'ocasionalmente', 'no_se', 'no_recuerdo'];

export function incertidumbre(original) {
  const n = normalizar(original);
  if (/\bno (lo )?(recuerdo|me acuerdo)\b|\bno tengo (memoria|recuerdo)\b|\bya no me acuerdo\b/.test(n)) return 'no_recuerdo';
  if (/(^|[^a-záéíóúñ])no (lo )?sé([^a-záéíóúñ]|$)/i.test(original) || /\bno lo se\b/.test(n) || /^no se$/.test(n) || /^no se (bien|decir|si)\b/.test(n)
    || /\bni idea\b|\bdesconozco\b|\bno estoy segur[oa]\b|\bno sabria\b|\bno tengo idea\b/.test(n)) return 'no_se';
  return null;
}

const OCASIONAL = /\b(a veces|ocasionalmente|de vez en cuando|algunas veces|en ocasiones|a ratos|no siempre|depende|mas o menos|un poco|no mucho|no tanto)\b/;
const NEGATIVO = /^(no|nunca|jamas|para nada|en absoluto|ninguna?|nada)\b/;
const AFIRMATIVO = /^(si|claro|siempre|bastante|mucho|frecuentemente|a menudo|seguido|todo el tiempo|harto|obvio|efectivamente|correcto|totalmente|muchisimo|casi siempre)\b/;

/** Interpreta texto libre para una pregunta de presencia/ausencia. */
export function interpretarPresencia(texto, tipoDeclarado) {
  const original = String(texto ?? '').trim();
  let c = tipoDeclarado;
  if (!c) {
    const n = normalizar(original);
    c = incertidumbre(original)
      || (OCASIONAL.test(n) ? 'ocasionalmente' : null)
      || (NEGATIVO.test(n) ? 'no' : null)
      || (AFIRMATIVO.test(n) || /(^|[^a-záéíóúñ])sí([^a-záéíóúñ]|$)/i.test(original) ? 'si' : null)
      || 'ambiguo';
  }
  if (c === 'no_se') return { clasificacion: c, estado: 'no_sabe', valor: null };
  if (c === 'no_recuerdo') return { clasificacion: c, estado: 'no_recuerda', valor: null };
  if (c === 'ambiguo') return { clasificacion: c, estado: 'ambiguo', valor: null };
  return { clasificacion: c, estado: 'valor', valor: c };
}

/** Intérprete de reglas por tipo de dato (compatibilidad). */
export function interpretarReglas({ slotTipo, texto = '', tipoDeclarado }) {
  if (slotTipo === 'si_no' || slotTipo === 'presencia') return { ...interpretarPresencia(texto, tipoDeclarado), interprete: 'reglas' };
  const original = String(texto).trim();
  const inc = tipoDeclarado === 'no_se' ? 'no_se' : tipoDeclarado === 'no_recuerdo' ? 'no_recuerdo' : incertidumbre(original);
  if (inc) return { clasificacion: inc, estado: inc === 'no_se' ? 'no_sabe' : 'no_recuerda', valor: null, interprete: 'reglas' };
  if (slotTipo === 'numero') {
    const n = normalizar(original);
    const m = n.match(/\d+([.,]\d+)?/);
    const w = n.split(' ').find((x) => NUMEROS[x] != null);
    if (m) return { clasificacion: 'valor', estado: 'valor', valor: String(Math.floor(Number(m[0].replace(',', '.')))), interprete: 'reglas' };
    if (w) return { clasificacion: 'valor', estado: 'valor', valor: String(NUMEROS[w]), interprete: 'reglas' };
    return { clasificacion: 'ambiguo', estado: 'ambiguo', valor: null, interprete: 'reglas' };
  }
  if (!original) return { clasificacion: 'ambiguo', estado: 'ambiguo', valor: null, interprete: 'reglas' };
  return { clasificacion: 'valor', estado: 'valor', valor: original, interprete: 'reglas' };
}

function opcionPorTexto(opciones, texto) {
  const n = normalizar(texto);
  if (!n) return null;
  const inc = incertidumbre(texto);
  if (inc) return opciones.find((o) => o.incierta) || null;
  const exacta = opciones.find((o) => normalizar(o.texto) === n || normalizar(o.codigo) === n);
  if (exacta) return exacta;
  const contiene = opciones.filter((o) => n.includes(normalizar(o.texto)));
  return contiene.length === 1 ? contiene[0] : null;
}

/**
 * Interpreta una respuesta según el tipo de pregunta.
 * @param q pregunta compilada
 * @param r {opcion?, opciones?, texto?, tipo?}
 * @returns {{estado, valor, clasificacion, texto}}
 */
export function interpretarRespuesta(q, r = {}) {
  const texto = String(r.texto ?? '').trim();
  if (r.tipo && !TIPOS_DECLARADOS.includes(r.tipo)) throw new ErrorEntrada(`Tipo de respuesta no válido: ${r.tipo}`);

  if (q.tipo === 'presencia') {
    if (r.opcion) {
      const o = q.opciones.find((x) => x.codigo === r.opcion);
      if (!o) throw new ErrorEntrada(`Alternativa no válida: ${r.opcion}`);
      return o.incierta ? { clasificacion: 'no_sabe', estado: 'no_sabe', valor: null, texto }
        : { clasificacion: o.valor, estado: 'valor', valor: o.valor, texto };
    }
    if (!texto && !r.tipo) throw new ErrorEntrada('Seleccione una alternativa o escriba la respuesta.');
    return { ...interpretarPresencia(texto, r.tipo), texto };
  }

  if (q.tipo === 'opciones') {
    let o = r.opcion ? q.opciones.find((x) => x.codigo === r.opcion) : null;
    if (r.opcion && !o) throw new ErrorEntrada(`Alternativa no válida: ${r.opcion}`);
    if (!o && (r.tipo === 'no_se' || r.tipo === 'no_recuerdo')) o = q.opciones.find((x) => x.incierta);
    if (!o && texto) o = opcionPorTexto(q.opciones, texto);
    if (!o) {
      if (!texto) throw new ErrorEntrada('Seleccione una alternativa.');
      return { clasificacion: 'ambiguo', estado: 'ambiguo', valor: null, texto };
    }
    return o.incierta ? { clasificacion: 'no_sabe', estado: 'no_sabe', valor: null, texto, codigo: o.codigo }
      : { clasificacion: 'valor', estado: 'valor', valor: o.valor, texto, codigo: o.codigo };
  }

  if (q.tipo === 'multiple') {
    let cods = Array.isArray(r.opciones) ? [...new Set(r.opciones.map(String))] : (r.opcion ? [String(r.opcion)] : []);
    if (!cods.length && (r.tipo === 'no_se' || r.tipo === 'no_recuerdo')) cods = [q.opciones.find((x) => x.incierta)?.codigo].filter(Boolean);
    if (!cods.length) throw new ErrorEntrada('Seleccione al menos una alternativa.');
    const sel = cods.map((c) => {
      const o = q.opciones.find((x) => x.codigo === c);
      if (!o) throw new ErrorEntrada(`Alternativa no válida: ${c}`);
      return o;
    });
    const exc = sel.filter((o) => o.excluyente);
    if (exc.length && sel.length > 1) throw new ErrorEntrada(`«${exc[0].texto}» es excluyente: no puede combinarse con otras alternativas.`);
    if (exc.length && exc[0].incierta && !exc[0].ninguna && q.alternativas) {
      return { clasificacion: 'no_sabe', estado: 'no_sabe', valor: null, texto };
    }
    return { clasificacion: 'valor', estado: 'valor', valor: sel.map((o) => o.valor).join(','), texto, codigos: sel.map((o) => o.codigo) };
  }

  if (q.tipo === 'numero') {
    const x = interpretarReglas({ slotTipo: 'numero', texto, tipoDeclarado: r.tipo });
    if (x.estado === 'ambiguo' && !texto) throw new ErrorEntrada('Ingrese un número.');
    return { ...x, texto };
  }
  // abierta
  if (!texto && !r.tipo) throw new ErrorEntrada('La respuesta está vacía.');
  return { ...interpretarReglas({ slotTipo: 'texto', texto, tipoDeclarado: r.tipo }), texto };
}

/** Conductas con posible correspondencia DSM-5-TR mencionadas en un texto (sin negación previa). */
export function detectarMenciones(protocolo, texto) {
  const n = ` ${normalizar(texto)} `;
  const res = [];
  for (const s of protocolo.sintomas) {
    for (const kw of s.palabras_clave) {
      const i = n.indexOf(` ${kw} `);
      if (i < 0) continue;
      const previo = n.slice(Math.max(0, i - 20), i).trim().split(' ').slice(-2);
      if (previo.includes('no') || previo.includes('nunca') || previo.includes('ni')) continue;
      const frases = String(texto).split(/(?<=[.!?;])\s+|\n+/);
      res.push({ sintoma: s.id, palabra_clave: kw, evidencia: (frases.find((f) => normalizar(f).includes(kw)) || texto).trim().slice(0, 300) });
      break;
    }
  }
  return res;
}

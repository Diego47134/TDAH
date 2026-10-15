// Integración con la API del modelo de IA (configurable: Anthropic u OpenAI).
// La IA SOLO interpreta respuestas libres y extrae datos del informe escolar; nunca selecciona
// preguntas (Etapa 9 §K; brief §2). Toda salida se valida; ante error se usa el intérprete de reglas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leerPrompt = (f) => fs.readFileSync(path.join(__dirname, '..', 'prompts', f), 'utf8');

export class ErrorIA extends Error {
  constructor(msg, detalle) { super(msg); this.detalle = detalle; }
}

const PROVEEDORES = {
  anthropic: { url: 'https://api.anthropic.com/v1/messages', modelo: 'claude-sonnet-5-5', clave: 'ANTHROPIC_API_KEY' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', modelo: 'gpt-4o', clave: 'OPENAI_API_KEY' },
};

export function crearClienteIA({
  proveedor = process.env.IA_PROVEEDOR || (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY ? 'openai' : 'anthropic'),
  apiKey, modelo, url, timeoutMs = Number(process.env.IA_TIMEOUT_MS || 20000), fetchImpl = globalThis.fetch,
} = {}) {
  const conf = PROVEEDORES[proveedor];
  if (!conf) throw new Error(`Proveedor de IA no soportado: ${proveedor}`);
  apiKey ??= process.env[conf.clave];
  modelo ??= process.env.IA_MODELO || (proveedor === 'anthropic' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL) || conf.modelo;
  url ??= process.env.IA_API_URL || conf.url;
  const systemMaestro = leerPrompt('system-maestro.md');

  async function llamar(instruccion, contenido) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const system = `${systemMaestro}\n\n${instruccion}`;
    const cuerpo = proveedor === 'anthropic'
      ? { model: modelo, max_tokens: 1500, temperature: 0, system, messages: [{ role: 'user', content: contenido }] }
      : { model: modelo, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: contenido }] };
    const headers = proveedor === 'anthropic'
      ? { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      : { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
    try {
      const res = await fetchImpl(url, { method: 'POST', signal: ctrl.signal, headers, body: JSON.stringify(cuerpo) });
      if (!res.ok) throw new ErrorIA(`API respondió ${res.status}`, { status: res.status, cuerpo: (await res.text()).slice(0, 500) });
      const data = await res.json();
      const texto = proveedor === 'anthropic'
        ? (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
        : data.choices?.[0]?.message?.content || '';
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) throw new ErrorIA('La respuesta de la IA no contiene JSON', { texto: texto.slice(0, 500) });
      try { return JSON.parse(m[0]); } catch { throw new ErrorIA('JSON inválido desde la IA', { texto: m[0].slice(0, 500) }); }
    } catch (e) {
      if (e.name === 'AbortError') throw new ErrorIA(`Tiempo de espera agotado (${timeoutMs} ms)`);
      if (e instanceof ErrorIA) throw e;
      throw new ErrorIA(`Fallo de red o API: ${e.message}`);
    } finally { clearTimeout(t); }
  }

  /** Asigna una respuesta libre a una de las alternativas autorizadas de la pregunta. */
  async function interpretarRespuesta({ pregunta, texto }) {
    const salida = await llamar(leerPrompt('prompt-ejecucion.md'), JSON.stringify({
      pregunta_autorizada: { id: pregunta.id, texto: pregunta.texto, tipo: pregunta.tipo },
      alternativas: (pregunta.opciones || []).map((o) => ({ codigo: o.codigo, texto: o.texto })),
      respuesta_literal: texto,
    }));
    const codigos = new Set((pregunta.opciones || []).map((o) => o.codigo));
    if (salida.codigo != null && !codigos.has(salida.codigo)) throw new ErrorIA('Alternativa fuera del esquema', { salida });
    return { codigo: salida.codigo ?? null };
  }

  /** Extrae hechos del informe escolar, cada uno con su frase literal. */
  async function extraerInformeEscolar({ texto, protocolo }) {
    const sintomas = protocolo.sintomas.map((s) => `${s.id}: ${s.nombre}`).join('\n');
    const salida = await llamar(leerPrompt('prompt-extraccion-informe.md'), JSON.stringify({ sintomas, informe: texto }));
    if (!Array.isArray(salida.hechos)) throw new ErrorIA('Extracción sin arreglo «hechos»', { salida });
    const out = [];
    for (const h of salida.hechos) {
      if (typeof h.evidencia !== 'string' || !h.evidencia.trim() || !texto.includes(h.evidencia.trim())) continue; // evidencia literal obligatoria
      if (h.sintoma && protocolo.sintomasPorId.has(h.sintoma) && ['si', 'no'].includes(h.presencia)) {
        out.push({ dimension_id: h.sintoma, slot: 'presencia:informe', valor: h.presencia, evidencia: h.evidencia.trim() });
      } else if (h.dato === 'impacto_academico') out.push({ dimension_id: 'INF', slot: 'impacto_academico', valor: 'si', evidencia: h.evidencia.trim() });
      else if (h.dato === 'desde') out.push({ dimension_id: 'INF', slot: 'desde', valor: h.evidencia.trim(), evidencia: h.evidencia.trim() });
    }
    return out;
  }

  return { habilitada: Boolean(apiKey), proveedor, modelo, interpretarRespuesta, extraerInformeEscolar };
}

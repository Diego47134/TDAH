// Integración con la API de IA (OpenAI o DeepSeek, formato compatible «chat completions»).
// Regla del proyecto: la IA SOLO interpreta respuestas libres, extrae datos de documentos con su
// frase literal y redacta textos a partir de resultados ya decididos por el motor de reglas.
// Nunca selecciona preguntas ni decide el diagnóstico. Toda salida se valida; ante cualquier
// error el sistema continúa con el intérprete de reglas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leerPrompt = (f) => fs.readFileSync(path.join(__dirname, '..', 'prompts', f), 'utf8');

export class ErrorIA extends Error {
  constructor(msg, detalle) { super(msg); this.detalle = detalle; }
}

export const PROVEEDORES = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', modelo: 'gpt-5-mini', clave: 'OPENAI_API_KEY', nombre: 'OpenAI', pais: 'Estados Unidos' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', modelo: 'deepseek-flash', clave: 'DEEPSEEK_API_KEY', nombre: 'DeepSeek', pais: 'China' },
};

export function proveedorConfigurado(env = process.env) {
  if (env.IA_PROVEEDOR && PROVEEDORES[env.IA_PROVEEDOR]) return env.IA_PROVEEDOR;
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.DEEPSEEK_API_KEY) return 'deepseek';
  return 'openai';
}

export function crearClienteIA({
  proveedor = proveedorConfigurado(), apiKey, modelo, url,
  timeoutMs = Number(process.env.IA_TIMEOUT_MS || 60000), fetchImpl = globalThis.fetch,
} = {}) {
  const conf = PROVEEDORES[proveedor];
  if (!conf) throw new Error(`Proveedor de IA no soportado: ${proveedor}`);
  apiKey ??= process.env[conf.clave];
  modelo ??= process.env.IA_MODELO || conf.modelo;
  url ??= process.env.IA_API_URL || conf.url;
  const sistema = leerPrompt('sistema.md');

  async function llamar(tarea, datos, { maxTokens = 4000, json = true } = {}) {
    if (!apiKey) throw new ErrorIA('IA no configurada');
    const cuerpo = {
      model: modelo,
      messages: [{ role: 'system', content: `${sistema}\n\n${leerPrompt(tarea)}` }, { role: 'user', content: JSON.stringify(datos) }],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      // Los modelos de razonamiento de OpenAI usan max_completion_tokens y no aceptan temperature.
      ...(proveedor === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens, temperature: 0 }),
    };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { method: 'POST', signal: ctrl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: JSON.stringify(cuerpo) });
      if (!res.ok) throw new ErrorIA(`La API de IA respondió ${res.status}`, { status: res.status, cuerpo: (await res.text()).slice(0, 500) });
      const data = await res.json();
      const texto = data.choices?.[0]?.message?.content || '';
      const uso = data.usage || null;
      if (!json) return { texto, uso };
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) throw new ErrorIA('La respuesta de la IA no contiene JSON', { texto: texto.slice(0, 500) });
      try { return { ...JSON.parse(m[0]), _uso: uso }; } catch { throw new ErrorIA('JSON inválido desde la IA', { texto: m[0].slice(0, 500) }); }
    } catch (e) {
      if (e.name === 'AbortError') throw new ErrorIA(`Tiempo de espera agotado (${timeoutMs} ms)`);
      if (e instanceof ErrorIA) throw e;
      throw new ErrorIA(`Fallo de red o de la API de IA: ${e.message}`);
    } finally { clearTimeout(t); }
  }

  return {
    habilitada: Boolean(apiKey), proveedor, modelo, nombre: conf.nombre, pais: conf.pais,

    /** Asigna una respuesta libre a una alternativa autorizada (o null si no es posible sin suponer). */
    async interpretarRespuesta({ pregunta, texto }) {
      const s = await llamar('interpretar-respuesta.md', {
        pregunta: pregunta.texto, alternativas: (pregunta.opciones || []).map((o) => ({ codigo: o.codigo, texto: o.texto })), respuesta_literal: texto,
      }, { maxTokens: 1500 });
      const codigos = new Set((pregunta.opciones || []).map((o) => o.codigo));
      if (s.codigo != null && !codigos.has(s.codigo)) throw new ErrorIA('Alternativa fuera del esquema', { salida: s });
      return { codigo: s.codigo ?? null };
    },

    /** Extrae hechos de un documento (entrevista manual, informe escolar, informe de RV). */
    async extraerDocumento({ tipo, texto, esquema }) {
      return llamar('extraer-documento.md', { tipo_documento: tipo, esquema, documento: texto }, { maxTokens: 12000 });
    },

    /** Redacta la respuesta a una pregunta usando SOLO los fragmentos entregados. */
    async redactarRespuesta({ pregunta, publico, fragmentos }) {
      return llamar('responder-pregunta.md', { pregunta, publico, fragmentos }, { maxTokens: 3000 });
    },

    /** Redacta las secciones legibles del informe a partir de los resultados del motor. */
    async redactarInforme({ resultados }) {
      return llamar('redactar-informe.md', { resultados }, { maxTokens: 12000 });
    },
  };
}

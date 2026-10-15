// Integración con la API del modelo de IA (Anthropic Messages API).
// La IA SOLO interpreta respuestas y extrae datos del informe escolar; nunca elige preguntas.
// Toda salida se valida contra un esquema; ante error o salida inválida se usa el intérprete de reglas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leerPrompt = (f) => fs.readFileSync(path.join(__dirname, '..', 'prompts', f), 'utf8');

export class ErrorIA extends Error {
  constructor(msg, detalle) { super(msg); this.detalle = detalle; }
}

export function crearClienteIA({
  apiKey = process.env.ANTHROPIC_API_KEY,
  modelo = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  url = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages',
  timeoutMs = Number(process.env.IA_TIMEOUT_MS || 20000),
  fetchImpl = globalThis.fetch,
} = {}) {
  const habilitada = Boolean(apiKey);
  const systemMaestro = leerPrompt('system-maestro.md');

  async function llamar(instruccion, contenido) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: modelo, max_tokens: 1500, temperature: 0,
          system: `${systemMaestro}\n\n${instruccion}`,
          messages: [{ role: 'user', content: contenido }],
        }),
      });
      if (!res.ok) throw new ErrorIA(`API respondió ${res.status}`, { status: res.status, cuerpo: (await res.text()).slice(0, 500) });
      const data = await res.json();
      const texto = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) throw new ErrorIA('La respuesta de la IA no contiene JSON', { texto: texto.slice(0, 500) });
      try { return JSON.parse(m[0]); } catch { throw new ErrorIA('JSON inválido desde la IA', { texto: m[0].slice(0, 500) }); }
    } catch (e) {
      if (e.name === 'AbortError') throw new ErrorIA(`Tiempo de espera agotado (${timeoutMs} ms)`);
      if (e instanceof ErrorIA) throw e;
      throw new ErrorIA(`Fallo de red o API: ${e.message}`);
    } finally { clearTimeout(t); }
  }

  /** Clasifica una respuesta y detecta menciones de otras conductas. */
  async function interpretarRespuesta({ pregunta, slotTipo, texto, protocolo }) {
    const dims = protocolo.dimensiones.map((d) => `${d.id}: ${d.nombre}`).join('\n');
    const salida = await llamar(leerPrompt('prompt-ejecucion.md'), JSON.stringify({
      pregunta_autorizada: { id: pregunta.id, texto: pregunta.texto, tipo_dato: slotTipo, invertida: !!pregunta.invertida },
      respuesta_literal: texto,
      dimensiones_validas: dims,
    }));
    const clas = ['si', 'no', 'no_se', 'no_recuerdo', 'ambiguo', 'valor'];
    if (!clas.includes(salida.clasificacion)) throw new ErrorIA('Clasificación fuera del esquema', { salida });
    const ids = new Set(protocolo.dimensiones.map((d) => d.id));
    const menciones = (Array.isArray(salida.menciones) ? salida.menciones : [])
      .filter((m) => ids.has(m.dimension_id) && typeof m.evidencia === 'string')
      .map((m) => ({ dimension_id: m.dimension_id, evidencia: m.evidencia.slice(0, 300) }));
    return { clasificacion: salida.clasificacion, valor: salida.valor ?? null, menciones };
  }

  /** Extrae hechos estructurados de un informe escolar. */
  async function extraerInformeEscolar({ texto, protocolo }) {
    const dims = protocolo.dimensiones.filter((d) => d.dominio !== 'tamizaje')
      .map((d) => `${d.id} (${d.nombre}) slots: presencia, ${d.esenciales.join(', ')}`).join('\n');
    const salida = await llamar(leerPrompt('prompt-extraccion-informe.md'), JSON.stringify({ dimensiones: dims, informe: texto }));
    if (!Array.isArray(salida.hechos)) throw new ErrorIA('Extracción sin arreglo «hechos»', { salida });
    return salida.hechos.filter((h) => protocolo.dimensionesPorId.has(h.dimension_id)
      && ['presencia', ...protocolo.dimensionesPorId.get(h.dimension_id).esenciales].includes(h.slot)
      && typeof h.evidencia === 'string' && h.evidencia.trim()
      && (h.slot !== 'presencia' || ['si', 'no'].includes(h.valor)));
  }

  return { habilitada, modelo, interpretarRespuesta, extraerInformeEscolar };
}

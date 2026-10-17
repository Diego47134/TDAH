// Utilidades de pruebas de extremo a extremo: levantan el servidor HTTP real con una base
// SQLite temporal y registran evidencia verificable (entrada, estado anterior, decisión,
// acción resultante, estado posterior, resultado esperado y obtenido).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { crearApp } from '../../src/server.js';
import { respuestaPara, CONSENTIMIENTO } from '../fixtures/caso-ficticio.js';

export function rutaDBTemporal() {
  return path.join(os.tmpdir(), `tdah-e2e-${crypto.randomUUID()}.sqlite`);
}

export async function iniciarApp({ dbPath = rutaDBTemporal(), buscador, ia = { habilitada: false }, rvToken = '' } = {}) {
  const app = crearApp({ dbPath, buscador, ia, rvToken, tokenAcceso: '' });
  await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const req = async (metodo, ruta, cuerpo, extra = {}) => {
    const r = await fetch(base + ruta, { method: metodo, headers: { 'content-type': 'application/json', ...extra }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    return { status: r.status, body: await r.json() };
  };
  return { app, dbPath, base, req, cerrar: () => app.cerrar() };
}

export async function crearCaso(api, etiqueta = 'Caso ficticio de prueba') {
  const r = await api.req('POST', '/api/casos', { etiqueta, consentimiento: CONSENTIMIENTO });
  if (r.status !== 201) throw new Error(`crear caso: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function vista(api, id) { return (await api.req('GET', `/api/casos/${id}`)).body; }

/** Responde la pregunta vigente. `resp` = {opcion|opciones|texto|tipo} o función (pregunta) => {…}. */
export async function responder(api, id, resp) {
  const v = await vista(api, id);
  const q = v.caso.pregunta_actual;
  if (!q) throw new Error('No hay pregunta vigente');
  const r0 = typeof resp === 'function' ? resp(q) : typeof resp === 'string' ? { texto: resp } : resp;
  const r = await api.req('POST', `/api/casos/${id}/respuestas`, { pregunta_id: q.id, ...r0 });
  if (r.status !== 200) throw new Error(`responder ${q.id}: ${r.status} ${JSON.stringify(r.body)}`);
  return { pregunta: q, ...r.body };
}

/** Entrevista completa hasta que el motor no tenga más preguntas. */
export async function entrevistar(api, id, { respuesta = respuestaPara, ev = null, prueba = null, max = 150 } = {}) {
  const turnos = [];
  for (let i = 0; i < max; i++) {
    const v = await vista(api, id);
    if (!v.caso.pregunta_actual) return { turnos, vista: v };
    const r = await responder(api, id, respuesta);
    turnos.push(r);
    if (ev && prueba) ev.pasoDesdeTraza(prueba, r.traza, null, true);
  }
  throw new Error('La entrevista no terminó dentro del máximo de turnos');
}

// ------------------------------------------------------------ evidencia ---

export function crearEvidencia(archivo) {
  const pruebas = [];
  const api = {
    prueba(id, titulo, requisito) { const p = { id, titulo, requisito, pasos: [], resultado: 'en curso' }; pruebas.push(p); return p; },
    paso(p, d) { p.pasos.push(d); },
    pasoDesdeTraza(p, t, esperado, ok) {
      p.pasos.push({
        entrada: { pregunta: `${t.entrada.pregunta_id} — ${t.entrada.pregunta}`, respuesta: t.entrada.respuesta },
        estado_antes: compacto(t.estado_antes),
        decision_motor: t.decision_motor,
        interpretacion: t.interpretacion,
        accion_resultante: t.pregunta_resultante ? `Pregunta: ${t.pregunta_resultante}` : t.decision_motor.accion,
        estado_despues: compacto(t.estado_despues),
        esperado, ok,
      });
    },
    cerrar(p, ok) { p.resultado = ok ? 'APROBADA' : 'FALLIDA'; },
    escribir() {
      if (!process.env.EVIDENCIA) return;
      const dir = path.join('docs', 'evidencia', 'e2e');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${archivo}.json`), JSON.stringify({ generado: new Date().toISOString(), pruebas }, null, 2));
      fs.writeFileSync(path.join(dir, `${archivo}.md`), aMarkdown(archivo, pruebas));
    },
  };
  return api;
}

function compacto(e) {
  if (!e) return e;
  const sint = Object.entries(e.sintomas || {}).map(([k, v]) => `${k}:${v}`).join(', ');
  return { turno: e.turno, estado_global: e.estado_global, ruta: e.ruta, edad: e.edad, fase_inicial_completa: e.fase_inicial_completa,
    sintomas: sint || '(sin información)', barrido: e.barrido, tamizaje: e.tamizaje, contradicciones_abiertas: e.contradicciones_abiertas };
}

function aMarkdown(archivo, pruebas) {
  const L = [`# Evidencia E2E — ${archivo}`, '', `Generado: ${new Date().toISOString()}`, ''];
  for (const p of pruebas) {
    L.push(`## ${p.id} · ${p.titulo} — **${p.resultado}**`, '', `Requisito: ${p.requisito}`, '');
    p.pasos.forEach((s, i) => {
      L.push(`### Paso ${i + 1}`, '');
      for (const [k, v] of Object.entries(s)) {
        if (v == null) continue;
        L.push(`- **${k}:** ${typeof v === 'object' ? '`' + JSON.stringify(v) + '`' : v}`);
      }
      L.push('');
    });
  }
  return L.join('\n');
}

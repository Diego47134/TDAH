// Demostración de extremo a extremo con un caso FICTICIO:
// entrevista completa → informe escolar → vacíos → instrumentos → revisión → informe final → validación.
// Genera evidencia en docs/demo/ (transcripción, informe, auditoría y la base de datos resultante).
import fs from 'node:fs';
import path from 'node:path';
import { crearApp } from '../src/server.js';
import { ETIQUETA, respuestaPara, INFORME_ESCOLAR, INSTRUMENTOS, INTERPRETACION, CONSENTIMIENTO, ASENTIMIENTO } from '../test/fixtures/caso-ficticio.js';

const SALIDA = path.join('docs', 'demo');
const DB = path.join(SALIDA, 'demo.sqlite');
fs.mkdirSync(SALIDA, { recursive: true });
for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) fs.rmSync(f, { force: true });

const app = crearApp({ dbPath: DB, ia: { habilitada: false }, tokenAcceso: '' });
await new Promise((ok) => app.server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${app.server.address().port}`;
const req = async (m, r, b) => {
  const res = await fetch(base + r, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  const body = await res.json();
  if (!res.ok) throw new Error(`${m} ${r} → ${res.status}: ${body.error}`);
  return body;
};

const T = ['# Demostración E2E — caso ficticio', '', `Generado: ${new Date().toISOString()}  `, 'Datos 100 % ficticios. El guion responde según la pregunta que **elige el motor**; no es una lista fija.', ''];
const turnoMd = (n, r) => {
  const t = r.traza;
  T.push(`### Turno ${n} · \`${t.entrada.pregunta_id}\``, '', `**Pregunta:** ${t.entrada.pregunta}  `, `**Respuesta:** ${t.entrada.respuesta}  `,
    `**Interpretación:** ${t.interpretacion.estado_dato}${t.interpretacion.valor ? ` = «${t.interpretacion.valor}»` : ''} (${t.interpretacion.interprete})${t.interpretacion.menciones.length ? ` · menciones: ${t.interpretacion.menciones.map((m) => m.sintoma).join(', ')}` : ''}  `,
    `**Decisión del motor:** ${t.decision_motor.accion}${t.decision_motor.pregunta_id ? ` → \`${t.decision_motor.pregunta_id}\`` : ''}  `,
    `**Justificación:** ${t.decision_motor.justificacion || '—'}`, '');
};

async function entrevistar(id) {
  let n = 0;
  for (;;) {
    const v = await req('GET', `/api/casos/${id}`);
    const q = v.caso.pregunta_actual;
    if (!q) return v;
    const r = await req('POST', `/api/casos/${id}/respuestas`, { pregunta_id: q.id, ...respuestaPara(q) });
    turnoMd(q.turno, r); n++;
    if (n > 250) throw new Error('demasiados turnos');
  }
}

try {
  const v0 = await req('POST', '/api/casos', { etiqueta: ETIQUETA, consentimiento: { ...CONSENTIMIENTO, acepta_ia_externa: false } });
  const id = v0.caso.id;
  T.push(`Caso: **${v0.caso.codigo}** (${ETIQUETA})`, '', '## 1. Entrevista al apoderado', '');
  let v = await entrevistar(id);
  T.push(`> Estado tras la entrevista del hogar: **${v.caso.estado_global}** — ruta «${v.caso.ruta}». ${v.ruta_justificacion}`, '');

  T.push('## 2. Informe escolar', '', '```text', INFORME_ESCOLAR, '```', '');
  const inf = await req('POST', `/api/casos/${id}/informe-escolar`, { texto: INFORME_ESCOLAR });
  T.push(`Método de extracción: ${inf.metodo}. Datos extraídos:`, '');
  for (const h of inf.extraidos) T.push(`- \`${h.dimension_id}.${h.slot}\` = ${h.valor} — «${h.evidencia}»`);
  T.push('', `Contradicciones detectadas: ${inf.contradicciones.map((c) => c.descripcion).join(' ') || 'ninguna'}`, '');
  if (inf.resultado.pregunta) T.push(`El motor reabre la entrevista solo para el vacío: \`${inf.resultado.pregunta.id}\` — ${inf.resultado.pregunta.justificacion}`, '');
  T.push('### Entrevista de vacíos', '');
  v = await entrevistar(id);

  T.push('## 3. Instrumentos', '');
  for (const i of INSTRUMENTOS) { await req('POST', `/api/casos/${id}/evaluaciones`, i); T.push(`- ${i.instrumento_id}: ${i.estado} (${i.fecha})`); }
  T.push('- RV: no realizada (opcional; el informe lo declara como información no disponible)', '');

  T.push('## 3b. Complementación del colegio (Anexo 7-C) y entrevista al niño (Anexo 7-D)', '');
  v = await req('GET', `/api/casos/${id}`);
  const enviar = v.colegio.filter((c) => c.enviar);
  T.push(`Preguntas cubiertas por el informe (no se envían): ${v.colegio.filter((c) => c.cubierta_por_informe).map((c) => c.id).join(', ') || 'ninguna'}.`, `Preguntas a enviar al colegio: ${enviar.map((c) => c.id).join(', ')}.`, '');
  if (enviar.length) {
    await req('POST', `/api/casos/${id}/colegio`, { respuestas: [{ pregunta_id: enviar[0].id, texto: 'Necesita apoyo para organizar sus materiales (respuesta ficticia del colegio).' }] });
    T.push(`- ${enviar[0].id} «${enviar[0].texto}» → respuesta ficticia registrada con fuente «profesor».`);
  }
  v = await req('POST', `/api/casos/${id}/nna`, { asentimiento: ASENTIMIENTO });
  T.push('- Asentimiento del niño registrado antes de su entrevista.');
  for (const t of ['A veces me distraigo cuando hay ruido.', 'Me cuesta terminar las guías.']) {
    if (!v.nna.siguiente) break;
    T.push(`- Niño · ${v.nna.siguiente.id} «${v.nna.siguiente.texto}» → «${t}»`);
    v = await req('POST', `/api/casos/${id}/nna`, { pregunta_id: v.nna.siguiente.id, texto: t });
  }
  await req('POST', `/api/casos/${id}/nna`, { finalizar: true });
  T.push('- Entrevista al niño finalizada por el profesional.', '');

  T.push('## 4. Bloqueo de informe prematuro', '');
  try { await req('POST', `/api/casos/${id}/informes`); T.push('ERROR: no se bloqueó'); } catch (e) { T.push(`Intento de informe final antes de la revisión profesional → ${e.message}`, ''); }

  T.push('## 5. Revisión profesional', '');
  v = await req('GET', `/api/casos/${id}`);
  for (const c of v.contradicciones) {
    await req('POST', `/api/casos/${id}/contradicciones/${c.id}/revision`, { nota: 'Discrepancia entre contextos casa/colegio; se conserva para la integración clínica.', profesional: 'Profesional de prueba' });
    T.push(`- Contradicción revisada: ${c.descripcion}`);
  }
  await req('PUT', `/api/casos/${id}/interpretacion`, { texto: INTERPRETACION, profesional: 'Profesional de prueba' });
  T.push('- Interpretación clínica registrada por el profesional (texto de demostración).', '');

  const fin = await req('POST', `/api/casos/${id}/informes`);
  const val = await req('POST', `/api/casos/${id}/informes/${fin.id}/validacion`, { profesional: 'Profesional de prueba' });
  T.push('## 6. Informe final', '', `Generado y validado. Ver [informe-final.md](informe-final.md).`, '');

  const aud = await req('GET', `/api/casos/${id}/auditoria`);
  const conteo = aud.decisiones.reduce((m, d) => ({ ...m, [d.tipo]: (m[d.tipo] || 0) + 1 }), {});
  T.push('## 7. Auditoría', '', '| Tipo de decisión | Cantidad |', '|---|---|', ...Object.entries(conteo).map(([k, n]) => `| ${k} | ${n} |`), '',
    `Preguntas formuladas: ${aud.preguntas.length} (de ${app.protocolo.preguntas.size} del protocolo). Repetidas: ${aud.preguntas.length - new Set(aud.preguntas.map((p) => p.pregunta_id)).size}.`, '');

  fs.writeFileSync(path.join(SALIDA, 'transcripcion.md'), T.join('\n'));
  fs.writeFileSync(path.join(SALIDA, 'informe-final.md'), val.markdown);
  fs.writeFileSync(path.join(SALIDA, 'informe-final.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe ${v0.caso.codigo}</title><style>body{font:16px/1.55 Georgia,serif;max-width:900px;margin:40px auto;padding:0 16px;color:#1c2626}table{border-collapse:collapse;font-size:13px}td,th{border:1px solid #ccc;padding:4px 6px;vertical-align:top}.tabla-informe{overflow-x:auto}blockquote{background:#fbf1dc;border-left:3px solid #9a6a0b;margin:8px 0;padding:8px 12px}h2{border-top:1px solid #ddd;padding-top:12px}</style><body>${val.html}</body></html>`);
  fs.writeFileSync(path.join(SALIDA, 'auditoria.json'), JSON.stringify(aud, null, 2));
  console.log(`Demostración completa: ${aud.preguntas.length} preguntas, estado final «validado». Evidencia en ${SALIDA}/`);
} finally {
  await app.cerrar();
}

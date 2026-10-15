// Informe clínico estructurado (Etapa 9 §28; Etapa 5 §18.3; Automatización fase 3; brief §9).
// Se construye EXCLUSIVAMENTE desde el expediente. La interpretación y la decisión clínica final
// las registra el profesional responsable.
import { faseInicialCompleta, ruta, justificacionRuta, estadoSlot, puedeCerrarEntrevista, informeCargado, estadoPregunta } from './motor.js';
import { integrar } from './integracion.js';

const FUENTE = { apoderado: 'Apoderado', informe_escolar: 'Informe escolar', profesor: 'Colegio (complementación)', nino: 'Niño/niña', adolescente: 'Adolescente', instrumento: 'Instrumento', profesional: 'Profesional' };
const V = { si: 'Sí', no: 'No', ocasionalmente: 'Ocasionalmente', no_sabe: 'No sabe', no_recuerda: 'No recuerda', ambiguo: 'Información parcial', sin_dato: '—', contradiccion: 'Contradictorio' };

export function evaluarRequisitos(ctx) {
  const ini = faseInicialCompleta(ctx);
  const gate = ini ? puedeCerrarEntrevista(ctx) : { ok: false, motivos: ['Fase inicial incompleta.'] };
  const r = ruta(ctx);
  const contr = ctx.contradicciones.filter((c) => c.estado !== 'revisada');
  const todos = {
    fase_inicial_completa: { descripcion: 'Motivo, edad, informe escolar y ruta establecidos', cumplido: ini },
    entrevista_apoderado_cerrada: { descripcion: 'Entrevista del apoderado cerrada por el gate de la Etapa 9 (barrido y tamizaje completos, sin ramas abiertas)', cumplido: gate.ok, detalle: gate.ok ? null : gate.motivos.join(' ') },
    informe_escolar_segun_ruta: { descripcion: 'Informe escolar incorporado cuando la ruta lo requiere', cumplido: r !== 'con_informe' || informeCargado(ctx), detalle: r === 'con_informe' && !informeCargado(ctx) ? 'Ruta B: falta cargar el informe escolar.' : null },
    contradicciones_revisadas: { descripcion: 'Contradicciones revisadas por el profesional (sin resolverlas por suposición)', cumplido: contr.length === 0, detalle: contr.length ? `${contr.length} sin revisar.` : null },
    decision_profesional: { descripcion: 'Interpretación y decisión clínica registradas por el profesional responsable', cumplido: Boolean(ctx.caso.interpretacion?.trim() && ctx.caso.interpretacion_profesional?.trim()), detalle: ctx.caso.interpretacion ? null : 'Pendiente.' },
  };
  const lista = ctx.protocolo.requisitos_informe_final.map((id) => ({ id, ...todos[id] }));
  return { completo: lista.every((x) => x.cumplido), requisitos: lista };
}

const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const tabla = (cab, filas) => [`| ${cab.join(' | ')} |`, `| ${cab.map(() => '---').join(' | ')} |`, ...filas.map((f) => `| ${f.map(esc).join(' | ')} |`), ''];
const val = (st) => (st.estado === 'valor' ? (V[st.valor] || st.valor) : V[st.estado] || st.estado);

function etiquetaOpcion(p, alternativas, valor) {
  if (!valor || valor.startsWith('no_') || valor === 'sin_dato') return V[valor] || valor || '—';
  const ops = p.alternativas[alternativas] || [];
  return String(valor).split(',').map((v) => ops.find((o) => o.valor === v)?.texto || V[v] || v).join(', ');
}

export function generarInforme(ctx, { tipo = 'borrador', requisitos, validacion } = {}) {
  const p = ctx.protocolo; const c = ctx.caso;
  const req = requisitos || evaluarRequisitos(ctx);
  const L = [];
  const estadoTxt = validacion ? `VALIDADO por ${validacion.por} el ${validacion.fecha.slice(0, 10)}` : tipo === 'final' ? 'FINAL — PENDIENTE DE VALIDACIÓN PROFESIONAL' : 'BORRADOR — EVALUACIÓN EN CURSO';
  L.push(`# Informe de evaluación — ${c.codigo}`, '', `**Estado:** ${estadoTxt}`, '');
  L.push(`> Informe generado desde el expediente estructurado con el protocolo ${p.id} ${p.version}. Es una hipótesis estructurada: la decisión clínica final corresponde al profesional responsable (Etapa 9 §1 y §28). Las inferencias no se presentan como hechos documentados.`, '');
  if (!req.completo) {
    L.push('**Requisitos pendientes para el informe final:**', '');
    for (const r of req.requisitos.filter((x) => !x.cumplido)) L.push(`- ${r.descripcion}${r.detalle ? ` — ${r.detalle}` : ''}`);
    L.push('');
  }
  if (!faseInicialCompleta(ctx)) { L.push('La fase inicial no está completa; no es posible integrar el caso.'); return L.join('\n'); }
  const I = integrar(ctx);

  // A. Identificación
  L.push('## Identificación y motivo de consulta', '');
  L.push(`- **Caso:** ${c.codigo} (${c.etiqueta})`);
  L.push(`- **Motivo de consulta (literal):** ${val(estadoSlot(ctx, 'INI', 'motivo'))}`);
  L.push(`- **Edad:** ${I.edad ?? '—'} años · **Etapa evolutiva (Etapa 2):** ${I.etapa || '—'}`);
  L.push(`- **Ruta:** ${justificacionRuta(ctx)}`);
  L.push(`- **Fecha de generación:** ${new Date().toISOString().slice(0, 10)}`, '');

  // Auditoría previa (Etapa 9 §28.1)
  L.push('## Auditoría automática previa a la salida', '');
  L.push(...tabla(['Control', 'Resultado', 'Detalle'], I.auditoria.map((a) => [a.item, a.ok ? '✓' : '✗', a.detalle])));

  // Síntesis de fuentes (Etapa 5 §18.3-B; brief §9)
  L.push('## Síntesis de fuentes', '');
  for (const f of I.requisitos.R10.fuentes) {
    const hs = ctx.hechos.filter((h) => h.fuente === f && h.estado === 'valor' && h.origen !== 'mencion_espontanea');
    L.push(`- **${FUENTE[f] || f}:** ${hs.length} datos registrados.`);
  }
  if (ctx.informesEscolares.length) {
    L.push('', '**Información obtenida del informe escolar (con su evidencia literal):**', '');
    for (const h of ctx.hechos.filter((x) => x.fuente === 'informe_escolar')) {
      const nombre = h.dimension_id === 'INF' ? 'Dato general' : `${h.dimension_id} ${p.sintomasPorId.get(h.dimension_id)?.nombre ?? ''}`.trim();
      const dato = h.slot === 'desde' ? 'inicio referido' : h.slot === 'impacto_academico' ? 'impacto académico' : h.slot.replace('presencia:informe', 'presencia');
      const valor = h.slot === 'desde' ? '' : `: ${h.slot === 'frecuencia' ? etiquetaOpcion(p, 'frecuencia', h.valor) : V[h.valor] || h.valor}`;
      L.push(`- ${nombre} · ${dato}${valor} — «${h.evidencia}»`);
    }
  }
  const col = ctx.hechos.filter((h) => h.fuente === 'profesor' && h.dimension_id === 'COL');
  if (col.length) { L.push('', '**Complementación del colegio:**', ''); for (const h of col) L.push(`- ${p.preguntas.get(h.slot)?.texto}: ${h.valor ?? V[h.estado]}`); }
  const nna = ctx.hechos.filter((h) => h.dimension_id === 'NNA' && h.slot !== 'cerrada');
  if (nna.length) { L.push('', `**Entrevista ${nna[0].fuente === 'nino' ? 'al niño/niña' : 'al adolescente'}:**`, ''); for (const h of nna) L.push(`- ${p.preguntas.get(h.slot)?.texto} → ${h.valor ?? V[h.estado]}`); }
  L.push('');

  // 1. Diagnóstico según DSM-5-TR
  L.push('## 1. Diagnóstico según DSM-5-TR', '');
  L.push(`**Puerta de suficiencia diagnóstica (Etapa 5 §20–21):** ${I.puerta}${I.faltantes.length ? ` — falta: ${I.faltantes.join(', ')}` : ''}`, '');
  L.push(`**Estado de la hipótesis:** ${I.resultado.titulo}.`, '');
  L.push(`**${I.resultado.umbral}**`, '');
  L.push('### Análisis síntoma por síntoma', '');
  L.push(...tabla(['Código', 'Síntoma', 'Estado', 'Frecuencia', 'Desde', 'Contextos', 'Fuentes'],
    I.sintomas.map((s) => [s.id, s.nombre, s.estado, etiquetaOpcion(p, 'frecuencia', s.frecuencia), etiquetaOpcion(p, 'desde', s.desde), s.contextos.join(', ') || '—', s.fuentes.map((f) => FUENTE[f] || f).join(', ') || '—'])));
  L.push(`Inatención: ${I.requisitos.R1.apoyados} de ${I.requisitos.R1.total} síntomas apoyados por evidencia (umbral ${I.umbral}). Hiperactividad/impulsividad: ${I.requisitos.R2.apoyados} de ${I.requisitos.R2.total} (umbral ${I.umbral}).`, '');
  L.push('### Contraste de los demás requisitos diagnósticos', '');
  L.push(...tabla(['Requisito', 'Estado', 'Detalle'], Object.entries(I.requisitos).map(([k, r]) => [`${k} — ${r.nombre}`, r.estado, r.detalle || `${r.apoyados ?? ''}`])));

  // 2. Trayectoria evolutiva
  L.push('## 2. Trayectoria evolutiva', '');
  for (const q of p.bloques.find((b) => b.id === 'trayectoria').preguntas) { const st = estadoPregunta(ctx, p.preguntas.get(q)); if (st.estado !== 'sin_dato') L.push(`- ${p.preguntas.get(q).texto} → ${val(st)}`); }
  const des = ctx.hechos.filter((h) => h.dimension_id === 'INF' && h.slot === 'desde');
  for (const h of des) L.push(`- Informe escolar: «${h.evidencia}»`);
  L.push('');

  // 3. Funcionamiento cognitivo  /  5–7 áreas
  L.push('## 3. Funcionamiento cognitivo (comparación con lo esperable para la edad)', '');
  L.push(...tabla(['Área', 'Esperable para la etapa (Etapa 2)', 'Observado', 'Estado'],
    I.areas.map((a) => [a.nombre, a.esperable || '—', a.evidencia.map((x) => x.texto).join('; ') || '—', a.estado])));
  L.push('_«Área con mayor dificultad» se usa en ausencia de una medida normativa; «área descendida» exige una referencia objetiva validada (Etapa 5 §26)._', '');

  L.push('## 4. Conducta', '');
  const conductas = I.sintomas.filter((s) => ['APOYADO POR EVIDENCIA', 'PROBABLE', 'POSIBLE', 'CONTRADICTORIO'].includes(s.estado));
  L.push(...(conductas.length ? conductas.map((s) => `- ${s.conducta} — ${s.estado.toLowerCase()}`) : ['- Sin conductas DSM-5-TR con evidencia positiva.']), '');
  L.push('## 5. Áreas con mayor dificultad', '', ...(I.areas.filter((a) => a.estado === 'ÁREA CON MAYOR DIFICULTAD').map((a) => `- ${a.nombre}`).concat(I.areas.some((a) => a.estado === 'ÁREA CON MAYOR DIFICULTAD') ? [] : ['- Ninguna identificada con la información disponible.'])), '');
  L.push('## 6. Áreas fortalecidas (recursos funcionales)', '', ...(I.recursos.length ? I.recursos.map((r) => `- ${r.texto}`) : ['- No se identificaron recursos funcionales específicos.']), '');
  L.push('## 7. Áreas relativamente preservadas', '', ...(I.areas.filter((a) => a.estado === 'RELATIVAMENTE PRESERVADA').map((a) => `- ${a.nombre}`).concat(I.areas.some((a) => a.estado === 'RELATIVAMENTE PRESERVADA') ? [] : ['- Sin información suficiente.'])), '');
  L.push('## 8. Contexto y modulación', '', ...(I.moduladores.length ? I.moduladores.map((m) => `- ${m.texto}: ${V[m.valor] || m.valor}`) : ['- Sin información de moduladores contextuales.']), '');
  L.push('## 9. Impacto funcional', '', `- ${I.requisitos.R7.estado}: ${I.requisitos.R7.detalle}`, '');

  // 10. Seis perfiles
  L.push('## 10. Seis perfiles multidimensionales', '', '_Niveles de análisis del mismo niño: no son subtipos, diagnósticos ni puntajes (Etapa 1 §8; Etapa 5 §25)._', '');
  L.push(...tabla(['Perfil', 'Nivel global de evidencia', 'Caracterización del caso'], I.perfiles.map((x) => [x.perfil, x.nivel_global, x.contenido])));

  // 11. RV / evidencia objetiva
  L.push('## 11. Realidad virtual y evidencia objetiva', '');
  for (const i of p.instrumentos) {
    const ev = ctx.evaluaciones.find((x) => x.instrumento_id === i.id);
    if (!ev || ev.estado === 'pendiente') { L.push(`- **${i.nombre}:** no realizada.`); continue; }
    const res = ev.resultados ? Object.entries(ev.resultados).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
    L.push(`- **${i.nombre}:** ${ev.estado === 'realizada' ? `realizada ${ev.fecha || ''}${ev.aplicador ? ` por ${ev.aplicador}` : ''}` : 'no aplica'}${res ? ` — ${res}` : ''}${ev.observaciones ? ` (${ev.observaciones})` : ''}`);
  }
  L.push('', '_La RV, Nesplora o un instrumento aislado no determinan por sí solos un diagnóstico: caracterizan las variables que realmente miden (Etapa 9 §18)._', '');

  // 12. Alternativas
  L.push('## 12. Explicaciones alternativas y condiciones concurrentes', '');
  L.push(`- **Barrido diferencial general:** ${I.barrido.estado}${I.barrido.resultado ? ` — ${I.barrido.resultado}` : ''}`);
  for (const r of I.barrido.ramas) L.push(`  - ${p.barrido.opciones.find((o) => o.codigo === r.clave).texto}: ${r.diferencial}`);
  L.push(`- **Tamizaje médico, sensorial y del sueño:** ${I.tamizaje.estado} — ${I.tamizaje.resultado}`);
  for (const r of I.tamizaje.ramas) {
    const cat = p.tamizaje.categorias[r.categoria];
    const det = cat.preguntas.map((q) => estadoSlot(ctx, `TAM-${r.categoria}`, q.id)).filter((s) => s.estado !== 'sin_dato').map((s) => val(s)).join('; ');
    L.push(`  - ${cat.nombre}: ${det || 'sin detalle'}`);
  }
  for (const a of I.tamizaje.alertas) L.push(`  - **Requiere valoración profesional:** ${a.motivo}`);
  L.push('', '_El tamizaje no diagnostica ni descarta enfermedades, no confirma ni excluye TDAH y no autoriza indicaciones farmacológicas (Etapa 9 §J.6.1)._', '');

  // 13–15
  L.push('## 13–14. Información faltante y su relevancia', '');
  L.push(...(I.informacionFaltante.length ? tabla(['Información', 'Relevancia', 'Por qué importa'], I.informacionFaltante.map((x) => [x.que, x.relevancia, x.porque])) : ['Sin información faltante relevante.', '']));
  if (ctx.contradicciones.length) {
    L.push('**Discrepancias registradas (conservadas, no resueltas por suposición):**', '');
    for (const x of ctx.contradicciones) L.push(`- ${x.dimension_id}: ${x.descripcion} — ${x.estado === 'revisada' ? `revisada por ${x.revisado_por}: ${x.nota_revision}` : '**sin revisar**'}`);
    L.push('');
  }
  L.push('## 15. Áreas para fortalecimiento o evaluación posterior', '');
  const ev15 = [...I.areas.filter((a) => a.estado === 'ÁREA CON MAYOR DIFICULTAD').map((a) => `Fortalecimiento: ${a.nombre}`),
    ...I.areas.filter((a) => a.estado === 'SIN INFORMACIÓN SUFICIENTE').map((a) => `Evaluación posterior: ${a.nombre}`),
    ...I.tamizaje.alertas.map((a) => `Valoración sanitaria: ${a.motivo}`)];
  L.push(...(ev15.length ? ev15.map((x) => `- ${x}`) : ['- Sin áreas identificadas.']), '');

  // 16. Inferencias multinivel
  L.push('## 16. Inferencias explicativas multinivel', '', '_Nivel 1 = evidencia del caso; Nivel 2 = inferencia funcional; Nivel 3 = hipótesis neurobiológica basada en literatura (Etapa 9 §19.2). Una inferencia de nivel superior nunca se presenta como observación directa._', '');
  if (!I.inferencias.length) L.push('Sin áreas con evidencia suficiente para inferencias.', '');
  for (const x of I.inferencias) {
    L.push(`### ${x.area}`, '', `- **Nivel 1:** ${x.nivel1.join('; ')}`, `- **Nivel 2:** ${x.nivel2}`, `- **Nivel 3:** ${x.nivel3}`, `- **Límite:** ${x.limite}`, '');
  }
  // 17. Sugerencias
  L.push('## 17. Sugerencias de acción basadas en evidencia', '', '_Derivadas de las dificultades realmente identificadas; deben ajustarse por el profesional. El sistema no prescribe, dosifica ni modifica tratamientos (Etapa 9 §21.12)._', '');
  for (const s of I.sugerencias) {
    L.push(`- **${s.origen}:** ${s.texto}`);
    for (const r of s.referencias) L.push(`  - ${r}`);
  }
  L.push('');
  // 18. Trazabilidad
  L.push('## 18. Trazabilidad de la conclusión', '', '_Fuente → dato original → pregunta → síntoma (Etapa 9 §23). El registro completo de decisiones está en la auditoría del caso._', '');
  const tr = [];
  for (const s of I.sintomas.filter((x) => x.estado !== 'NO INFORMADO')) {
    for (const h of ctx.hechos.filter((x) => x.dimension_id === s.id)) tr.push([s.id, FUENTE[h.fuente] || h.fuente, h.pregunta_id || h.origen, h.slot, h.estado === 'valor' ? (V[h.valor] || h.valor) : V[h.estado], h.evidencia || '']);
  }
  L.push(...(tr.length ? tabla(['Síntoma', 'Fuente', 'Pregunta/origen', 'Dato', 'Valor', 'Respuesta original'], tr) : ['Sin datos sintomáticos.', '']));
  // 19. Revisión profesional
  L.push('## 19. Revisión profesional', '');
  if (c.interpretacion?.trim()) L.push(c.interpretacion.trim(), '', `_Redactada por: ${c.interpretacion_profesional} (${(c.interpretacion_fecha || '').slice(0, 10)})._`, '');
  else L.push('Pendiente: la interpretación y la decisión clínica final deben ser registradas por el profesional responsable.', '');
  L.push(validacion ? `**Validado por ${validacion.por}** el ${validacion.fecha.slice(0, 10)}.` : 'Pendiente de validación profesional.', '');
  L.push('## Referencias científicas de apoyo (Etapa 9)', '', ...Object.entries(p.referencias).map(([k, v]) => `- [${k}] ${v}`), '');
  return L.join('\n');
}

/** Markdown → HTML mínimo (encabezados, listas anidadas, tablas, citas, negrita, cursiva). */
export function markdownAHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_(.+?)_(?=[\s.,;)]|$)/g, '$1<em>$2</em>');
  const out = []; let lista = 0; let enTabla = false;
  const cerrar = (h = 0) => { while (lista > h) { out.push('</ul>'); lista--; } };
  const cerrarTabla = () => { if (enTabla) { out.push('</tbody></table></div>'); enTabla = false; } };
  const lineas = md.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^\|.*\|$/.test(l)) {
      cerrar();
      const celdas = l.slice(1, -1).split('|').map((x) => x.trim());
      if (!enTabla) {
        out.push('<div class="tabla-informe"><table><thead><tr>' + celdas.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
        enTabla = true; i++; continue; // salta separador
      }
      out.push('<tr>' + celdas.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      continue;
    }
    cerrarTabla();
    const m = l.match(/^(\s*)- (.*)$/);
    if (m) {
      const nivel = Math.floor(m[1].length / 2) + 1;
      while (lista < nivel) { out.push('<ul>'); lista++; }
      cerrar(nivel);
      out.push(`<li>${inline(m[2])}</li>`);
      continue;
    }
    cerrar();
    if (/^### /.test(l)) out.push(`<h3>${inline(l.slice(4))}</h3>`);
    else if (/^## /.test(l)) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (/^# /.test(l)) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (/^> /.test(l)) out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  cerrar(); cerrarTabla();
  return out.join('\n');
}

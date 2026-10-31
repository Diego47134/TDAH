// Informe clínico estructurado (Etapa 9 §28; Etapa 5 §18.3; Automatización fase 3; brief §9).
// Se construye EXCLUSIVAMENTE desde el expediente. La interpretación y la decisión clínica final
// las registra el profesional responsable.
import { citar } from './bibliografia.js';
import { faseInicialCompleta, ruta, justificacionRuta, estadoSlot, puedeCerrarEntrevista, informeCargado, estadoPregunta } from './motor.js';
import { integrar } from './integracion.js';
import { informeIntegrado } from './informeIntegrado.js';

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

export function generarInforme(ctx, { tipo = 'borrador', requisitos, validacion, redaccion = null } = {}) {
  const p = ctx.protocolo; const c = ctx.caso;
  const req = requisitos || evaluarRequisitos(ctx);
  const L = [];
  const estadoTxt = validacion ? `VALIDADO por ${validacion.por} el ${validacion.fecha.slice(0, 10)}` : tipo === 'final' ? 'FINAL — PENDIENTE DE VALIDACIÓN PROFESIONAL' : 'BORRADOR — PENDIENTE (evaluación en curso)';
  L.push(`# Informe clínico-neuropsicológico y de orientación educativa — ${c.codigo}`, '', `**Estado:** ${estadoTxt}`, '');
  L.push(`> Informe generado desde el expediente estructurado con el protocolo ${p.id} ${p.version}. Es una hipótesis estructurada: la decisión clínica final corresponde al profesional responsable (Etapa 9 §1 y §28). Las inferencias no se presentan como hechos documentados.`, '');
  if (!req.completo) {
    L.push('**Requisitos pendientes para el informe final:**', '');
    for (const r of req.requisitos.filter((x) => !x.cumplido)) L.push(`- ${r.descripcion}${r.detalle ? ` — ${r.detalle}` : ''}`);
    L.push('');
  }
  if (!faseInicialCompleta(ctx)) { L.push('La fase inicial no está completa; no es posible integrar el caso.', '', ...seccionLegal(ctx)); return L.join('\n'); }
  const I = integrar(ctx);

  // Informe integrado (especificación «Módulo de generación del informe clínico-neuropsicológico y educativo»).
  const { lineas } = informeIntegrado(ctx, I, { validacion, tipo, redaccion });
  L.push(...lineas);
  L.push('## Referencias científicas de apoyo', '', ...Object.entries(p.referencias).map(([k, v]) => `- [${k}] ${v}`), '');
  if (ctx.referencias?.length) {
    L.push('## Bibliografía consultada por el profesional', '', '_Referencias obtenidas mediante búsqueda bibliográfica en internet (Europe PMC / PubMed) y seleccionadas por el profesional; respaldan la interpretación, no sustituyen el juicio clínico._', '');
    ctx.referencias.forEach((r, i) => L.push(`- [B${i + 1}] ${citar(r.referencia)}${r.nota ? ` — ${r.nota}` : ''} (agregada por ${r.profesional}, ${r.creado.slice(0, 10)})`));
    L.push('');
  }
  L.push(...seccionLegal(ctx));
  return L.join('\n');
}

/** Consentimiento, confidencialidad y alcance (Ley 19.628/21.719, Ley 20.584, Ley 21.331). */
function seccionLegal(ctx) {
  const L = [];
  const cons = (ctx.consentimientos || []).filter((x) => !x.revocado);
  const ETQ_MEDIO = { escrito_firmado: 'escrito firmado', electronico: 'electrónico', verbal_registrado: 'verbal registrado' };
  L.push('## Consentimiento, confidencialidad y alcance de este informe', '');
  for (const x of cons) {
    L.push(x.tipo === 'tratamiento_datos'
      ? `- Consentimiento informado del representante legal (${x.relacion.replace(/_/g, ' ')}), medio ${ETQ_MEDIO[x.medio] || x.medio}, obtenido por ${x.profesional} el ${x.creado.slice(0, 10)} (política de privacidad versión ${x.version_politica}).`
      : `- Asentimiento del niño, niña o adolescente registrado por ${x.profesional} el ${x.creado.slice(0, 10)}.`);
  }
  if (!cons.length) L.push('- Sin consentimiento registrado en el expediente.');
  L.push('',
    '_Documento confidencial que contiene datos sensibles de salud (Ley 19.628, modificada por la Ley 21.719; Ley 20.584). Su uso se limita a la finalidad de evaluación clínica para la que fue elaborado y no puede comunicarse a terceros sin autorización del representante legal, salvo en los casos que la ley permite. Este informe es una herramienta de apoyo: no constituye por sí mismo un diagnóstico; la interpretación, el diagnóstico y las indicaciones son responsabilidad exclusiva del profesional de salud que lo valida. Ningún diagnóstico de salud mental puede usarse para discriminar a la persona evaluada (Ley 21.331, art. 9 N° 15)._', '');
  return L;
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

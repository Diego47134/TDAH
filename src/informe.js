// Generador de informes: se construye EXCLUSIVAMENTE desde el expediente estructurado.
// No inventa datos ni redacta interpretación clínica (la escribe el profesional responsable).
import {
  faseInicialCompleta, evaluarTodas, ruta, justificacionRuta, estadoSlot, hechosDe,
} from './motor.js';

const FUENTE = { apoderado: 'Apoderado', informe_escolar: 'Informe escolar', instrumento: 'Instrumento', observacion: 'Observación', profesional: 'Profesional', otra: 'Otra fuente' };
const DOMINIO = { inatencion: 'Inatención', hiperactividad: 'Hiperactividad', impulsividad: 'Impulsividad', desarrollo: 'Desarrollo', trayectoria: 'Trayectoria', autonomia: 'Autonomía', funcionamiento: 'Funcionamiento', escolar: 'Ámbito escolar', tamizaje: 'Tamizaje médico, sensorial y del sueño' };
const ESTADO_DATO = { no_sabe: 'No sabe', no_recuerda: 'No recuerda', ambiguo: 'Respuesta ambigua', sin_dato: 'Sin dato' };
const TERMINALES = ['resuelta', 'parcial', 'no_aplica'];

export function evaluarRequisitos(ctx) {
  const p = ctx.protocolo;
  const evals = faseInicialCompleta(ctx) ? evaluarTodas(ctx) : [];
  const abiertas = evals.filter((e) => e.obligatoria && !TERMINALES.includes(e.estado));
  const tam = evals.filter((e) => e.dominio === 'tamizaje' && !TERMINALES.includes(e.estado));
  const r = ruta(ctx);
  const instrFaltantes = p.instrumentos.filter((i) => i.obligatorio).filter((i) => {
    const ev = ctx.evaluaciones.find((e) => e.instrumento_id === i.id);
    return !ev || !(ev.estado === 'realizada' || (ev.estado === 'no_aplica' && ev.observaciones));
  });
  const contrAbiertas = ctx.contradicciones.filter((c) => c.estado !== 'revisada');
  const todos = {
    fase_inicial_completa: { descripcion: 'Motivo, edad, informe escolar y ruta establecidos', cumplido: faseInicialCompleta(ctx), detalle: null },
    entrevista_cerrada: { descripcion: 'Todas las dimensiones obligatorias exploradas', cumplido: evals.length > 0 && abiertas.length === 0,
      detalle: abiertas.length ? `Pendientes: ${abiertas.map((e) => `${e.nombre} (${e.estado})`).join('; ')}` : null },
    informe_escolar_segun_ruta: { descripcion: 'Informe escolar incorporado cuando la ruta lo requiere', cumplido: r !== 'con_informe' || ctx.informesEscolares.length > 0,
      detalle: r === 'con_informe' && !ctx.informesEscolares.length ? 'La ruta es «con informe escolar» y el informe no ha sido cargado.' : null },
    tamizaje_completo: { descripcion: 'Tamizaje médico, sensorial y del sueño completo', cumplido: evals.length > 0 && tam.length === 0,
      detalle: tam.length ? `Pendientes: ${tam.map((e) => e.nombre).join(', ')}` : null },
    instrumentos_obligatorios: { descripcion: 'Instrumentos obligatorios del protocolo registrados', cumplido: instrFaltantes.length === 0,
      detalle: instrFaltantes.length ? `Faltan: ${instrFaltantes.map((i) => i.nombre).join('; ')}` : null },
    contradicciones_revisadas: { descripcion: 'Contradicciones revisadas por el profesional (sin resolverlas por suposición)', cumplido: contrAbiertas.length === 0,
      detalle: contrAbiertas.length ? `${contrAbiertas.length} contradicción(es) sin revisar` : null },
    interpretacion_profesional: { descripcion: 'Interpretación clínica redactada por el profesional responsable', cumplido: Boolean(ctx.caso.interpretacion?.trim() && ctx.caso.interpretacion_profesional?.trim()),
      detalle: ctx.caso.interpretacion ? null : 'El profesional aún no ha registrado la interpretación clínica.' },
  };
  const lista = p.requisitos_informe_final.map((id) => ({ id, ...todos[id] }));
  return { completo: lista.every((x) => x.cumplido), requisitos: lista };
}

function valorLegible(st) {
  if (st.estado === 'valor') return st.valor === 'si' ? 'Sí' : st.valor === 'no' ? 'No' : st.valor;
  if (st.estado === 'contradiccion') return `Contradictorio (${st.valores.join(' / ')})`;
  return ESTADO_DATO[st.estado] || st.estado;
}

function lineaHecho(p, h) {
  const v = h.estado === 'valor' ? (h.valor === 'si' ? 'Sí' : h.valor === 'no' ? 'No' : h.valor) : ESTADO_DATO[h.estado];
  const extra = h.origen === 'mencion_espontanea' ? ' _(mención espontánea)_' : '';
  return `- **${p.slots[h.slot].etiqueta}:** ${v}${extra}`;
}

export function generarInforme(ctx, { tipo = 'borrador', requisitos, validacion } = {}) {
  const p = ctx.protocolo;
  const c = ctx.caso;
  const req = requisitos || evaluarRequisitos(ctx);
  const evals = faseInicialCompleta(ctx) ? evaluarTodas(ctx) : [];
  const L = [];
  const estadoTxt = validacion ? `VALIDADO por ${validacion.por} el ${validacion.fecha.slice(0, 10)}`
    : tipo === 'final' ? 'FINAL — PENDIENTE DE VALIDACIÓN PROFESIONAL' : 'BORRADOR — EVALUACIÓN PENDIENTE';

  L.push(`# Informe de evaluación — ${c.codigo}`, '');
  L.push(`**Estado:** ${estadoTxt}`, '');
  L.push('> Este informe se genera a partir del expediente estructurado. No sustituye el juicio clínico: su contenido debe ser revisado y validado por el profesional responsable. Las inferencias automáticas no se presentan como hechos documentados.', '');
  if (p.estado === 'PROVISIONAL') L.push(`> **Protocolo provisional (${p.version}).** ${p.aviso}`, '');
  if (!req.completo) {
    L.push('**Requisitos pendientes para el informe final:**', '');
    for (const r of req.requisitos.filter((x) => !x.cumplido)) L.push(`- ${r.descripcion}${r.detalle ? ` — ${r.detalle}` : ''}`);
    L.push('');
  }

  // 1
  const motivo = estadoSlot(ctx, 'INI', 'motivo'); const edadSt = estadoSlot(ctx, 'INI', 'edad');
  L.push('## 1. Datos de la evaluación', '');
  L.push(`- **Caso:** ${c.codigo} (${c.etiqueta})`);
  L.push(`- **Fecha de generación:** ${new Date().toISOString().slice(0, 10)}`);
  L.push(`- **Protocolo:** ${p.id} ${p.version}`);
  L.push(`- **Motivo de consulta (literal):** ${valorLegible(motivo)}`);
  L.push(`- **Edad:** ${edadSt.estado === 'valor' ? `${edadSt.valor} años` : valorLegible(edadSt)}`);
  L.push(`- **Ruta de entrevista:** ${ruta(ctx) === 'con_informe' ? 'Con informe escolar' : ruta(ctx) === 'completa' ? 'Entrevista completa' : 'No determinada'} — ${justificacionRuta(ctx)}`, '');

  // 2 y 3
  const porFuente = (fuente, titulo, vacio) => {
    L.push(titulo, '');
    let alguno = false;
    for (const dom of p.orden_dominios) {
      const dims = p.dimensiones.filter((d) => d.dominio === dom);
      const bloques = [];
      for (const d of dims) {
        const hs = ctx.hechos.filter((h) => h.dimension_id === d.id && h.fuente === fuente);
        if (!hs.length) continue;
        // Un renglón por dato: el registro vigente y, si hubo, la respuesta inicial incierta que fue aclarada.
        const porSlot = new Map();
        for (const h of hs) (porSlot.get(h.slot) || porSlot.set(h.slot, []).get(h.slot)).push(h);
        const lineas = [];
        for (const lista of porSlot.values()) {
          const vigentes = lista.filter((h) => h.estado === 'valor');
          const finales = vigentes.length ? vigentes : [lista[lista.length - 1]];
          const previas = lista.filter((h) => h.estado !== 'valor' && vigentes.length);
          for (const h of finales) {
            let l = lineaHecho(p, h);
            if (previas.length) l += ` _(respuesta inicial: ${previas.map((x) => ESTADO_DATO[x.estado].toLowerCase()).join(', ')}; aclarada después)_`;
            if (fuente === 'informe_escolar' && h.evidencia) l += ` — «${h.evidencia}»`;
            lineas.push(l);
          }
        }
        bloques.push(`**${d.nombre}**`, ...lineas, '');
      }
      if (bloques.length) { alguno = true; L.push(`### ${DOMINIO[dom]}`, '', ...bloques); }
    }
    if (!alguno) L.push(vacio, '');
  };
  porFuente('apoderado', '## 2. Antecedentes aportados por el apoderado', 'No hay antecedentes registrados del apoderado.');
  porFuente('informe_escolar', '## 3. Información obtenida del informe escolar',
    ruta(ctx) === 'con_informe' ? 'El informe escolar aún no ha sido incorporado.' : 'No se dispone de informe escolar para esta evaluación.');

  // 4
  L.push('## 4. Resultados de instrumentos aplicados', '');
  for (const i of p.instrumentos) {
    const ev = ctx.evaluaciones.find((e) => e.instrumento_id === i.id);
    L.push(`### ${i.nombre}${i.obligatorio ? ' (obligatorio)' : ''}`, '');
    if (!ev || ev.estado === 'pendiente') { L.push('- **Estado:** Pendiente', ''); continue; }
    L.push(`- **Estado:** ${ev.estado === 'realizada' ? 'Realizada' : 'No aplica'}${ev.fecha ? ` — ${ev.fecha}` : ''}${ev.aplicador ? ` — aplicada por ${ev.aplicador}` : ''}`);
    if (ev.resultados && typeof ev.resultados === 'object') {
      for (const [k, v] of Object.entries(ev.resultados)) L.push(`- **${k}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
    if (ev.observaciones) L.push(`- **Observaciones:** ${ev.observaciones}`);
    L.push('');
  }
  L.push('_Los resultados de realidad virtual, de Nesplora o de cualquier instrumento aislado no determinan por sí solos un diagnóstico._', '');

  // 5
  L.push('## 5. Hallazgos y patrones observados', '');
  L.push('_Descripción de los datos registrados; no constituye interpretación diagnóstica._', '');
  if (!evals.length) L.push('Sin datos suficientes (fase inicial incompleta).', '');
  for (const dom of p.orden_dominios.filter((x) => x !== 'tamizaje')) {
    const ds = evals.filter((e) => e.dominio === dom && e.estado !== 'no_aplica');
    if (!ds.length) continue;
    const presentes = ds.filter((e) => e.slots.presencia.estado === 'valor' && e.slots.presencia.valor === 'si');
    L.push(`- **${DOMINIO[dom]}:** presencia referida en ${presentes.length} de ${ds.length} dimensiones exploradas.`);
    for (const e of presentes) {
      const fuentesSi = [...new Set(hechosDe(ctx, e.id, 'presencia').filter((h) => h.estado === 'valor' && h.valor === 'si').map((h) => FUENTE[h.fuente]))];
      const det = ['frecuencia', 'contextos', 'inicio', 'impacto'].filter((s) => e.slots[s])
        .map((s) => `${p.slots[s].etiqueta.toLowerCase()}: ${valorLegible(e.slots[s])}`).join('; ');
      L.push(`  - ${e.nombre} — fuentes: ${fuentesSi.join(', ')}${fuentesSi.length > 1 ? ' (coinciden)' : ''}${det ? `. ${det}` : ''}`);
    }
  }
  L.push('');

  // 6
  L.push('## 6. Información ausente o contradictoria', '');
  const inciertos = ctx.hechos.filter((h) => ['no_sabe', 'no_recuerda', 'ambiguo'].includes(h.estado))
    .filter((h) => estadoSlot(ctx, h.dimension_id, h.slot).estado !== 'valor');
  const nombreDim = (id) => (id === 'INI' ? 'Datos iniciales' : p.dimensionesPorId.get(id)?.nombre || id);
  if (inciertos.length) {
    L.push('**Datos desconocidos o ambiguos (no se interpretan como negativos):**', '');
    const vistos = new Set();
    for (const h of inciertos) {
      const k = `${h.dimension_id}/${h.slot}`; if (vistos.has(k)) continue; vistos.add(k);
      L.push(`- ${nombreDim(h.dimension_id)} — ${p.slots[h.slot].etiqueta}: ${ESTADO_DATO[estadoSlot(ctx, h.dimension_id, h.slot).estado] || ESTADO_DATO[h.estado]} (fuente: ${FUENTE[h.fuente]})`);
    }
    L.push('');
  }
  if (ctx.contradicciones.length) {
    L.push('**Contradicciones registradas (no resueltas por suposición):**', '');
    for (const cc of ctx.contradicciones) {
      L.push(`- ${nombreDim(cc.dimension_id)}: ${cc.descripcion} — ${cc.estado === 'revisada' ? `revisada por ${cc.revisado_por}: ${cc.nota_revision}` : '**sin revisar**'}`);
    }
    L.push('');
  }
  const incompletas = evals.filter((e) => !['resuelta', 'no_aplica'].includes(e.estado));
  if (incompletas.length) {
    L.push('**Dimensiones parcial o no caracterizadas:**', '');
    for (const e of incompletas) L.push(`- ${e.nombre}: ${e.estado.replace('_', ' ')}${e.motivo ? ` — ${e.motivo}` : ''}`);
    L.push('');
  }
  if (!inciertos.length && !ctx.contradicciones.length && !incompletas.length) L.push('No se registran datos ausentes ni contradictorios.', '');

  // 7
  L.push('## 7. Explicaciones alternativas que requieren consideración', '');
  L.push('_El tamizaje no constituye diagnóstico médico y no cierra otras áreas de evaluación._', '');
  for (const e of evals.filter((x) => x.dominio === 'tamizaje')) {
    const pres = e.slots.presencia;
    let txt;
    if (pres.estado === 'sin_dato') txt = 'Pendiente de explorar.';
    else if (pres.estado === 'valor' && pres.valor === 'no') txt = 'Situación no referida.';
    else if (pres.estado === 'valor' && pres.valor === 'si') {
      const ev = e.slots.evaluado_profesional;
      const verif = !(ev.estado === 'valor' && ev.valor === 'si');
      txt = `Situación presente: ${valorLegible(e.slots.descripcion)}. Evaluada por profesional: ${valorLegible(ev)}.${verif ? ' **Requiere verificación profesional.**' : ''}`;
    } else txt = `Información desconocida (${valorLegible(pres)}). **Requiere verificación profesional.**`;
    L.push(`- **${e.nombre}:** ${txt}`);
  }
  L.push('');

  // 8
  L.push('## 8. Interpretación clínica', '');
  if (c.interpretacion?.trim()) {
    L.push(c.interpretacion.trim(), '', `_Redactada por: ${c.interpretacion_profesional} (${(c.interpretacion_fecha || '').slice(0, 10)})._`, '');
  } else L.push('Pendiente. Debe redactarla el profesional responsable; el sistema no genera interpretación clínica.', '');

  // 9
  L.push('## 9. Limitaciones y aspectos pendientes de evaluación', '');
  const pend = req.requisitos.filter((x) => !x.cumplido);
  for (const r of pend) L.push(`- ${r.descripcion}${r.detalle ? `: ${r.detalle}` : ''}`);
  const instrPend = p.instrumentos.filter((i) => !ctx.evaluaciones.some((e) => e.instrumento_id === i.id && e.estado !== 'pendiente'));
  for (const i of instrPend) L.push(`- Instrumento no realizado: ${i.nombre}${i.obligatorio ? '' : ' (opcional)'}`);
  if (p.estado === 'PROVISIONAL') L.push('- El protocolo utilizado es provisional y no tiene validez clínica.');
  if (!pend.length && !instrPend.length && p.estado !== 'PROVISIONAL') L.push('- Sin aspectos pendientes registrados.');
  L.push('');

  // 10
  L.push('## 10. Revisión y validación profesional', '');
  L.push(validacion ? `Validado por **${validacion.por}** el ${validacion.fecha.slice(0, 10)}.` : 'Pendiente de revisión y validación por el profesional responsable.', '');
  return L.join('\n');
}

/** Conversión mínima Markdown → HTML (encabezados, listas, citas, negrita, cursiva). */
export function markdownAHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_(.+?)_(?=[\s.,;)]|$)/g, '$1<em>$2</em>');
  const out = []; let lista = 0;
  const cerrar = (hasta = 0) => { while (lista > hasta) { out.push('</ul>'); lista--; } };
  for (const linea of md.split('\n')) {
    const m = linea.match(/^(\s*)- (.*)$/);
    if (m) {
      const nivel = Math.floor(m[1].length / 2) + 1;
      while (lista < nivel) { out.push('<ul>'); lista++; }
      cerrar(nivel);
      out.push(`<li>${inline(m[2])}</li>`);
      continue;
    }
    cerrar();
    if (/^### /.test(linea)) out.push(`<h3>${inline(linea.slice(4))}</h3>`);
    else if (/^## /.test(linea)) out.push(`<h2>${inline(linea.slice(3))}</h2>`);
    else if (/^# /.test(linea)) out.push(`<h1>${inline(linea.slice(2))}</h1>`);
    else if (/^> /.test(linea)) out.push(`<blockquote>${inline(linea.slice(2))}</blockquote>`);
    else if (linea.trim()) out.push(`<p>${inline(linea)}</p>`);
  }
  cerrar();
  return out.join('\n');
}

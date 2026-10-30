// Barrera obligatoria antes de mostrar cualquier pregunta (Etapa 9 §C y §L; brief §6).
// Si una regla falla, la pregunta se descarta y el motor prueba la siguiente candidata.
import { normalizar } from './protocolo.js';
import {
  estadoSlot, estadoPregunta, resuelto, preguntadas, slotsIniciales, faseInicialCompleta, ruta, informeCargado,
  evaluarSintoma, estadoBarrido, estadoTamizaje, lista,
} from './motor.js';

const VACIAS = new Set(('a al algo algun alguna como con cual cuando de del desde el ella en es esa ese esta este hay la las le lo los me mi mas o para pero por que se su sus te tu un una uno y ya ha han usted ud sobre respecto ocurre suele').split(' '));
// Raíz aproximada: sin plural ni «-mente», recortada a 5 letras (facilidad ≈ fácilmente).
const raiz = (w) => w.replace(/mente$/, '').replace(/(es|s)$/, '').slice(0, 5);
export function tokens(t) {
  return new Set(normalizar(t).split(' ').filter((w) => w.length > 2 && !VACIAS.has(w)).map(raiz));
}
export function similitud(a, b) {
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let i = 0; for (const x of A) if (B.has(x)) i++;
  return i / (A.size + B.size - i);
}

export function validarPregunta(ctx, cand) {
  const p = ctx.protocolo;
  const reglas = []; const notas = [];
  const add = (regla, ok, detalle) => reglas.push({ regla, ok, detalle });
  const q = cand.pregunta_id ? p.preguntas.get(cand.pregunta_id) : null;
  const fuenteActiva = ctx.fuente || 'apoderado';

  const n = (String(cand.texto).match(/\?/g) || []).length;
  add('una_sola_pregunta', n <= 1, n <= 1 ? 'Una sola dimensión principal.' : `Contiene ${n} preguntas.`);

  if (!q) {
    add('pertenece_al_proyecto', false, 'La pregunta no pertenece al banco del proyecto (Etapa 7 / Anexo 7 / Etapa 9).');
    const umbral = p.parametros.umbral_similitud_textual;
    const hechas = ctx.preguntas.map((x) => ({ x, s: similitud(cand.texto, x.texto) })).sort((a, b) => b.s - a.s);
    if (hechas[0] && hechas[0].s >= umbral) add('no_equivalente', false, `Equivalente funcional a ${hechas[0].x.pregunta_id}, ya utilizada (similitud ${hechas[0].s.toFixed(2)}).`);
    const banco = [...p.preguntas.values()].map((x) => ({ x, s: similitud(cand.texto, x.texto) })).sort((a, b) => b.s - a.s)[0];
    if (banco && banco.s >= umbral && resuelto(estadoPregunta(ctx, banco.x))) add('informacion_ya_resuelta', false, `Busca la información de ${banco.x.id}, que ya está establecida en el expediente.`);
    return { ok: false, reglas, notas };
  }
  const textoOk = normalizar(cand.texto) === normalizar(q.texto);
  add('pertenece_al_proyecto', textoOk, textoOk ? `Pregunta ${q.id} (${q.origen}).` : `El texto difiere del definido para ${q.id}.`);
  add('fuente', q.fuente === fuenteActiva || (q.fuente === 'apoderado' && fuenteActiva === 'apoderado'),
    q.fuente === fuenteActiva ? `Corresponde a la fuente activa (${fuenteActiva}).` : `Pertenece a la fuente ${q.fuente}; la fuente activa es ${fuenteActiva} (Etapa 9 §I).`);

  // Alternativas correctas según el tipo (Etapa 9 §G).
  let altOk = true; let altDet = 'Formato abierto.';
  if (q.tipo === 'presencia') {
    altOk = (q.opciones || []).map((o) => o.valor).join(',') === 'si,no,ocasionalmente,no_sabe';
    altDet = altOk ? 'Presencia/ausencia: SÍ / NO / OCASIONALMENTE / NO SABE-NO RECUERDA.' : 'Faltan las cuatro alternativas obligatorias.';
  } else if (q.tipo === 'opciones' || q.tipo === 'multiple') {
    altOk = (q.opciones || []).length >= 2; altDet = altOk ? 'Alternativas definidas por el proyecto.' : 'Pregunta de selección sin alternativas.';
  } else if (q.opciones?.length) { altOk = false; altDet = 'Una pregunta abierta no debe llevar alternativas.'; }
  add('alternativas', altOk, altDet);

  // Orden de la fase inicial.
  if (q.grupo === 'inicio') {
    const sig = slotsIniciales(ctx).find((s) => !resuelto(estadoSlot(ctx, 'INI', s)));
    add('orden_inicial', sig === q.objetivo[1], sig === q.objetivo[1] ? 'Respeta la secuencia inicial.' : `En la secuencia inicial corresponde «${sig ?? 'ninguno'}».`);
    if (q.condicion) {
      const c = estadoSlot(ctx, ...q.condicion.objetivo);
      const ok = c.estado === 'valor' && c.valor === q.condicion.igual;
      add('condicion', ok, ok ? 'Condición previa cumplida.' : 'La condición previa no se cumple.');
    }
  } else if (q.fuente === 'apoderado') {
    const ok = faseInicialCompleta(ctx);
    add('orden_inicial', ok, ok ? 'Fase inicial completa.' : 'Antes deben registrarse motivo, edad e informe escolar.');
  }

  // Información ya resuelta (aunque la pregunta literal nunca se haya formulado) — Etapa 9 §J.4-A.
  const st = estadoPregunta(ctx, q);
  add('informacion_no_resuelta', !resuelto(st), resuelto(st) ? `La información ya está establecida (${st.estado}${st.via ? `, vía ${st.via}` : ''}; fuentes: ${st.fuentes.join(', ') || '—'}).` : 'La información buscada no está en el expediente.');
  add('no_utilizada', !preguntadas(ctx, q.id), preguntadas(ctx, q.id) ? `${q.id} ya fue utilizada (Etapa 9 §B).` : 'No utilizada antes.');

  // Equivalencias funcionales.
  const g = p.grupoDe.get(q.id);
  if (g) {
    const otra = g.preguntas.filter((id) => id !== q.id).find((id) => {
      if (id.startsWith('TAM:')) { const t = estadoTamizaje(ctx); return t.estado !== 'NO_REALIZADO'; }
      if (id.startsWith('BAR:')) { const b = estadoBarrido(ctx); return b.estado !== 'NO_REALIZADO'; }
      return preguntadas(ctx, id) || resuelto(estadoPregunta(ctx, p.preguntas.get(id)));
    });
    add('no_equivalente', !otra, otra ? `Funcionalmente equivalente a ${otra} (${g.descripcion}).` : 'Sin equivalentes utilizados.');
  }

  // Síntomas: presencia ya establecida y máximo de 3 preguntas de profundización (Etapa 9 §14).
  if (q.sintoma) {
    const s = p.sintomasPorId.get(q.sintoma);
    const e = evaluarSintoma(ctx, s);
    if (q.grupo === 'sintoma') {
      const ok = !e.presenciaEstablecida && e.porFuente.apoderado !== 'si';
      add('sintoma_no_establecido', ok, ok ? 'La presencia del síntoma aún no está establecida.' : `La presencia de ${s.id} ya está establecida; no se reformula.`);
    } else {
      const max = p.parametros.max_profundizacion_sintoma;
      add('maximo_profundizacion', e.profundizacion < max, e.profundizacion < max ? `${e.profundizacion}/${max} preguntas de profundización en ${s.id}.` : `Se alcanzó el máximo de ${max} preguntas para ${s.id}; queda abierto/insuficiente sin confirmarse por defecto.`);
      // Se profundiza con el apoderado solo lo que él mismo informa (Etapa 7 §17: fuentes diferenciadas).
      const ap = e.porFuente.apoderado;
      const necesaria = ap === 'si' || ap === 'parcial' || (ap === 'ocasionalmente' && q.dimension === 'frecuencia');
      add('necesaria', necesaria, necesaria ? (ap === 'ocasionalmente' ? 'Respuesta «Ocasionalmente»: se cuantifica la frecuencia (Etapa 9 §6.2).' : 'El apoderado informa la conducta y requiere caracterización.') : 'Solo se profundiza con el apoderado una conducta que él mismo informa; lo descrito por otra fuente se conserva con esa fuente.');
    }
  }

  // Ruta escolar (Etapa 7 §5).
  if (q.grupo === 'ruta_a') {
    const r = ruta(ctx);
    const ok = r === 'completa' || (r === 'con_informe' && informeCargado(ctx));
    add('ruta_informe_escolar', ok, ok ? `Compatible con la ruta ${r === 'completa' ? 'A' : 'B (vacío del informe)'}.` : 'Ruta B: la información escolar se obtiene primero del informe.');
  }

  // Ramas del barrido y del tamizaje: solo categorías seleccionadas (Etapa 9 §H).
  if (q.grupo === 'rama_barrido') {
    const b = estadoBarrido(ctx);
    const ok = b.areas.includes(q.area);
    add('rama_abierta', ok, ok ? `Área «${q.area}» seleccionada en el barrido.` : 'El área no fue seleccionada en el barrido diferencial.');
  }
  if (q.grupo === 'rama_tamizaje') {
    const t = estadoTamizaje(ctx);
    const ok = t.categorias.includes(q.categoria);
    add('rama_abierta', ok, ok ? `Categoría «${q.categoria}» seleccionada.` : 'La categoría no fue seleccionada en el tamizaje.');
  }
  if (q.grupo === 'tamizaje') {
    const b = estadoBarrido(ctx);
    const ok = b.estado === 'COMPLETADO';
    add('orden_barrido_tamizaje', ok, ok ? 'Barrido diferencial completado (Etapa 9 §J.5).' : 'El tamizaje se aplica después del barrido diferencial general.');
  }
  if (q.bloque) {
    const b = p.bloques.find((x) => x.id === q.bloque);
    const hechas = b.preguntas.filter((id) => preguntadas(ctx, id)).length;
    add('minima_suficiente', hechas < b.max, hechas < b.max ? `${hechas}/${b.max} preguntas del bloque «${b.id}».` : `El bloque «${b.id}» alcanzó su máximo; la línea se cierra.`);
  }

  // Exclusividad de alternativas declaradas.
  if (q.tipo === 'multiple') {
    const exc = (q.opciones || []).filter((o) => o.excluyente).map((o) => o.codigo);
    add('opcion_excluyente', exc.length > 0 || q.alternativas === 'contextos', exc.length ? `Opciones excluyentes: ${exc.join(', ')}.` : 'Selección múltiple.');
  }
  return { ok: reglas.every((r) => r.ok), reglas, notas };
}

export { lista };

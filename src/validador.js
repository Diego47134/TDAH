// Validador previo a presentar cualquier pregunta (requisito §6 del brief).
// Si una regla falla, la pregunta se bloquea y el motor busca otra alternativa autorizada.
import { normalizar } from './protocolo.js';
import {
  estadoSlot, preguntasDe, slotTerminal, faseInicialCompleta, slotsIniciales, ruta,
  dimensionAplica, ESTADOS_INCIERTOS,
} from './motor.js';

const VACIAS = new Set(('a al algo algun alguna como con cual cuando de del desde el ella en es esa ese esta este hay la las le lo los me mi mas o para pero por que se su sus te tu un una uno y ya ha han usted ud sobre respecto ocurre suele').split(' '));

export function tokens(t) {
  return new Set(normalizar(t).split(' ').filter((w) => w.length > 2 && !VACIAS.has(w)).map((w) => w.replace(/(es|s)$/, '')));
}

export function similitud(a, b) {
  const A = tokens(a); const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * @param ctx contexto del expediente
 * @param cand {pregunta_id?, texto, origen}
 * @returns {{ok:boolean, reglas:Array<{regla,ok,detalle}>, notas:string[]}}
 */
export function validarPregunta(ctx, cand) {
  const p = ctx.protocolo;
  const reglas = [];
  const notas = [];
  const add = (regla, ok, detalle) => reglas.push({ regla, ok, detalle });
  const q = cand.pregunta_id ? p.preguntasPorId.get(cand.pregunta_id) : null;

  // 1. Una sola pregunta por turno.
  const nInterrog = (String(cand.texto).match(/\?/g) || []).length;
  add('una_sola_pregunta', nInterrog <= 1, nInterrog <= 1 ? 'Contiene una sola pregunta.' : `Contiene ${nInterrog} preguntas.`);

  // 2. Autorizada por el banco (Etapa 7) y seleccionada por el motor (Etapa 9).
  if (!q) {
    add('autorizada', false, 'La pregunta no pertenece al banco autorizado del protocolo.');
    // Aun así se informa si es funcionalmente equivalente a algo ya preguntado.
    const umbral = p.limites.umbral_similitud_textual;
    const parecida = ctx.preguntas.map((x) => ({ x, s: similitud(cand.texto, x.texto) })).sort((a, b) => b.s - a.s)[0];
    if (parecida && parecida.s >= umbral) {
      add('no_equivalente', false, `Equivalente funcional a ${parecida.x.pregunta_id} ya formulada (similitud ${parecida.s.toFixed(2)}).`);
    }
    for (const g of p.grupos_equivalencia || []) {
      const ref = g.preguntas.map((id) => p.preguntasPorId.get(id));
      const s = Math.max(...ref.map((r) => similitud(cand.texto, r.texto)));
      if (s >= umbral && g.preguntas.some((id) => ctx.preguntas.some((x) => x.pregunta_id === id))) {
        add('no_equivalente', false, `Pertenece al grupo de equivalencia ${g.id} («${g.descripcion}»), ya explorado.`);
      }
    }
    return { ok: false, reglas, notas };
  }
  const textoOk = normalizar(cand.texto) === normalizar(q.texto);
  add('autorizada', textoOk, textoOk ? `Pregunta ${q.id} del banco autorizado.` : `El texto difiere del autorizado para ${q.id}.`);

  // 3. Orden obligatorio de la fase inicial.
  const iniCompleta = faseInicialCompleta(ctx);
  if (q.fase === 'inicial') {
    const sig = slotsIniciales(ctx).find((s) => !slotTerminal(ctx, 'INI', s));
    add('orden_inicial', sig === q.slot, sig === q.slot ? 'Respeta la secuencia inicial.' : `En la secuencia inicial corresponde «${sig ?? 'ninguno'}», no «${q.slot}».`);
    if (q.condicion) {
      const c = estadoSlot(ctx, 'INI', q.condicion.slot);
      const cumple = c.estado === 'valor' && c.valor === q.condicion.igual;
      add('condicion', cumple, cumple ? 'Condición previa cumplida.' : `Requiere ${q.condicion.slot} = ${q.condicion.igual}.`);
    }
  } else {
    add('orden_inicial', iniCompleta, iniCompleta ? 'Fase inicial completa.' : 'No se pueden explorar dimensiones antes de completar motivo, edad, informe escolar y ruta.');
  }

  const dimId = q.dimension_id;
  const d = dimId === 'INI' ? null : p.dimensionesPorId.get(dimId);

  // 4. Ruta y edad.
  if (d) {
    const r = ruta(ctx);
    const aplica = dimensionAplica(ctx, d);
    add('aplicable_edad', aplica, aplica ? 'Aplicable a la edad registrada.' : 'Dimensión fuera del rango de edad.');
    if (d.ambito === 'escolar' && r === 'con_informe') {
      const hay = ctx.informesEscolares.length > 0;
      add('ruta_informe_escolar', hay, hay ? 'Dimensión escolar: el informe ya fue cargado y no resolvió este dato.' : 'Ruta con informe escolar: esta dimensión se espera del informe, no se pregunta en el hogar.');
    } else {
      add('ruta_informe_escolar', true, `Compatible con la ruta «${r}».`);
    }
  }

  // 5. Necesaria: el dato no está resuelto en el expediente (de ninguna fuente).
  const st = estadoSlot(ctx, dimId, q.slot);
  if (st.estado === 'valor' || st.estado === 'contradiccion') {
    add('no_en_expediente', false, `El dato ya está en el expediente (${st.estado}; fuentes: ${st.fuentes.join(', ')}).`);
  } else {
    add('no_en_expediente', true, st.estado === 'sin_dato' ? 'Dato ausente del expediente.' : `Dato en estado «${st.estado}».`);
  }
  if (d && q.slot !== 'presencia') {
    const pres = estadoSlot(ctx, dimId, 'presencia');
    const ok = pres.estado === 'valor' && pres.valor === 'si';
    add('necesaria', ok, ok ? 'La conducta está presente y este dato es esencial para caracterizarla.' : 'Solo se caracteriza una conducta cuya presencia está establecida.');
  } else {
    const term = slotTerminal(ctx, dimId, q.slot);
    add('necesaria', !term, term ? 'El dato ya no requiere más preguntas.' : 'Resuelve un dato pendiente.');
  }

  // 6. No repetida ni funcionalmente equivalente a una ya formulada.
  const repetida = ctx.preguntas.some((x) => x.pregunta_id === q.id);
  add('no_repetida', !repetida, repetida ? `${q.id} ya fue formulada.` : 'No formulada antes.');
  const grupo = p.grupoDePregunta.get(q.id);
  if (grupo) {
    const previa = ctx.preguntas.find((x) => grupo.preguntas.includes(x.pregunta_id) && x.pregunta_id !== q.id);
    add('no_equivalente', !previa, previa ? `Equivalente funcional a ${previa.pregunta_id} (grupo ${grupo.id}: «${grupo.descripcion}»).` : 'Sin equivalentes formuladas.');
  } else {
    add('no_equivalente', true, 'Sin grupo de equivalencia.');
  }

  // 7. Especificidad creciente dentro de un mismo dato.
  const previas = preguntasDe(ctx, dimId, q.slot);
  if (previas.length) {
    const max = Math.max(...previas.map((x) => x.especificidad));
    add('mas_especifica', q.especificidad > max, q.especificidad > max ? 'Más específica que las anteriores para este dato.' : 'Ya se formuló una pregunta igual o más específica para este dato.');
  }

  // 8. Tratamiento de la incertidumbre.
  const incierto = ESTADOS_INCIERTOS.includes(st.estado);
  if (q.tras_incertidumbre) {
    add('incertidumbre', incierto, incierto ? 'Pregunta alternativa autorizada tras «no sé/no recuerdo».' : 'Solo procede después de una respuesta «no sé/no recuerdo».');
  } else if (incierto) {
    add('incertidumbre', false, 'Tras «no sé/no recuerdo» no se repite la pregunta; solo se admite una alternativa con ejemplo concreto.');
  }

  // 9. Límite por dimensión: control de redundancia, no cuota.
  if (d) {
    const n = preguntasDe(ctx, dimId).length;
    const { max_preguntas_por_dimension: lim, tope_absoluto_por_dimension: tope } = p.limites;
    if (n >= tope) add('limite', false, `Se alcanzó el tope absoluto de ${tope} preguntas en la dimensión.`);
    else if (n >= lim) {
      const esencial = q.slot === 'presencia' || d.esenciales.includes(q.slot);
      add('limite', esencial, esencial ? `Excede el límite orientativo (${lim}) justificadamente: dato esencial pendiente.` : 'Excede el límite y el dato no es esencial.');
      if (esencial) notas.push(`[límite ${n}/${lim} superado por dato esencial]`);
    } else add('limite', true, `${n}/${lim} preguntas en la dimensión.`);
  }

  return { ok: reglas.every((r) => r.ok), reglas, notas };
}

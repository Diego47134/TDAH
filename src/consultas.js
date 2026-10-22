// Preguntas del profesional y del apoderado. La app responde primero con su propio contenido
// (protocolo y glosario); si no encuentra una respuesta, busca sola en internet (Europe PMC) y
// muestra párrafos TEXTUALES de las fuentes, con su cita. No redacta respuestas propias.
// Privacidad: a internet solo se envían términos clínicos reconocidos por el glosario de traducción,
// nunca el texto libre escrito por el usuario.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizar } from './protocolo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLOSARIO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'protocol', 'datos', 'glosario.json'), 'utf8')).entradas;

export const PUBLICOS = ['profesional', 'apoderado'];
const VACIAS = new Set(('a al algo alguna alguno como con cual cuales cuando de del el ella ella ellos en es esa ese esta este esto estos hay la las le les lo los me mi mis mas o para pero por porque que se si sin su sus te tu un una uno unos y ya ha han usted ud sobre puede pueden debo deberia tiene tienen hijo hija mi nino nina esta son ser hace hacer cuanto cuanta cuantos qué cómo').split(' '));
const raiz = (w) => w.replace(/mente$/, '').replace(/(es|s)$/, '').slice(0, 5);
const palabras = (t) => normalizar(t).split(' ').filter((w) => w.length > 2 && !VACIAS.has(w));

// Términos clínicos en español → término de búsqueda en inglés (solo estos salen a internet).
const TRADUCCION = Object.entries({
  inatencion: 'inattention', atencion: 'attention', distraccion: 'distractibility', distrae: 'distractibility', concentracion: 'concentration', concentrarse: 'concentration',
  hiperactividad: 'hyperactivity', hiperactivo: 'hyperactivity', impulsividad: 'impulsivity', impulsivo: 'impulsivity',
  sueno: 'sleep', dormir: 'sleep', insomnio: 'insomnia', ronquido: 'snoring', ansiedad: 'anxiety', depresion: 'depression', animo: 'mood',
  aprendizaje: 'learning disorder', dislexia: 'dyslexia', lenguaje: 'language disorder', autismo: 'autism', vision: 'vision', audicion: 'hearing', oido: 'hearing',
  epilepsia: 'epilepsy', ausencias: 'absence seizures', medicamento: 'medication', medicacion: 'medication', farmaco: 'pharmacological', metilfenidato: 'methylphenidate',
  tratamiento: 'treatment', terapia: 'therapy', conductual: 'behavioral', padres: 'parents', familia: 'family', profesor: 'teacher', docente: 'teacher', colegio: 'school', escuela: 'school',
  rendimiento: 'academic performance', notas: 'academic performance', adolescente: 'adolescents', adolescencia: 'adolescents', infancia: 'children', preescolar: 'preschool', adulto: 'adults',
  inicio: 'age of onset', diagnostico: 'diagnosis', diagnosticar: 'diagnosis', criterio: 'diagnostic criteria', dsm: 'DSM-5', entrevista: 'diagnostic interview',
  escala: 'rating scale', cuestionario: 'questionnaire', prevalencia: 'prevalence', genetica: 'genetics', hereditario: 'heritability', prematuro: 'preterm birth', embarazo: 'pregnancy',
  pantalla: 'screen time', dieta: 'diet', alimentacion: 'diet', ejercicio: 'physical activity', deporte: 'physical activity', ejecutiva: 'executive function', memoria: 'working memory',
  organizacion: 'organizational skills', emocional: 'emotional dysregulation', emociones: 'emotional dysregulation', oposicionista: 'oppositional defiant disorder', tics: 'tic disorder',
  sintoma: 'symptoms', comorbilidad: 'comorbidity', diferencial: 'differential diagnosis', pronostico: 'outcomes', evolucion: 'long-term outcomes', ninas: 'girls', mujeres: 'girls',
  melatonina: 'melatonin', atomoxetina: 'atomoxetine', guanfacina: 'guanfacine', clonidina: 'clonidine', lisdexanfetamina: 'lisdexamfetamine', anfetamina: 'amphetamine',
  omega: 'omega-3', neurofeedback: 'neurofeedback', mindfulness: 'mindfulness', psicoeducacion: 'psychoeducation', parental: 'parent training', crianza: 'parenting',
  bullying: 'bullying', acoso: 'bullying', trauma: 'trauma', maltrato: 'maltreatment', duelo: 'bereavement', divorcio: 'parental divorce', tiroides: 'thyroid', anemia: 'iron deficiency',
  hierro: 'iron deficiency', plomo: 'lead exposure', alcohol: 'prenatal alcohol', tabaco: 'prenatal smoking', apnea: 'sleep apnea', duerme: 'sleep', duermen: 'sleep', cansancio: 'fatigue',
  rabietas: 'temper outbursts', agresividad: 'aggression', irritabilidad: 'irritability', autoestima: 'self-esteem', habilidades: 'social skills', amigos: 'peer relationships', pares: 'peer relationships',
  lectura: 'reading', matematica: 'mathematics', escritura: 'writing', motricidad: 'motor coordination', coordinacion: 'motor coordination', videojuegos: 'video games', azucar: 'sugar',
  presentacion: 'presentation', combinado: 'combined presentation', inatento: 'inattentive presentation', subtipo: 'subtypes', estimulante: 'stimulant', cafeina: 'caffeine',
}).map(([es, en]) => ({ r: raiz(es), es, en }));

function terminosClinicos(texto) {
  const vistos = new Map();
  for (const w of palabras(texto)) {
    const t = TRADUCCION.find((x) => x.r === raiz(w));
    if (t && !vistos.has(t.en)) vistos.set(t.en, t.es);
  }
  return [...vistos.entries()].map(([en, es]) => ({ en, es }));
}

/** Base local: glosario + contenido del protocolo vigente. */
export function construirBase(P) {
  const base = GLOSARIO.map((g) => ({ ...g, fuente: 'Glosario de la aplicación' }));
  for (const s of P.sintomas) {
    base.push({ id: `S-${s.id}`, publico: PUBLICOS, titulo: `Síntoma ${s.id}: ${s.nombre}`, terminos: [normalizar(s.nombre), ...s.palabras_clave],
      texto: `Es uno de los ${P.sintomas.length} síntomas del DSM-5-TR que se evalúan (${s.dominio === 'inatencion' ? 'inatención' : 'hiperactividad/impulsividad'}). En la entrevista se explora como «${s.conducta}». Si está presente, se pregunta con qué frecuencia ocurre, desde cuándo y en qué lugares.`,
      fuente: `Protocolo del proyecto (${s.origen})`, sintoma: s.id });
  }
  for (const a of P.areas) {
    const esp = Object.entries(a.esperable_por_etapa || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
    base.push({ id: `A-${a.id}`, publico: ['profesional'], titulo: `Área funcional: ${a.nombre}`, terminos: [normalizar(a.nombre), a.id],
      texto: `${esp ? `Lo esperable por edad (Etapa 2) — ${esp}.` : ''}${a.sistemas ? ` Sistemas implicados: ${a.sistemas}` : ''}${a.respaldo ? ` Nivel de respaldo: ${a.respaldo}.` : ''}`.trim(), fuente: 'Protocolo del proyecto (Etapa 2 y Etapa 9 §19)' });
  }
  for (const s of P.sugerencias || []) {
    base.push({ id: `SUG-${s.id}`, publico: ['profesional'], titulo: `Sugerencia basada en evidencia: ${s.id.replace(/_/g, ' ')}`, terminos: [s.id.replace(/_/g, ' '), ...(s.areas || [])],
      texto: `${s.texto}${(s.refs || []).length ? ` Referencias: ${(s.refs || []).map((r) => `[${r}] ${P.referencias[r] || ''}`).join(' ')}` : ''}`, fuente: `Protocolo del proyecto (${s.origen})` });
  }
  return base.map((e) => ({ ...e, _frases: (e.terminos || []).map(normalizar).filter(Boolean), _raices: new Set(palabras(`${e.titulo} ${e.texto} ${(e.terminos || []).join(' ')}`).map(raiz)) }));
}

function buscarLocal(base, pregunta, quien) {
  const n = ` ${normalizar(pregunta)} `;
  const rs = palabras(pregunta).map(raiz);
  const puntajes = base.filter((e) => e.publico.includes(quien)).map((e) => {
    const frases = e._frases.filter((f) => f.length > 2 && n.includes(` ${f} `)).length;
    const comunes = rs.filter((r) => e._raices.has(r)).length;
    return { e, puntaje: frases * 3 + comunes, frases, comunes };
  }).filter((x) => x.frases >= 1 || x.comunes >= 2).sort((a, b) => b.puntaje - a.puntaje);
  if (!puntajes.length || puntajes[0].puntaje < 3) return [];
  const tope = puntajes[0].puntaje;
  return puntajes.filter((x) => x.puntaje >= Math.max(3, tope * 0.75)).slice(0, 2).map((x) => x.e);
}

/** Pregunta de la entrevista → entrada local que la explica (para «¿qué significa esta pregunta?»). */
function explicarPregunta(base, P, preguntaId) {
  const q = P.preguntas.get(preguntaId);
  if (!q) return [];
  if (q.sintoma) return base.filter((e) => e.sintoma === q.sintoma || (q.dimension === 'desde' && e.id === 'G-EDAD12') || (q.dimension === 'contextos' && e.id === 'G-CONTEXTOS')).slice(0, 2);
  const porGrupo = { barrido: 'G-BARRIDO', rama_barrido: 'G-SUENO', tamizaje: 'G-SUENO', rama_tamizaje: 'G-SUENO', ruta_a: 'G-INFORME-ESCOLAR', inicio: 'G-INFORME-ESCOLAR' };
  const id = q.objetivo?.[1] === 'motivo' || q.objetivo?.[1] === 'edad' ? null : porGrupo[q.grupo];
  return id ? base.filter((e) => e.id === id) : [];
}

const NO_WEB = 'necesita necesitan anos meses semanas tiene tienen recomienda recomendable conviene sirve bueno buena mejor deberia podria seria hoy ayer manana'.split(' ');

/** Hasta dos oraciones iniciales del resumen (MedlinePlus ordena por relevancia). */
function primerasOraciones(r) {
  if (!r?.resumen) return [];
  const cita = r.resumen.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).slice(0, 2).join(' ').trim();
  return cita.length >= 40 ? [{ cita: cita.slice(0, 700), articulo: { id: r.id, titulo: r.titulo, autores: r.autores, revista: r.revista, anio: r.anio, url: r.url, doi: null, pmid: null } }] : [];
}

/**
 * Palabras que se pueden enviar a un buscador web: sin palabras vacías, sin nombres del caso, sin
 * números (edades, RUT, teléfonos) ni correos. Máximo 6.
 */
export function palabrasParaWeb(texto, excluir = []) {
  const fuera = new Set(excluir.flatMap((n) => normalizar(String(n)).split(' ')).filter(Boolean));
  // Palabras con mayúscula inicial que no empiezan la oración: probablemente nombres propios.
  // (también al inicio: se prefiere omitir una palabra útil antes que enviar un nombre).
  for (const m of String(texto).matchAll(/\p{Lu}[\p{L}'-]+/gu)) for (const w of normalizar(m[0]).split(' ')) fuera.add(w);
  for (const w of NO_WEB) fuera.add(w);
  const limpio = String(texto).replace(/[^\s@]+@[^\s@]+/g, ' ');
  const out = [];
  for (const w of palabras(limpio)) {
    if (/\d/.test(w) || fuera.has(w) || out.includes(w) || w.length < 4) continue;
    out.push(w);
    if (out.length >= 6) break;
  }
  return out;
}

const GENERICA = /(que significa|no entiendo|no comprendo|a que se refiere|que quiere decir|explique|explicar|no se que responder)/;

/** Oraciones de los resúmenes que mejor responden, textuales y con su cita. */
function extraerCitas(resultados, terminos, max = 3) {
  const claves = terminos.flatMap((t) => [t.en.toLowerCase(), t.es]).map((s) => normalizar(s)).filter(Boolean);
  const cand = [];
  for (const r of resultados) {
    if (!r.resumen) continue;
    const oraciones = r.resumen.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map((s) => s.trim()).filter((s) => s.length >= 50 && s.length <= 600);
    for (const o of oraciones) {
      const no = ` ${normalizar(o)} `;
      const hits = claves.filter((k) => no.includes(` ${k}`)).length;
      if (!hits) continue;
      const conclusion = /^(conclusi|in conclusion|these (results|findings)|our (results|findings)|results)/i.test(o) ? 0.5 : 0;
      cand.push({ puntaje: hits + conclusion + (/\badhd\b|\btdah\b/i.test(o) ? 0.5 : 0), cita: o, articulo: r });
    }
  }
  cand.sort((a, b) => b.puntaje - a.puntaje);
  const out = []; const usados = new Map();
  for (const c of cand) {
    if ((usados.get(c.articulo.id) || 0) >= 1) continue;
    usados.set(c.articulo.id, 1);
    out.push({ cita: c.cita, articulo: { id: c.articulo.id, titulo: c.articulo.titulo, autores: c.articulo.autores, revista: c.articulo.revista, anio: c.articulo.anio, url: c.articulo.url, doi: c.articulo.doi, pmid: c.articulo.pmid } });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * @param buscarInternet async ({consulta, fuente, cantidad}) → {resultados, total}
 */
export function crearConsultas(P, { buscarInternet }) {
  const base = construirBase(P);

  /** Prueba las fuentes en orden hasta encontrar fragmentos que respondan; devuelve la respuesta. */
  async function buscarEnFuentes(planes, { quien, manual = false }) {
    let errorRed = null; const enviados = [];
    for (const plan of planes) {
      for (const consulta of plan.consultas) {
        let r;
        try { r = await buscarInternet({ consulta, fuente: plan.fuente, cantidad: plan.fuente === 'medlineplus' ? 5 : 15 }); } catch (e) { errorRed = e; break; }
        enviados.push(consulta);
        if (!r.resultados.some((x) => x.resumen)) continue;
        let citas = extraerCitas(r.resultados, plan.sel);
        if (!citas.length && plan.fuente === 'medlineplus') citas = primerasOraciones(r.resultados[0]);
        if (!citas.length) continue;
        const esMedline = plan.fuente === 'medlineplus';
        return { origen: 'internet', consulta_enviada: consulta, terminos_enviados: manual ? plan.sel.map((t) => t.es) : plan.sel.map((t) => (quien === 'apoderado' || esMedline ? t.es : t.en)),
          fuente: esMedline ? 'MedlinePlus.gov' : 'Europe PMC', fuente_id: plan.fuente, busqueda_manual: manual, respuestas: citas,
          aviso: esMedline
            ? 'Información general de MedlinePlus.gov (Biblioteca Nacional de Medicina de EE.UU.), encontrada automáticamente. No reemplaza la opinión del profesional.'
            : 'Fragmentos textuales de publicaciones científicas encontradas automáticamente. No son una respuesta de la app ni reemplazan la opinión del profesional.' };
      }
    }
    const terminosEnviados = planes[0].sel.map((t) => (quien === 'apoderado' || manual ? t.es : t.en));
    if (errorRed && !enviados.length) return { origen: 'sin_respuesta', respuestas: [], terminos_enviados: terminosEnviados, aviso: `No fue posible buscar en internet: ${errorRed.message}` };
    return { origen: 'sin_respuesta', respuestas: [], terminos_enviados: terminosEnviados,
      aviso: quien === 'apoderado' ? 'No encontramos una respuesta. Su pregunta quedó registrada para que el profesional la responda.' : 'La búsqueda en internet no encontró párrafos que respondan la pregunta.' };
  }

  return {
    base,
    async responder({ pregunta, quien = 'profesional', pregunta_id, buscar_en_web = false, palabras, excluir = [] } = {}) {
      const texto = String(pregunta ?? '').replace(/\s+/g, ' ').trim();
      if (texto.length < 3) throw Object.assign(new Error('Escriba su pregunta.'), { status: 400 });
      if (texto.length > 300) throw Object.assign(new Error('La pregunta es demasiado larga (máximo 300 caracteres).'), { status: 400 });
      if (!PUBLICOS.includes(quien)) throw Object.assign(new Error('Destinatario no válido.'), { status: 400 });

      // 1. Contenido propio de la app.
      const generica = pregunta_id && (GENERICA.test(normalizar(texto)) || palabras(texto).length <= 1);
      let locales = generica ? explicarPregunta(base, P, pregunta_id) : [];
      if (!locales.length) {
        // Solo vale la respuesta propia si cubre todos los conceptos clínicos de la pregunta
        // (p. ej. «melatonina» no está en el glosario → se busca en internet).
        const conceptos = terminosClinicos(texto).map((t) => raiz(t.es));
        locales = buscarLocal(base, texto, quien).filter((e) => conceptos.every((r) => e._raices.has(r)));
      }
      if (locales.length) {
        return { origen: 'app', respuestas: locales.map((e) => ({ titulo: e.titulo, texto: e.texto, fuente: e.fuente })), terminos_enviados: [] };
      }

      // 2. Búsqueda automática en internet (solo términos clínicos reconocidos).
      const terminos = terminosClinicos(texto);
      const sinRespuesta = (aviso, extra = {}) => ({ origen: 'sin_respuesta', respuestas: [], terminos_enviados: [], aviso, ...extra });
      const avisoApoderado = 'No encontramos una respuesta. Su pregunta quedó registrada para que el profesional la responda.';
      if (!terminos.length) {
        if (quien === 'apoderado') return sinRespuesta(avisoApoderado);
        // Profesional: la app propone palabras para buscar en la web y SOLO busca si el profesional
        // las confirma (puede quitar las que no quiera enviar). Nunca salen nombres, números ni RUT.
        const propuesta = palabrasParaWeb(texto, excluir);
        if (!propuesta.length) return sinRespuesta('No hay palabras que se puedan buscar en internet sin exponer datos. Reformule con términos generales.');
        if (!buscar_en_web) {
          return sinRespuesta('La app no tiene una respuesta propia y no reconoció términos clínicos. Puede buscar en internet con las palabras propuestas.',
            { propuesta_busqueda: { palabras: propuesta, fuentes: ['MedlinePlus en español', 'Europe PMC'] } });
        }
        const elegidas = (Array.isArray(palabras) ? palabras : propuesta).map((w) => normalizar(String(w))).filter((w) => propuesta.includes(w));
        if (!elegidas.length) throw Object.assign(new Error('Seleccione al menos una de las palabras propuestas.'), { status: 400 });
        const sel = elegidas.map((w) => ({ en: w, es: w }));
        return buscarEnFuentes([
          { fuente: 'medlineplus', consultas: [elegidas.join(' '), ...(elegidas.length > 1 ? [elegidas.slice(0, 2).join(' ')] : [])], sel },
          { fuente: 'europepmc', consultas: [`TDAH ${elegidas.join(' ')} LANG:"spa"`], sel },
        ], { quien, manual: true });
      }
      const intentos = [];
      for (let k = Math.min(terminos.length, 3); k >= 1; k--) {
        const sel = terminos.slice(0, k);
        intentos.push(quien === 'apoderado'
          ? `TDAH ${sel.map((t) => t.es).join(' ')} LANG:"spa"`
          : `ADHD ${sel.map((t) => (t.en.includes(' ') ? `"${t.en}"` : t.en)).join(' ')}`);
      }
      const medline = { fuente: 'medlineplus', consultas: [...new Set([terminos.slice(0, 2).map((t) => t.es).join(' '), terminos[0].es])], sel: terminos.slice(0, 3) };
      const pmc = { fuente: 'europepmc', consultas: intentos, sel: terminos.slice(0, 3) };
      // El apoderado recibe primero información en español para público general; el profesional, literatura científica.
      return buscarEnFuentes(quien === 'apoderado' ? [medline, pmc] : [pmc, medline], { quien });
    },
  };
}

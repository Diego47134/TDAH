// Lectura del «Informe interpretativo» de Nesplora Aula (Giunti Nesplora) sin inteligencia artificial.
//
// Se extrae solo lo que el informe dice: datos de la persona evaluada, fecha y validez de la
// aplicación (EVI), los índices generales con su puntuación directa (PD), percentil (PC), puntuación
// T y la interpretación que el propio instrumento asigna, y las tablas por condición (con y sin
// distractores, por tarea y por canal sensorial). No se agregan normas ni categorías propias.
//
// Antes de integrar los resultados al caso se verifica que el informe corresponda a la misma persona
// (Protocolo de integración §5.1 y prueba de aceptación 21): si hay una discrepancia de identidad o
// no se puede verificar, los resultados quedan «pendientes de vinculación» hasta que el profesional
// la confirme.

const ESPACIOS = /\s+/g;

/** Índices de Nesplora Aula → variable de realidad virtual del proyecto (src/rv.js). */
const INDICES = [
  { re: /\bomisiones/i, id: 'omisiones', nombre: 'Atención: omisiones totales', mide: 'Errores por omisión: medida de inatención selectiva y enfocada.' },
  { re: /comisiones/i, id: 'comisiones', nombre: 'Control inhibitorio: comisiones totales', mide: 'Errores por comisión: medida de falta de inhibición de la respuesta o descontrol motor.' },
  { re: /desviaci[oó]n/i, id: 'variabilidad_tr', nombre: 'Vigilancia: variabilidad del tiempo de reacción (σ)', mide: 'Variabilidad o inconsistencia de la respuesta; puede reflejar decremento de la vigilancia.' },
  { re: /media\s*t\s*r/i, id: 'tiempo_reaccion', nombre: 'Procesamiento: tiempo de reacción medio (aciertos)', mide: 'Velocidad de procesamiento y consistencia de la respuesta.' },
  { re: /actividad motora/i, id: 'actividad_motora', nombre: 'Actividad motora total', mide: 'Movimientos de la cabeza medidos por el sensor de las gafas durante la tarea.' },
];

/** Interpretación del propio instrumento según la puntuación T (descrita en el informe, §1.1). */
export function rendimientoPorT(t) {
  if (t == null || !Number.isFinite(t)) return null;
  if (t <= 30) return 'muy alto';
  if (t <= 40) return 'alto';
  if (t <= 60) return 'normal';
  if (t <= 70) return 'bajo';
  return 'muy bajo';
}
export const sentidoDeRendimiento = (r) => (/bajo/.test(r || '') ? 'dificultad' : /alto/.test(r || '') ? 'fortaleza' : r === 'normal' ? 'esperado' : 'sin_interpretacion');

export function esNesplora(texto) {
  const t = String(texto || '');
  return /nesplora/i.test(t) && /(omisiones|comisiones)/i.test(t);
}

const fechaISO = (dmy) => { const m = String(dmy || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const num = (s) => (s == null ? null : Number(String(s).replace(',', '.')));

function filasDeTabla(lineas, inicio, etiquetas) {
  const filas = [];
  let i = inicio;
  const reFila = new RegExp(`^(${etiquetas})\\s+([\\d.,]+)\\s+([\\d.,]+)(?:\\s+([\\d.,]+)\\s+([\\d.,]+))?$`, 'i');
  for (; i < lineas.length && i < inicio + 40; i++) {
    const m = lineas[i].match(reFila);
    if (m) filas.push({ etiqueta: m[1], v: [m[2], m[3], m[4], m[5]].filter((x) => x != null).map(num) });
    else if (filas.length) break;
  }
  // Las puntuaciones T vienen después, una línea por fila («73 57» o «59»).
  const ts = [];
  for (; i < lineas.length && ts.length < filas.length; i++) {
    const m = lineas[i].match(/^(\d{2,3})(?:\s+(\d{2,3}))?$/);
    if (m) ts.push([num(m[1]), num(m[2])]);
    else if (ts.length) break;
  }
  return filas.map((f, k) => ({ ...f, t: ts[k] || [] }));
}

function tablaCondiciones(lineas, marcador, nombres) {
  const i = lineas.findIndex((l) => marcador.test(l.replace(ESPACIOS, '')));
  if (i < 0) return null;
  const filas = filasDeTabla(lineas, i + 1, 'Omisiones Totales|Comisiones totales|Media TR-Aciertos|\\(σ\\) Desviación típica TR-Aciertos total|Actividad motora total');
  if (!filas.length) return null;
  const out = { [nombres[0]]: {}, [nombres[1]]: {} };
  for (const f of filas) {
    const def = INDICES.find((x) => x.re.test(f.etiqueta));
    if (!def) continue;
    out[nombres[0]][def.id] = { pc: f.v[0], pd: f.v[1], t: f.t[0] ?? null, rendimiento: rendimientoPorT(f.t[0]) };
    if (f.v.length >= 4) out[nombres[1]][def.id] = { pc: f.v[2], pd: f.v[3], t: f.t[1] ?? null, rendimiento: rendimientoPorT(f.t[1]) };
  }
  return out;
}

/** Lee el informe. Devuelve null si el texto no es un informe de Nesplora Aula. */
export function leerNesplora(texto) {
  if (!esNesplora(texto)) return null;
  const crudo = String(texto);
  const lineas = crudo.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const plano = crudo.replace(ESPACIOS, ' ');
  const campo = (re) => plano.match(re)?.[1]?.trim() || null;
  const persona = {
    nombre: campo(/NOMBRE Y APELLIDOS\s+(.+?)\s+SEXO\b/i),
    sexo: campo(/\bSEXO\s+(MASCULINO|FEMENINO|OTRO)\b/i),
    nacimiento: fechaISO(campo(/FECHA DE NACIMIENTO\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)),
    edad: num(campo(/\bEDAD\s+(\d{1,2})\b/i)),
  };
  const fecha = fechaISO(campo(/REALIZACI[ÓO]N DE LA PRUEBA\s+(\d{1,2}\/\d{1,2}\/\d{4})/i));
  const duracion = campo(/DURACI[ÓO]N DE LA PRUEBA\s+([\d:]+)/i);
  const baremo = campo(/BAREMO UTILIZADO\s+(.+?)\s+NOTAS/i);
  const valido = /cumple los requisitos para considerarse v[aá]lida/i.test(plano) && !/no cumple los requisitos/i.test(plano) ? true
    : /no cumple los requisitos|no (es|se considera) v[aá]lida/i.test(plano) ? false : null;

  // Índices generales: frase descriptiva del propio informe (§3.1).
  const variables = [];
  const re = /ha obtenido una\s*puntuaci[oó]n\s*([\d.,]+)\s*en\s*(.+?)\.\s*Este\s*dato\s*se\s*sit[uú]a\s*en\s*un\s*percentil\s*(\d+)\s*y\s*t\s*(\d+)\s*respecto\s*a\s*la\s*muestra\s*normal\.\s*Lo\s*que\s*indica\s*un\s*rendimiento\s*(muy bajo|bajo|normal|alto|muy alto)/gi;
  for (const m of plano.matchAll(re)) {
    const def = INDICES.find((x) => x.re.test(m[2]));
    if (!def || variables.some((v) => v.id === def.id)) continue;
    const pd = num(m[1]); const pc = num(m[3]); const t = num(m[4]); const rendimiento = m[5].toLowerCase();
    variables.push({ id: def.id, variable: def.nombre, mide: def.mide, pd, percentil: pc, t, rendimiento, sentido: sentidoDeRendimiento(rendimiento),
      resultado: `PD ${pd} · percentil ${pc} · T ${t}`, interpretacion: `rendimiento ${rendimiento} (según el baremo del instrumento)`, evidencia: m[0].slice(0, 300) });
  }
  const condiciones = {
    distractores: tablaCondiciones(lineas, /CONDISTRACTORESSINDISTRACTORES/i, ['con', 'sin']),
    tareas: tablaCondiciones(lineas, /TAREAINHIBICI[ÓO]NTAREAVIGILANCIA/i, ['inhibicion', 'vigilancia']),
    canales: tablaCondiciones(lineas, /^VISUALAUDITIVO$/i, ['visual', 'auditivo']),
  };
  const limitaciones = [
    'Nesplora Aula mide el desempeño en una tarea específica de ejecución continua en un aula virtual; no confirma ni descarta TDAH por sí sola (el propio informe indica que no debe usarse como única base para el diagnóstico).',
    'Los resultados dependen de las condiciones de administración y del baremo utilizado.',
  ];
  if (valido === false) limitaciones.unshift('El indicador de validez (EVI) señala problemas de ejecución: los resultados deben interpretarse con cautela o no interpretarse.');
  return { instrumento: 'Nesplora Aula', persona, fecha, duracion, baremo, valido, variables, condiciones, limitaciones };
}

const aniosEntre = (desde, hasta) => {
  const a = new Date(`${desde}T00:00:00`); const b = new Date(hasta);
  let n = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) n--;
  return n;
};
const mesesEntre = (desde, hasta) => Math.floor((new Date(hasta) - new Date(`${desde}T00:00:00`)) / (30.44 * 86_400_000));
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * ¿El informe corresponde al caso? Compara la edad (desde la fecha de nacimiento del informe) con la
 * edad registrada en el caso y, si el caso tiene un nombre, el nombre. Devuelve:
 * { estado: 'verificada' | 'requiere_confirmacion', problemas: [...], advertencias: [...] }
 */
export function verificarVinculacion(lectura, { edadCaso = null, etiqueta = '', hoy = new Date() } = {}) {
  const problemas = []; const advertencias = [];
  const { persona = {}, fecha } = lectura || {};
  if (persona.nacimiento && edadCaso != null) {
    const edadActual = aniosEntre(persona.nacimiento, hoy);
    if (Math.abs(edadActual - edadCaso) > 1) problemas.push(`La fecha de nacimiento del informe (${persona.nacimiento}) corresponde a ${edadActual} años, pero el caso registra ${edadCaso} años.`);
  } else if (persona.edad != null && fecha && edadCaso != null) {
    const edadEstimada = persona.edad + Math.floor(mesesEntre(fecha, hoy) / 12);
    if (Math.abs(edadEstimada - edadCaso) > 1) problemas.push(`El informe registra ${persona.edad} años en ${fecha}; hoy tendría unos ${edadEstimada}, pero el caso registra ${edadCaso} años.`);
  } else {
    advertencias.push(edadCaso == null ? 'El caso aún no tiene edad registrada: no se pudo verificar la correspondencia por edad.' : 'El informe no trae fecha de nacimiento ni edad: no se pudo verificar la correspondencia por edad.');
  }
  // Nombre: solo si la etiqueta del caso parece un nombre (no un código o «Caso …»).
  const nombreInforme = sinTildes(persona.nombre).split(/\s+/).filter((w) => w.length >= 3 && !/^(anonymous|anonimo|anonima)$/.test(w));
  const nombreCaso = sinTildes(etiqueta).split(/[\s.,]+/).filter((w) => w.length >= 3 && /^[a-zñ]+$/.test(w));
  if (nombreInforme.length && nombreCaso.length && !/^caso\b/.test(sinTildes(etiqueta))) {
    if (!nombreInforme.some((w) => nombreCaso.includes(w))) problemas.push(`El nombre del informe («${persona.nombre}») no coincide con el del caso («${etiqueta}»).`);
  }
  if (fecha) {
    const meses = mesesEntre(fecha, hoy);
    if (meses > 12) advertencias.push(`La prueba se realizó hace ${Math.floor(meses / 12)} año(s) y ${meses % 12} mes(es) (${fecha}): puede no reflejar el funcionamiento actual.`);
    if (meses < 0) problemas.push(`La fecha de la prueba (${fecha}) es posterior a hoy.`);
  }
  if (lectura?.valido === false) advertencias.push('El indicador de validez (EVI) del informe señala problemas de ejecución.');
  const estado = problemas.length || (advertencias.some((a) => /no se pudo verificar/.test(a))) ? 'requiere_confirmacion' : 'verificada';
  return { estado, problemas, advertencias };
}

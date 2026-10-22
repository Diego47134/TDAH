// Consentimiento informado y tratamiento de datos sensibles de salud mental.
// Marco: Ley 19.628 (modificada por Ley 21.719), Ley 20.584 (derechos y deberes del paciente;
// ficha clínica), Ley 21.331 (derechos en la atención de salud mental), Decreto 41/2012 MINSAL.
// Ver docs/PRIVACIDAD_Y_CUMPLIMIENTO.md y public/privacidad.html.

export const VERSION_POLITICA = '1.2 (21-10-2026)';

export const RELACIONES = ['madre', 'padre', 'tutor_legal', 'otro_representante_legal'];
export const MEDIOS = ['escrito_firmado', 'electronico', 'verbal_registrado'];

export class ErrorConsentimiento extends Error {}

const txt = (v) => String(v ?? '').trim();

/** Consentimiento del representante legal para el tratamiento de datos sensibles (obligatorio para crear un caso). */
export function validarConsentimiento(c) {
  if (!c || typeof c !== 'object') throw new ErrorConsentimiento('Debe registrar el consentimiento informado del representante legal antes de crear el caso.');
  if (c.acepta !== true) throw new ErrorConsentimiento('Sin consentimiento expreso del representante legal no se pueden tratar datos de salud (datos sensibles).');
  const otorgante = txt(c.otorgante); const profesional = txt(c.profesional);
  if (!otorgante) throw new ErrorConsentimiento('Indique quién otorga el consentimiento (nombre o referencia al documento firmado).');
  if (!profesional) throw new ErrorConsentimiento('Indique el profesional responsable que obtiene el consentimiento.');
  if (!RELACIONES.includes(c.relacion)) throw new ErrorConsentimiento(`Relación con el niño, niña o adolescente no válida (${RELACIONES.join(', ')}).`);
  if (!MEDIOS.includes(c.medio)) throw new ErrorConsentimiento(`Medio de consentimiento no válido (${MEDIOS.join(', ')}).`);
  return { tipo: 'tratamiento_datos', otorgante: otorgante.slice(0, 160), relacion: c.relacion, medio: c.medio, profesional: profesional.slice(0, 120),
    acepta_ia_externa: c.acepta_ia_externa === true, version_politica: VERSION_POLITICA };
}

/** Asentimiento del niño, niña o adolescente (derecho a ser oído e informado; Ley 21.331 art. 25). */
export function validarAsentimiento(a) {
  if (!a || a.acepta !== true) throw new ErrorConsentimiento('Antes de entrevistar al niño, niña o adolescente registre que fue informado y acepta participar (asentimiento).');
  const profesional = txt(a.profesional);
  if (!profesional) throw new ErrorConsentimiento('Indique el profesional que obtiene el asentimiento.');
  return { tipo: 'asentimiento_nna', otorgante: 'niño, niña o adolescente evaluado', relacion: 'nna', medio: MEDIOS.includes(a.medio) ? a.medio : 'verbal_registrado',
    profesional: profesional.slice(0, 120), version_politica: VERSION_POLITICA };
}

/** ¿Autorizó el representante el procesamiento de documentos y respuestas por el proveedor externo de IA? */
export const permiteIA = (ctx) => (ctx.consentimientos || []).some((c) => c.tipo === 'tratamiento_datos' && c.acepta_ia_externa && !c.revocado);
export const tieneAsentimiento = (ctx) => (ctx.consentimientos || []).some((c) => c.tipo === 'asentimiento_nna' && !c.revocado);

// Seudonimización antes de enviar texto a un proveedor externo: quita RUT, correos, teléfonos,
// fechas de nacimiento y los nombres que el profesional indique o que figuren en el caso.
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sinTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const PATRONES = [
  [/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g, '[DATO]'],          // RUT
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[DATO]'],                      // correo
  [/(\+?56\s?)?(\(?\d{1,2}\)?[\s-]?)?\d{4}[\s-]?\d{4}\b/g, '[DATO]'], // teléfono
  [/\b(nacid[oa](?:\s+el)?|fecha de nacimiento|f\.?\s?nac\.?)\s*:?\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi, '$1 [DATO]'],
];

/** @param nombres lista de nombres/apellidos a ocultar (se reemplazan como palabras completas, sin distinguir tildes). */
export function seudonimizar(texto, nombres = []) {
  let t = String(texto ?? '');
  for (const [re, r] of PATRONES) t = t.replace(re, r);
  const partes = [...new Set(nombres.flatMap((n) => String(n || '').split(/[\s,;]+/)).map((p) => p.trim()).filter((p) => p.length >= 3))];
  for (const p of partes) {
    const variantes = [...new Set([p, sinTildes(p)])];
    for (const v of variantes) t = t.replace(new RegExp(`(?<![\\p{L}])${escRe(v)}(?![\\p{L}])`, 'giu'), '[NOMBRE]');
  }
  return t;
}

/** Nombres conocidos del caso que nunca deben salir del servidor. */
export function nombresDelCaso(ctx, extra = []) {
  const n = [...extra];
  for (const c of ctx?.consentimientos || []) if (c.otorgante && !/documento|n°|nº|\d/i.test(c.otorgante)) n.push(c.otorgante);
  if (ctx?.caso?.etiqueta && !/^caso\b/i.test(ctx.caso.etiqueta)) n.push(ctx.caso.etiqueta);
  return n;
}

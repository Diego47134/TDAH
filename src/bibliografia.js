// Búsqueda bibliográfica en internet (Europe PMC y PubMed/NCBI), para que el profesional consulte
// evidencia sobre criterios diagnósticos DSM-5/DSM-5-TR y entrevistas para TDAH.
// Privacidad: solo se envían los términos de búsqueda escritos por el profesional; nunca datos del
// expediente. Las consultas que parecen contener datos personales (RUT, correos, teléfonos) se rechazan.

export class ErrorBusqueda extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

export const FUENTES = {
  europepmc: { nombre: 'Europe PMC (incluye PubMed)', url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search' },
  pubmed: { nombre: 'PubMed (NCBI)', url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils' },
};

/** Búsquedas sugeridas: criterios DSM-5 y entrevistas diagnósticas para TDAH. */
export const SUGERIDAS = [
  { etiqueta: 'Criterios DSM-5 para TDAH en niños y adolescentes', consulta: 'ADHD DSM-5 diagnostic criteria children adolescents' },
  { etiqueta: 'Entrevistas diagnósticas estructuradas para TDAH', consulta: 'ADHD structured diagnostic interview children DSM-5' },
  { etiqueta: 'K-SADS-PL DSM-5 (validez para TDAH)', consulta: 'K-SADS-PL DSM-5 ADHD validity' },
  { etiqueta: 'Entrevista a padres y docentes: concordancia', consulta: 'ADHD parent teacher agreement informant DSM-5 symptoms' },
  { etiqueta: 'Edad de inicio antes de los 12 años', consulta: 'ADHD age of onset criterion 12 years DSM-5' },
  { etiqueta: 'Diagnóstico diferencial (sueño, ansiedad, aprendizaje)', consulta: 'ADHD differential diagnosis sleep anxiety learning disorder children' },
  { etiqueta: 'Guías clínicas de diagnóstico de TDAH', consulta: 'ADHD clinical practice guideline diagnosis children' },
  { etiqueta: 'TDAH: criterios DSM-5 (literatura en español)', consulta: 'TDAH criterios DSM-5 diagnóstico entrevista' },
];

const PATRONES_PERSONALES = [
  [/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/, 'un RUT'],
  [/[^\s@]+@[^\s@]+\.[^\s@]+/, 'un correo electrónico'],
  [/\+?\d[\d\s-]{7,}\d/, 'un número de teléfono'],
];

/** Valida la consulta: términos clínicos generales, sin datos personales. */
export function validarConsulta(q) {
  const consulta = String(q ?? '').replace(/\s+/g, ' ').trim();
  if (consulta.length < 3) throw new ErrorBusqueda(400, 'Escriba al menos 3 caracteres para buscar.');
  if (consulta.length > 200) throw new ErrorBusqueda(400, 'La búsqueda es demasiado larga (máximo 200 caracteres).');
  for (const [re, que] of PATRONES_PERSONALES) {
    if (re.test(consulta)) throw new ErrorBusqueda(400, `La búsqueda parece contener ${que}. Use solo términos clínicos generales: nunca datos del paciente.`);
  }
  return consulta;
}

const limpiar = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function crearBuscador({ fetchImpl = globalThis.fetch, timeoutMs = 15000, correoContacto = process.env.RESPONSABLE_CORREO } = {}) {
  async function obtenerJSON(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: 'application/json', 'user-agent': 'EvaluacionTDAH/1.0 (consulta bibliografica)' } });
      if (!r.ok) throw new ErrorBusqueda(502, `La fuente respondió con el código ${r.status}. Intente nuevamente más tarde.`);
      return await r.json();
    } catch (e) {
      if (e instanceof ErrorBusqueda) throw e;
      if (e.name === 'AbortError') throw new ErrorBusqueda(504, 'La fuente bibliográfica no respondió a tiempo.');
      throw new ErrorBusqueda(502, 'No fue posible conectarse a la fuente bibliográfica (revise la conexión a internet del servidor).');
    } finally { clearTimeout(t); }
  }

  async function europepmc(consulta, n) {
    const u = new URL(FUENTES.europepmc.url);
    u.search = new URLSearchParams({ query: consulta, format: 'json', resultType: 'core', pageSize: String(n), sort: 'RELEVANCE' }).toString();
    const d = await obtenerJSON(u);
    const lista = d?.resultList?.result || [];
    return { total: Number(d?.hitCount ?? lista.length), resultados: lista.map((x) => ({
      id: `${x.source || 'MED'}:${x.id}`, fuente: 'europepmc',
      titulo: limpiar(x.title), autores: limpiar(x.authorString), revista: limpiar(x.journalTitle || x.journalInfo?.journal?.title),
      anio: x.pubYear ? Number(x.pubYear) : null, doi: x.doi || null, pmid: x.pmid || null,
      url: x.doi ? `https://doi.org/${x.doi}` : `https://europepmc.org/article/${x.source || 'MED'}/${x.id}`,
      resumen: limpiar(x.abstractText).slice(0, 2500) || null, acceso_abierto: x.isOpenAccess === 'Y',
    })) };
  }

  async function pubmed(consulta, n) {
    const extra = correoContacto ? { tool: 'EvaluacionTDAH', email: correoContacto } : { tool: 'EvaluacionTDAH' };
    const s = new URL(`${FUENTES.pubmed.url}/esearch.fcgi`);
    s.search = new URLSearchParams({ db: 'pubmed', term: consulta, retmode: 'json', retmax: String(n), sort: 'relevance', ...extra }).toString();
    const d = await obtenerJSON(s);
    const ids = d?.esearchresult?.idlist || [];
    const total = Number(d?.esearchresult?.count ?? ids.length);
    if (!ids.length) return { total, resultados: [] };
    const m = new URL(`${FUENTES.pubmed.url}/esummary.fcgi`);
    m.search = new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json', ...extra }).toString();
    const r = await obtenerJSON(m);
    return { total, resultados: ids.map((id) => r?.result?.[id]).filter(Boolean).map((x) => {
      const doi = (x.articleids || []).find((a) => a.idtype === 'doi')?.value || null;
      return {
        id: `MED:${x.uid}`, fuente: 'pubmed', titulo: limpiar(x.title), autores: (x.authors || []).map((a) => a.name).slice(0, 6).join(', ') + ((x.authors || []).length > 6 ? ' et al.' : ''),
        revista: limpiar(x.fulljournalname || x.source), anio: Number(String(x.pubdate || '').slice(0, 4)) || null, doi, pmid: String(x.uid),
        url: `https://pubmed.ncbi.nlm.nih.gov/${x.uid}/`, resumen: null, acceso_abierto: false,
      };
    }) };
  }

  return {
    fuentes: FUENTES,
    async buscar({ consulta, fuente = 'europepmc', cantidad = 10 } = {}) {
      const q = validarConsulta(consulta);
      if (!FUENTES[fuente]) throw new ErrorBusqueda(400, `Fuente no válida: ${fuente}.`);
      const n = Math.min(Math.max(Number(cantidad) || 10, 1), 25);
      const r = fuente === 'pubmed' ? await pubmed(q, n) : await europepmc(q, n);
      return { consulta: q, fuente, fuente_nombre: FUENTES[fuente].nombre, ...r };
    },
  };
}

/** Cita breve en formato tipo Vancouver para el informe. */
export function citar(r) {
  const partes = [r.autores, r.titulo && `${r.titulo.replace(/\.$/, '')}.`, r.revista && `${r.revista}.`, r.anio && `${r.anio}.`].filter(Boolean);
  const id = r.doi ? `doi:${r.doi}` : r.pmid ? `PMID: ${r.pmid}` : r.url;
  return `${partes.join(' ')} ${id}`.trim();
}

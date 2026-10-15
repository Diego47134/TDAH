// Valida la integridad del protocolo (útil al codificar los documentos vigentes).
// Uso: npm run validar-protocolo [-- ruta/al/protocolo.json]
import { cargarProtocolo } from '../src/protocolo.js';
try {
  const p = cargarProtocolo(process.argv[2]);
  const porDominio = p.dimensiones.reduce((m, d) => ({ ...m, [d.dominio]: (m[d.dominio] || 0) + 1 }), {});
  console.log(`Protocolo ${p.id} ${p.version} (${p.estado}) válido.`);
  console.log(`Dimensiones: ${p.dimensiones.length} ${JSON.stringify(porDominio)}`);
  console.log(`Preguntas en el banco: ${p.preguntasPorId.size} · grupos de equivalencia: ${(p.grupos_equivalencia || []).length} · instrumentos: ${p.instrumentos.length}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

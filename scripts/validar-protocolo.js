// Valida la integridad del protocolo compilado desde los documentos del proyecto.
// Uso: npm run validar-protocolo [-- ruta/al/protocolo.json]
import { cargarProtocolo } from '../src/protocolo.js';
try {
  const p = cargarProtocolo(process.argv[2]);
  const porGrupo = {};
  for (const q of p.preguntas.values()) porGrupo[q.grupo] = (porGrupo[q.grupo] || 0) + 1;
  console.log(`Protocolo ${p.id} ${p.version} (${p.estado}) válido.`);
  console.log(`Síntomas DSM-5-TR: ${p.sintomas.length} · banco: ${p.banco.length} · bloques: ${p.bloques.length} · equivalencias: ${p.equivalencias.length}`);
  console.log(`Barrido: ${p.barrido.opciones.length} alternativas · tamizaje: ${p.tamizaje.opciones.length} alternativas · áreas: ${p.areas.length} · sugerencias: ${p.sugerencias.length} · referencias: ${Object.keys(p.referencias).length}`);
  console.log(`Preguntas compiladas: ${p.preguntas.size} ${JSON.stringify(porGrupo)}`);
  console.log('Fuentes:'); for (const f of p.fuentes) console.log(`  - ${f.archivo || f.nombre} ${f.sha256 ? f.sha256.slice(0, 16) + '…' : ''}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

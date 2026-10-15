// Respaldo automático de la base de datos (copia consistente con VACUUM INTO).
// Se ejecuta al arrancar si el último respaldo tiene más de `cadaHoras` y luego periódicamente.
import fs from 'node:fs';
import path from 'node:path';

export function respaldar(db, dir, { conservar = 14 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = path.join(dir, `tdah-${marca}.sqlite`);
  db.prepare('VACUUM INTO ?').run(destino);
  const viejos = listar(dir).slice(conservar);
  for (const f of viejos) fs.rmSync(path.join(dir, f), { force: true });
  return destino;
}

export function listar(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^tdah-.*\.sqlite$/.test(f)).sort().reverse();
}

export function programarRespaldos(db, dir, { cadaHoras = 24, conservar = 14, log = console } = {}) {
  const intervalo = cadaHoras * 3600_000;
  const ejecutar = () => {
    try { log.log(`Respaldo creado: ${respaldar(db, dir, { conservar })}`); } catch (e) { log.error(`Respaldo fallido: ${e.message}`); }
  };
  const ultimo = listar(dir)[0];
  const antiguedad = ultimo ? Date.now() - fs.statSync(path.join(dir, ultimo)).mtimeMs : Infinity;
  if (antiguedad >= intervalo) ejecutar();
  const t = setInterval(ejecutar, intervalo);
  t.unref();
  return t;
}

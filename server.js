// Punto de entrada de PRODUCCIÓN (Hostinger «Entry file: server.js», Docker, `npm start`).
// En desarrollo use `npm run dev`.
// Sin «await» de nivel superior: Hostinger (LiteSpeed lsnode) carga este archivo con require().
import os from 'node:os';
import path from 'node:path';
import { iniciarServidor } from './src/server.js';
import { programarRespaldos } from './src/respaldo.js';

process.env.NODE_ENV ||= 'production';
process.env.HOST ||= '0.0.0.0';

// La base de datos vive FUERA de la carpeta de despliegue: Hostinger reemplaza esa carpeta
// en cada despliegue (hbuilds/). Por defecto: ~/tdah-datos/tdah.sqlite
const carpetaDatos = process.env.DATA_DIR || path.join(os.homedir(), 'tdah-datos');
process.env.DB_PATH ||= path.join(carpetaDatos, 'tdah.sqlite');

const advertencias = [];

// SQLite integrado requiere Node 22.13+ (recomendado: 24).
const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 22 || (mayor === 22 && menor < 13)) {
  throw new Error(`Node ${process.versions.node} no es compatible. Seleccione Node.js 24.x (o 22.13+) en la configuración del despliegue.`);
}

// Advertir si la base de datos quedó dentro de la carpeta que se reemplaza en cada despliegue.
const dbAbs = path.resolve(process.env.DB_PATH);
if (dbAbs.startsWith(path.resolve(process.cwd()) + path.sep) || dbAbs.includes(`${path.sep}hbuilds${path.sep}`)) {
  advertencias.push(`DB_PATH (${dbAbs}) está dentro de la carpeta de despliegue: los datos se perderían en el próximo despliegue.`);
}


const app = iniciarServidor({ advertencias });
console.log(`Base de datos: ${dbAbs}`);
if (process.env.BACKUP_DISABLED !== '1') {
  programarRespaldos(app.db, process.env.BACKUP_DIR || path.join(path.dirname(dbAbs), 'respaldos'), {
    cadaHoras: Number(process.env.BACKUP_EVERY_HOURS || 24),
    conservar: Number(process.env.BACKUP_KEEP || 14),
  });
}

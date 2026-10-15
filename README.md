# Sistema de evaluación TDAH

Aplicación (PWA + backend + base de datos integrada) que ejecuta la **entrevista adaptativa** de evaluación de TDAH, mantiene un **expediente persistente** por persona evaluada, integra **informe escolar e instrumentos** (escalas, Nesplora, realidad virtual) y genera un **informe estructurado** que queda sujeto a validación profesional.

> ⚠️ **Estado del protocolo: PROVISIONAL.** Los documentos que gobiernan el sistema (Modelo científico, Etapa 4, Etapa 7, Etapa 9, prompt de entrevista y archivo de automatización) **aún no han sido entregados**. El software está completo y probado, pero carga un protocolo provisional (`protocol/protocolo.provisional.json`) creado solo para validar técnicamente el flujo. **No tiene validez clínica.** Ver [docs/DOCUMENTOS_Y_CONTRADICCIONES.md](docs/DOCUMENTOS_Y_CONTRADICCIONES.md).

## Inicio rápido

Requisitos: **Node.js 22.13 o superior** (incluye SQLite integrado). No hay dependencias que instalar.

```bash
git clone https://github.com/Diego47134/TDAH.git
cd tdah
npm run dev                 # desarrollo local: http://127.0.0.1:3000 (sin token)
```

**Publicar en un dominio (Hostinger):** ver la guía paso a paso [docs/DESPLIEGUE_HOSTINGER.md](docs/DESPLIEGUE_HOSTINGER.md).

Abrir `http://127.0.0.1:3000`, crear un caso con un seudónimo y comenzar la entrevista. En el navegador puede instalarse como app (PWA).

`npm start` arranca en **modo producción** (`server.js`): escucha en `0.0.0.0`, guarda la base de datos en `~/tdah-datos/` (fuera de la carpeta de la app), hace respaldos diarios y **exige `APP_ACCESS_TOKEN`**.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo local (recarga al guardar, sin token) |
| `npm start` | Producción (`server.js`): token obligatorio, datos fuera de la app, respaldos |
| `npm test` | Pruebas unitarias y de extremo a extremo (47) |
| `npm run test:evidencia` | Igual, y escribe evidencia verificable en `docs/evidencia/` |
| `npm run demo` | Caso ficticio completo de principio a fin → `docs/demo/` |
| `npm run validar-protocolo [-- archivo.json]` | Valida la integridad de un protocolo |

### Con Docker

```bash
docker build -t tdah .
docker run -p 3000:3000 -v tdah-datos:/data --env-file .env tdah
```

## Variables de entorno

| Variable | Uso | Por defecto |
|---|---|---|
| `PORT`, `HOST` | Puerto (o ruta de socket) y host | `3000`; `127.0.0.1` en desarrollo, `0.0.0.0` en producción |
| `DB_PATH` | Archivo SQLite del expediente | desarrollo: `data/tdah.sqlite` · producción: `~/tdah-datos/tdah.sqlite` |
| `BACKUP_EVERY_HOURS`, `BACKUP_KEEP` | Respaldos automáticos en producción | cada `24` h, conservar `14` |
| `PROTOCOLO_PATH` | Protocolo a cargar | `protocol/protocolo.provisional.json` |
| `APP_ACCESS_TOKEN` | La API exige `Authorization: Bearer <token>` (la PWA lo solicita). **Obligatorio en producción** | sin token en desarrollo |
| `ANTHROPIC_API_KEY` | Habilita la IA para interpretar respuestas y extraer el informe escolar | IA deshabilitada → intérprete de reglas |
| `ANTHROPIC_MODEL` | Modelo de IA | `claude-sonnet-5-5` |
| `IA_TIMEOUT_MS` | Tiempo máximo por llamada a la IA | `20000` |

Las claves nunca se escriben en el código ni se envían al navegador.

## Cómo funciona (resumen)

```
PWA ──HTTP──> Backend (servicio) ──> Motor Etapa 9 ──> Validador ──> pregunta autorizada
                    │                     ▲                              │
                    │                     └──── expediente (SQLite) <────┘ respuesta + hechos + auditoría
                    └──> IA (opcional): solo interpreta respuestas / extrae informe escolar
```

- El **motor** decide qué falta y qué preguntar; la **IA nunca elige preguntas**.
- Cada pregunta pasa por un **validador** de 9 reglas antes de mostrarse (autorizada, orden, ruta, necesaria, no repetida, no equivalente, especificidad, incertidumbre, límite).
- Cada dato del expediente guarda su **fuente** y su **evidencia literal**.
- El **informe final se bloquea** mientras falten requisitos del protocolo.

Detalle completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Estructura del expediente en [docs/EXPEDIENTE.md](docs/EXPEDIENTE.md). Matriz de cumplimiento del brief en [docs/REQUISITOS.md](docs/REQUISITOS.md).

## Estructura del repositorio

```
src/                 backend: servidor, servicio, motor, validador, intérprete, IA, informe
public/              PWA: interfaz, service worker, manifest, íconos
protocol/            protocolo (datos): dimensiones, banco de preguntas, reglas, instrumentos
prompts/             System Prompt Maestro y prompts de ejecución/extracción
test/unit, test/e2e  pruebas; test/fixtures: caso ficticio
scripts/             demo y validador de protocolo
docs/                arquitectura, requisitos, evidencia de pruebas y demostración
```

## Privacidad

- Use seudónimos. No ingrese datos identificables de pacientes reales en entornos de prueba.
- El service worker cachea **solo la interfaz**; los datos clínicos nunca se guardan en el navegador.
- Para uso real: servidor con HTTPS, `APP_ACCESS_TOKEN` (o autenticación institucional), respaldos cifrados del archivo `DB_PATH`.

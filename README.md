# Sistema de evaluación TDAH

Aplicación (PWA + backend + base de datos integrada) que ejecuta la **entrevista adaptativa** de evaluación de TDAH, mantiene un **expediente persistente** por persona evaluada, integra **informe escolar e instrumentos** (escalas, Nesplora, realidad virtual) y genera un **informe estructurado** que queda sujeto a validación profesional.

> **Protocolo vigente 1.0.0**, generado desde los documentos del proyecto (`protocol/fuentes/`): *TDAH Etapas 1–7*, *Etapa 9 completa corregida alineada* (motor) y *Automatización TDAH corregida completa* (lenguaje). Inventario, contradicciones y decisiones en [docs/DOCUMENTOS_Y_CONTRADICCIONES.md](docs/DOCUMENTOS_Y_CONTRADICCIONES.md). El sistema produce hipótesis estructuradas: la decisión clínica corresponde siempre al profesional.

## Inicio rápido

Requisitos: **Node.js 22.13 o superior** (incluye SQLite integrado). No hay dependencias que instalar.

```bash
git clone https://github.com/Diego47134/TDAH.git
cd TDAH
npm run dev                 # desarrollo local: http://127.0.0.1:3000 (sin token)
```

**Publicar en un dominio (Hostinger):** ver la guía paso a paso [docs/DESPLIEGUE_HOSTINGER.md](docs/DESPLIEGUE_HOSTINGER.md).

Abrir `http://127.0.0.1:3000`, crear un caso con un seudónimo y comenzar la entrevista. En el navegador puede instalarse como app (PWA).

`npm start` arranca en **modo producción** (`server.js`): escucha en `0.0.0.0`, guarda la base de datos en `~/tdah-datos/` (fuera de la carpeta de la app), hace respaldos diarios y **exige clave de acceso**: la primera vez la app pide crearla (o se usa `APP_ACCESS_TOKEN`).

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo local (recarga al guardar, sin token) |
| `npm start` | Producción (`server.js`): clave de acceso obligatoria, datos fuera de la app, respaldos |
| `npm test` | Pruebas unitarias y de extremo a extremo (54) |
| `npm run test:evidencia` | Igual, y escribe evidencia verificable en `docs/evidencia/` |
| `npm run demo` | Caso ficticio completo de principio a fin → `docs/demo/` |
| `npm run validar-protocolo [-- archivo.json]` | Valida la integridad del protocolo |
| `python3 scripts/construir_protocolo.py` | Regenera `protocol/protocolo.json` desde los documentos |

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
| `PROTOCOLO_PATH` | Protocolo a cargar | `protocol/protocolo.json` |
| `APP_ACCESS_TOKEN` | Clave fija de acceso (`Authorization: Bearer`). Opcional: en producción, sin ella, la app pide crear la clave en el primer ingreso | sin clave en desarrollo |
| `IA_PROVEEDOR` | `anthropic` u `openai` | `anthropic` (u `openai` si solo existe `OPENAI_API_KEY`) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Habilita la IA para asignar respuestas libres a alternativas y extraer el informe escolar | IA deshabilitada → intérprete de reglas |
| `IA_MODELO` | Modelo de IA | `claude-sonnet-5-5` / `gpt-4o` |
| `RESPONSABLE_NOMBRE`, `RESPONSABLE_RUT`, `RESPONSABLE_DOMICILIO`, `RESPONSABLE_CORREO` | Datos del responsable del tratamiento en la política de privacidad y los términos | se muestran como «[completar]» |
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
- Cada pregunta pasa por un **validador** de 17 reglas antes de mostrarse (pertenece al proyecto, orden, ruta, necesaria, no repetida, no equivalente, máximo 3 por síntoma, barrido antes del tamizaje, alternativas obligatorias, etc.).
- Presencia con **SÍ / NO / OCASIONALMENTE / NO SABE-NO RECUERDA**; «no sé» nunca equivale a «no».
- **Barrido diferencial** y **tamizaje médico, sensorial y del sueño** obligatorios antes del cierre (gate de la Etapa 9).
- Cada dato del expediente guarda su **fuente** y su **evidencia literal**.
- **Contraste DSM-5-TR R1–R10** e informe de **19 secciones** (Etapa 9 §28.2); el informe final se bloquea mientras falten requisitos.

Detalle completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Estructura del expediente en [docs/EXPEDIENTE.md](docs/EXPEDIENTE.md). Matriz de cumplimiento del brief en [docs/REQUISITOS.md](docs/REQUISITOS.md).

## Estructura del repositorio

```
src/                 backend: servidor, servicio, motor, validador, intérprete, IA, informe
public/              PWA: interfaz, service worker, manifest, íconos
protocol/            protocolo.json (generado), fuentes/ (documentos .docx y texto), datos/ (tablas extraídas)
prompts/             System Prompt Maestro y prompts de ejecución/extracción
test/unit, test/e2e  pruebas; test/fixtures: caso ficticio
scripts/             constructor y validador del protocolo, demo
docs/                arquitectura, requisitos, evidencia de pruebas y demostración
```

## Privacidad

- **Consentimiento informado obligatorio** del representante legal para crear un caso y **asentimiento** del niño, niña o adolescente antes de su entrevista. Política de privacidad en `/privacidad.html` y términos de uso con deslinde de responsabilidades en `/terminos.html`. Marco normativo (Leyes 19.628/21.719, 20.584, 21.331; Decreto 41/2012 MINSAL; ISP) y pendientes en [docs/PRIVACIDAD_Y_CUMPLIMIENTO.md](docs/PRIVACIDAD_Y_CUMPLIMIENTO.md).

- Use seudónimos. No ingrese datos identificables de pacientes reales en entornos de prueba.
- El service worker cachea **solo la interfaz**; los datos clínicos nunca se guardan en el navegador.
- Para uso real: servidor con HTTPS, `APP_ACCESS_TOKEN` (o autenticación institucional), respaldos cifrados del archivo `DB_PATH`.

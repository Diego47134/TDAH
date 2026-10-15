# Estructura del expediente

Base de datos SQLite (`DB_PATH`, por defecto `data/tdah.sqlite`). Esquema completo en `src/db.js`. Un ejemplo poblado con el caso ficticio está en `docs/demo/demo.sqlite`.

| Requisito del brief (§5) | Dónde se guarda |
|---|---|
| Identificador del caso | `casos.id` (UUID) y `casos.codigo` (CASO-0001…) |
| Motivo, edad y ruta | `hechos` con `dimension_id = 'INI'`; `casos.ruta`, `casos.ruta_forzada`, `casos.ruta_motivo` |
| Respuestas originales del apoderado | `respuestas.texto_original` (literal) + clasificación e intérprete usado |
| Preguntas formuladas y sus identificadores | `preguntas.pregunta_id`, `turno`, `texto`, `justificacion`, `estado` |
| Dimensiones exploradas / resueltas / parciales / pendientes | Derivadas en cada consulta desde `hechos` (no se duplican); visibles en `GET /api/casos/:id` → `dimensiones` |
| Datos desconocidos y contradicciones | `hechos.estado` (`no_sabe`, `no_recuerda`, `ambiguo`); tabla `contradicciones` |
| Fuente de cada dato | `hechos.fuente` (`apoderado`, `informe_escolar`, `instrumento`, `observacion`, `profesional`, `otra`) + `origen` + `evidencia` |
| Fecha y estado de cada evaluación | `evaluaciones` (`estado`, `fecha`, `aplicador`, `resultados`, `observaciones`) |
| Historial de decisiones del motor | `decisiones` (tipo, turno, detalle JSON con justificación, reglas del validador y estado) |
| Pregunta anterior y justificación de la siguiente | `preguntas` (orden por turno) y `casos.pregunta_actual.justificacion` |
| Estado global del proceso | `casos.estado_global` + `flujo` en la vista del caso |

Tablas adicionales: `informes_escolares` (texto y extracción), `informes` (finales, estado de validación), `errores` (API de IA, servidor, motor).

## API

| Método y ruta | Acción |
|---|---|
| `GET /api/salud` | Estado, versión de protocolo, IA |
| `GET /api/protocolo` | Protocolo cargado |
| `GET/POST /api/casos` | Listar / crear caso (devuelve la primera pregunta) |
| `GET /api/casos/:id` | Expediente completo, dimensiones, requisitos, flujo |
| `POST /api/casos/:id/respuestas` | `{pregunta_id, texto?, tipo?}` → traza del ciclo de decisión |
| `POST /api/casos/:id/informe-escolar` | `{texto}` o `{hechos:[{dimension_id, slot, valor, evidencia}]}` |
| `POST /api/casos/:id/ruta` | `{ruta, motivo}` cambio manual de ruta |
| `POST /api/casos/:id/evaluaciones` | Registro de instrumento |
| `POST /api/casos/:id/contradicciones/:cid/revision` | `{nota, profesional}` |
| `PUT /api/casos/:id/interpretacion` | `{texto, profesional}` |
| `GET /api/casos/:id/informe` | Borrador + requisitos |
| `POST /api/casos/:id/informes` | Informe final (409 si faltan requisitos) |
| `POST /api/casos/:id/informes/:iid/validacion` | `{profesional}` |
| `POST /api/casos/:id/propuestas` | Valida una pregunta propuesta externamente |
| `GET /api/casos/:id/auditoria` | Decisiones, errores, preguntas y respuestas |

# Estructura del expediente

Base de datos SQLite (`DB_PATH`, por defecto `data/tdah.sqlite`). Esquema completo en `src/db.js`. Un ejemplo poblado con el caso ficticio está en `docs/demo/demo.sqlite`.

| Requisito del brief (§5) | Dónde se guarda |
|---|---|
| Identificador del caso | `casos.id` (UUID) y `casos.codigo` (CASO-0001…) |
| Motivo, edad y ruta | `hechos` con `dimension_id = 'INI'`; `casos.ruta`, `casos.ruta_forzada`, `casos.ruta_motivo` |
| Respuestas originales del apoderado | `respuestas.texto_original` (literal) + clasificación e intérprete usado |
| Preguntas formuladas y sus identificadores | `preguntas.pregunta_id`, `turno`, `texto`, `justificacion`, `estado` |
| Síntomas y áreas exploradas / establecidas / parciales / pendientes | Derivados en cada consulta desde `hechos` (no se duplican): `GET /api/casos/:id` → `sintomas` (estados de la Etapa 9 §14.1), `barrido`, `tamizaje`, `integracion` (R1–R10, puerta de suficiencia, áreas) |
| Datos desconocidos y contradicciones | `hechos.estado` (`no_sabe`, `no_recuerda`, `ambiguo`, `no_informado`); tabla `contradicciones` (misma fuente o discrepancia entre fuentes, sin resolver por suposición) |
| Fuente de cada dato | `hechos.fuente` (`apoderado`, `informe_escolar`, `profesor`, `nino`, `adolescente`, `instrumento`, `profesional`) + `origen` (`respuesta`, `extraccion`, `mencion_espontanea`, `registro_manual`) + `evidencia` literal |
| Fecha y estado de cada evaluación | `evaluaciones` (`estado`, `fecha`, `aplicador`, `resultados`, `observaciones`) |
| Historial de decisiones del motor | `decisiones` (tipo, turno, detalle JSON con justificación, reglas del validador y estado) |
| Pregunta anterior y justificación de la siguiente | `preguntas` (orden por turno) y `casos.pregunta_actual.justificacion` |
| Estado global del proceso | `casos.estado_global` + `flujo` en la vista del caso |

Tablas adicionales: `consentimientos` (consentimiento del representante legal y asentimiento del NNA, con versión de la política), `informes_escolares` (texto y extracción), `informes` (finales, estado de validación), `errores` (servidor y motor).

## API

| Método y ruta | Acción |
|---|---|
| `GET /api/salud` | Estado y versión del protocolo |
| `GET /api/protocolo` | Resumen del protocolo vigente (fuentes, alternativas, síntomas, barrido, tamizaje) |
| `GET/POST /api/casos` | Listar / crear caso: `{etiqueta, consentimiento:{acepta, otorgante, relacion, medio, profesional}}` (devuelve la primera pregunta) |
| `GET /api/casos/:id` | Expediente completo, síntomas, barrido, tamizaje, integración, requisitos, flujo |
| `POST /api/casos/:id/respuestas` | `{pregunta_id, opcion?}` · `{pregunta_id, opciones?: [..]}` · `{pregunta_id, texto?, tipo?}` → traza del ciclo de decisión |
| `POST /api/casos/:id/informe-escolar` | `{texto}` o `{hechos:[{sintoma, slot, valor, evidencia}]}` |
| `GET/POST /api/casos/:id/colegio` | Preguntas del Anexo 7-C pendientes (las cubiertas por el informe no se envían) / `{respuestas:[{pregunta_id, texto}]}` |
| `POST /api/casos/:id/nna` | Entrevista al niño/niña (Anexo 7-D) o adolescente (7-E): `{asentimiento:{acepta, profesional}}` (obligatorio antes de la primera respuesta), `{pregunta_id, texto}`, `{pregunta_id, omitir:true}` o `{finalizar:true}` |
| `POST /api/casos/:id/ruta` | `{ruta, motivo}` cambio manual de ruta |
| `POST /api/casos/:id/evaluaciones` | Registro de instrumento |
| `POST /api/casos/:id/contradicciones/:cid/revision` | `{nota, profesional}` |
| `PUT /api/casos/:id/interpretacion` | `{texto, profesional}` |
| `GET /api/casos/:id/informe` | Borrador + requisitos |
| `POST /api/casos/:id/informes` | Informe final (409 si faltan requisitos) |
| `POST /api/casos/:id/informes/:iid/validacion` | `{profesional}` |
| `POST /api/casos/:id/propuestas` | Valida una pregunta propuesta externamente |
| `GET /api/casos/:id/auditoria` | Decisiones, errores, preguntas y respuestas |
| `GET /api/casos/:id/exportar?solicitante=` | Copia íntegra del expediente (derecho de acceso y portabilidad); queda auditada |
| `POST /api/configuracion-inicial` | `{clave}` crea la clave de acceso en el primer ingreso (solo producción sin `APP_ACCESS_TOKEN`) |

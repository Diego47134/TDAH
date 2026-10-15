# Arquitectura

## Principio rector

> La IA puede interpretar respuestas, pero el **software** controla el estado, la persistencia, las transiciones y las validaciones críticas. (Brief §10)

Por eso el sistema separa **reglas (datos)** de **mecanismo (código)**:

- `protocol/*.json` contiene todo el contenido clínico: dimensiones (Etapa 4), banco de preguntas (Etapa 7), parámetros de decisión de la Etapa 9 (límites, equivalencias, orden), instrumentos y requisitos del informe.
- `src/` contiene el mecanismo genérico que ejecuta cualquier protocolo válido. Al recibir los documentos vigentes se recodifica el JSON; el motor no cambia salvo que la Etapa 9 introduzca reglas de decisión nuevas (ver «Puntos de extensión»).

## Componentes (brief §10)

| Componente solicitado | Implementación |
|---|---|
| Interfaz de entrevista y expediente | `public/` — PWA sin framework (instalable, service worker solo para la interfaz) |
| Backend que controla el flujo | `src/servicio.js` — orquesta cada transición dentro de una transacción |
| Integración con la API de IA | `src/ia.js` — Anthropic Messages API, timeout, validación de esquema, contingencia |
| System Prompt Maestro y prompt de ejecución | `prompts/system-maestro.md`, `prompts/prompt-ejecucion.md`, `prompts/prompt-extraccion-informe.md` |
| Motor de decisiones Etapa 9 | `src/motor.js` — funciones puras sobre el contexto del expediente |
| Esquema de datos y validación de respuestas | `src/db.js`, `src/interprete.js`, validación de entradas en `src/servicio.js` |
| Base de datos persistente | SQLite integrado en Node (`node:sqlite`), modo WAL, un archivo |
| Validador de preguntas repetidas/no autorizadas | `src/validador.js` |
| Extracción del informe escolar | `src/informeEscolar.js` (+ IA opcional) |
| Integración de resultados | `evaluaciones` + `src/informe.js` (hallazgos multifuente) |
| Generador de informes | `src/informe.js` — solo desde el expediente; bloqueo por requisitos |
| Auditoría y errores | tablas `decisiones` y `errores`; vista y descarga en la pestaña «Auditoría» |

## Ciclo de decisión (brief §4)

```
POST /respuestas
 1. Verifica que la respuesta corresponde a la pregunta VIGENTE (si no → 409)
 2. Interpreta: botones (sí/no/no sé/no recuerdo) o texto → reglas o IA (con contingencia)
 3. Transacción:
    a. guarda la respuesta literal
    b. agrega el hecho (fuente: apoderado) → detecta contradicción sin resolverla
    c. registra menciones espontáneas de otras conductas como hechos (presencia = sí)
    d. AVANZAR:
       - determina/actualiza la ruta (con_informe | completa) y la justifica
       - siguientePaso(): fase inicial en orden estricto → dimensiones «en curso»
         (actividad más reciente primero = profundización inmediata) → dimensiones pendientes
         en el orden del protocolo
       - cada candidata pasa por el VALIDADOR; las bloqueadas se auditan y se prueba la siguiente
       - persiste la pregunta seleccionada + justificación, o cierra / espera el informe
 4. Devuelve la TRAZA: entrada, estado anterior, decisión, pregunta resultante, estado posterior
```

### Estados

**Dato (slot):** `sin_dato` · `valor` · `no_sabe` · `no_recuerda` · `ambiguo` · `contradiccion`.
«No sé» y «no recuerdo» jamás se convierten en `valor = no`.

**Dimensión:** `pendiente` · `en_curso` (presencia establecida, faltan datos esenciales) · `resuelta` · `parcial` (explorada con incertidumbre, ambigüedad o contradicción) · `pendiente_informe` · `no_aplica` (edad).

**Caso:** `fase_inicial` → `entrevista` → `esperando_informe_escolar` / `entrevista_completa` → `informe_final` → `validado`.

### Reglas del motor (provisionales, parametrizadas en el protocolo)

- Presencia `no` → dimensión resuelta, no se caracteriza (no se agota el banco).
- Presencia `sí` (respuesta o mención) → se preguntan solo los datos esenciales del perfil que falten, de inmediato.
- `ambiguo` → una pregunta más específica del mismo dato, si existe; si no, `parcial`.
- `no sé` / `no recuerdo` → como máximo una pregunta alternativa marcada `tras_incertidumbre`; luego `parcial`.
- Límite por dimensión (`max_preguntas_por_dimension`) = control de redundancia: se supera solo por datos esenciales y queda justificado; `tope_absoluto_por_dimension` corta cualquier bucle.
- Ruta `con_informe`: las dimensiones de ámbito escolar no se preguntan en el hogar; al cargar el informe, solo se preguntan los vacíos (justificación «vacío relevante»).
- Cualquier dato presente en el expediente desde **cualquier fuente** no se vuelve a preguntar.

## Validador (brief §6)

| Regla | Pregunta del brief |
|---|---|
| `autorizada` | ¿Está autorizada? (existe en el banco y el texto no fue alterado) |
| `orden_inicial`, `condicion` | ¿Respeta la secuencia obligatoria? |
| `aplicable_edad`, `ruta_informe_escolar` | ¿Se respeta la ruta del informe escolar? |
| `necesaria`, `no_en_expediente` | ¿Es necesaria? ¿El dato ya está en el expediente o en otra fuente? |
| `no_repetida`, `no_equivalente` | ¿Es funcionalmente equivalente a una anterior? (grupos de equivalencia + similitud textual para propuestas externas) |
| `mas_especifica` | ¿Existe una pregunta más específica? |
| `incertidumbre` | ¿Se trata correctamente la incertidumbre? |
| `limite` | Límite como control de redundancia |
| `una_sola_pregunta` | Una sola pregunta por turno |

Las preguntas propuestas desde fuera del motor (por ejemplo, por una IA) entran por `POST /api/casos/:id/propuestas`, se validan y se auditan; nunca reemplazan la decisión del motor.

## IA: alcance y contingencia

- **Usa:** clasificar respuestas libres, detectar menciones de otras conductas, extraer hechos del informe escolar (cada uno con frase literal).
- **No usa:** seleccionar o redactar preguntas, interpretar clínicamente, completar datos.
- Toda salida se valida (clasificación dentro del esquema, dimensiones existentes, evidencia presente). Ante caída, timeout, HTTP de error o JSON inválido se usa el intérprete de reglas, se registra el error y la entrevista continúa (prueba A3).
- Sin `ANTHROPIC_API_KEY` el sistema funciona completo con reglas deterministas.

## Persistencia y recuperación (brief §5)

Todo vive en SQLite (`DB_PATH`). La pregunta vigente, su turno y su justificación se guardan en `casos.pregunta_actual`, por lo que cerrar el navegador, reiniciar el servidor o abrir otra sesión retoma el punto exacto (prueba E03/E13). Cada transición es una transacción: no hay estados a medias.

## Por qué estas tecnologías

- **Node 22 + `node:sqlite`:** cero dependencias de terceros y cero servicios externos; un solo archivo de base de datos fácil de respaldar. Para muchos usuarios concurrentes se puede migrar a PostgreSQL cambiando `db.js`/`expediente.js` (SQL estándar).
- **PWA sin framework:** la interfaz no contiene lógica clínica; mínima superficie de fallo e instalable en escritorio y móvil.
- **Pruebas con `node:test`:** sin dependencias, con reporte JUnit para CI.

## Puntos de extensión al recibir los documentos vigentes

1. Recodificar `protocol/` con Etapa 4 (dimensiones y datos esenciales por perfil), Etapa 7 (banco con especificidades, preguntas alternativas y equivalencias) y Etapa 9 (orden, límites, ramas del tamizaje, requisitos del informe). `npm run validar-protocolo`.
2. Si la Etapa 9 define reglas que no son expresables con los parámetros actuales (p. ej. condiciones entre dimensiones, ramas de tamizaje anidadas, prioridades por gravedad), se agregan como nuevos campos del protocolo y su interpretación en `motor.js`, con pruebas unitarias propias.
3. Reemplazar/completar `prompts/` con el prompt de entrevista y el archivo de automatización.
4. Actualizar el caso ficticio (`test/fixtures`) y volver a correr `npm run test:evidencia` y `npm run demo`.

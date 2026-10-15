# Arquitectura

## Principio rector

> El **software** controla el estado, la persistencia, las transiciones y las validaciones críticas con reglas deterministas y auditables. (Brief §10)

El sistema separa **contenido clínico (datos)** de **mecanismo (código)**:

- `protocol/protocolo.json` contiene el contenido de los documentos vigentes: 18 síntomas DSM-5-TR (Etapa 4), banco A01–A66 y anexos 7-C/D/E/F (Etapa 7), barrido y tamizaje, áreas funcionales, sugerencias y referencias (Etapa 9), fases de la entrevista (automatización). Se **genera** desde los .docx con `scripts/construir_protocolo.py`; cada elemento conserva su `origen`.
- `src/` contiene el mecanismo que ejecuta las reglas de la Etapa 9 sobre ese contenido.

## Componentes (brief §10)

| Componente solicitado | Implementación |
|---|---|
| Interfaz de entrevista y expediente | `public/` — PWA sin framework (instalable; el service worker solo cachea la interfaz) |
| Backend que controla el flujo | `src/servicio.js` — orquesta cada transición dentro de una transacción |
| Búsqueda bibliográfica en internet | `src/bibliografia.js` — Europe PMC y PubMed (API públicas, sin clave); caché; filtro de datos personales; referencias del caso en el informe |
| Consentimiento y privacidad | `src/privacidad.js`, `public/privacidad.html`, `public/terminos.html` |
| Motor de decisiones Etapa 9 | `src/motor.js` — funciones puras sobre el contexto del expediente |
| Validador | `src/validador.js` — 17 reglas antes de mostrar cualquier pregunta |
| Esquema de datos y validación de respuestas | `src/db.js`, `src/expediente.js`, `src/interprete.js` |
| Base de datos persistente | SQLite integrado en Node (`node:sqlite`), modo WAL, un archivo |
| Extracción del informe escolar | `src/informeEscolar.js` (reglas con evidencia literal, o carga estructurada) |
| Integración multidimensional | `src/integracion.js` — R1–R10, puerta de suficiencia, áreas, perfiles, inferencias, sugerencias |
| Generador de informes | `src/informe.js` — 19 secciones, solo desde el expediente; bloqueo por requisitos |
| Acceso | `src/acceso.js` — clave creada en el primer ingreso (scrypt) o `APP_ACCESS_TOKEN`; bloqueo por intentos |
| Respaldos | `src/respaldo.js` — `VACUUM INTO` diario |
| Auditoría y errores | tablas `decisiones` y `errores`; pestaña «Auditoría» |

## Ciclo de decisión (brief §4; Etapa 9 §C)

```
POST /respuestas
 1. Verifica que la respuesta corresponde a la pregunta VIGENTE (si no → 409)
 2. Interpreta: alternativa (A, B, …), selección múltiple o texto libre (intérprete de reglas)
 3. Transacción:
    a. guarda la respuesta literal
    b. agrega el hecho con su fuente y evidencia; contradicción en la misma fuente → registrada
    c. menciones espontáneas de conductas → «evidencia relacionada» (no confirman el síntoma)
    d. discrepancias entre fuentes (Sí / No) → registradas sin resolver
    e. AVANZAR:
       - determina la ruta (Ruta B con informe disponible; Ruta A en otro caso) y la justifica
       - necesidades(): lista priorizada de lo que falta
           F1 fase inicial estricta
           PRIORIDAD: activación inmediata de menciones y profundización de síntomas presentes
           F2/F3 cobertura individual de los 18 síntomas + bloques de funciones ejecutivas
           F4 lo escolar según la ruta · F5/F8 desarrollo, contexto, trayectoria, impacto
           F7 barrido diferencial y sus ramas → F6 tamizaje médico, sensorial y del sueño
       - cada candidata pasa por el VALIDADOR; las descartadas se auditan y se prueba la siguiente
       - persiste la pregunta y su justificación; o espera el informe (Ruta B); o cierra con el gate
 4. Devuelve la TRAZA: entrada, interpretación, estado anterior, decisión, pregunta, estado posterior
```

### Estados

**Dato:** `sin_dato` · `valor` · `no_sabe` · `no_recuerda` · `ambiguo` · `no_informado`. «No sé» y «no recuerdo» jamás se convierten en «no».

**Síntoma (Etapa 9 §14.1):** APOYADO POR EVIDENCIA · PROBABLE · POSIBLE · EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN · CONTRADICTORIO · INFORMACIÓN INSUFICIENTE · NO REFERIDO · DESCONOCIDO · NO INFORMADO.

**Barrido / tamizaje (Etapa 9 §H):** NO_REALIZADO · EN_CURSO · COMPLETADO · COMPLETADO_CON_INCERTIDUMBRE · CUBIERTO_POR_FUENTE; resultados EXPLORADO_SIN_DIFICULTADES_REPORTADAS · HALLAZGOS_REPORTADOS · INCERTIDUMBRE · NO_APLICA · NO_DETERMINADO.

**Caso:** `fase_inicial` → `entrevista` → `esperando_informe_escolar` / `entrevista_completa` → `informe_final` → `validado`.

### Reglas principales del motor

- Presencia «Sí» → como máximo 3 preguntas: frecuencia, desde cuándo, contextos (Etapa 9 §14). «No» → no se profundiza. «Ocasionalmente» → solo se cuantifica la frecuencia (§6.2). «No sabe» → DESCONOCIDO.
- R1.4 tiene dos preguntas del banco (instrucciones / finalización); basta una positiva para establecer la presencia.
- Una conducta mencionada activa la pregunta del banco más parecida a lo mencionado (§14.2).
- Equivalencias funcionales: una pregunta respondida resuelve sus equivalentes (p. ej. A56 ≡ tamizaje D).
- Ruta B: lo escolar no se pregunta en el hogar hasta tener el informe; luego, solo lo que el informe no cubre. Las preguntas del Anexo 7-C cubiertas por el informe no se envían al colegio.
- Barrido: «Ninguna» y «No sabe» son excluyentes; cada área marcada abre su rama; Sueño, Audición, Visión y Salud derivan categorías del tamizaje. «Ninguna» en el tamizaje no anula lo derivado.
- Gate de cierre: fase inicial completa, barrido COMPLETADO, tamizaje completo y ningún síntoma con información pendiente.

## Validador (brief §6; Etapa 9 §C y §L)

`una_sola_pregunta`, `pertenece_al_proyecto`, `fuente`, `alternativas`, `orden_inicial`, `condicion`, `informacion_no_resuelta`, `no_utilizada`, `no_equivalente`, `sintoma_no_establecido`, `maximo_profundizacion`, `necesaria`, `ruta_informe_escolar`, `rama_abierta`, `orden_barrido_tamizaje`, `minima_suficiente`, `opcion_excluyente`.

Las preguntas propuestas desde fuera del motor entran por `POST /api/casos/:id/propuestas`, se validan y se auditan; nunca reemplazan la decisión del motor.

## Integración e informe (Etapas 4–6 y 9)

`integrar()` calcula los requisitos R1–R10 (umbral 6 síntomas, 5 desde los 17 años; «varios» = 2), la puerta de suficiencia (ABIERTA / CERRADA / ABIERTA CON INCERTIDUMBRE), el tipo de resultado (INFORMACIÓN INSUFICIENTE / SOSTIENE TDAH / NO SOSTIENE TDAH / EXPLICACIÓN ALTERNATIVA), áreas funcionales comparadas con la matriz por edad de la Etapa 2, los seis perfiles (1–3 solo como marco teórico), inferencias multinivel y sugerencias con referencias [1]–[10]. El informe incluye una auditoría automática previa (9 controles) y la trazabilidad fuente → dato → pregunta → síntoma.

## Interpretación de respuestas

- Las respuestas se registran por alternativa (botones) o como texto literal; el intérprete de reglas asigna el texto a una alternativa solo cuando no hay duda y, si no, lo deja como información parcial.
- Todo el procesamiento ocurre en el servidor de la aplicación: ninguna respuesta se envía a servicios externos.

## Persistencia y recuperación (brief §5)

Todo vive en SQLite (`DB_PATH`). La pregunta vigente, su turno y su justificación se guardan en `casos.pregunta_actual`; cerrar el navegador, reiniciar el servidor o abrir otra sesión retoma el punto exacto (prueba E03/E13). Cada transición es una transacción.

## Por qué estas tecnologías

- **Node 22.13+ con `node:sqlite`:** cero dependencias de terceros y cero servicios externos; un archivo de base de datos fácil de respaldar.
- **PWA sin framework:** la interfaz no contiene lógica clínica; instalable en escritorio y móvil.
- **Pruebas con `node:test`:** sin dependencias, con reporte JUnit.

## Cómo actualizar el protocolo

1. Reemplazar el documento en `protocol/fuentes/` y regenerar su texto (`pandoc archivo.docx -t plain`).
2. `python3 scripts/construir_protocolo.py` → `protocol/protocolo.json`.
3. `npm run validar-protocolo` y `npm test`.
4. Registrar cualquier contradicción nueva en `DOCUMENTOS_Y_CONTRADICCIONES.md`.

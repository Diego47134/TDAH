# Evidencia E2E — informe-y-adversos

Generado: 2026-10-15T16:15:53.906Z

## E11 · Informe desde el expediente — **APROBADA**

Requisito: Cada sección proviene del expediente; incertidumbres y contradicciones visibles; sin interpretación automática.

### Paso 1

- **entrada:** Apoderado: HIP-MOT «No»; informe: «Es inquieto»
- **accion_resultante:** «presencia» registrado como «no» (fuente: apoderado) y luego como «si» (fuente: informe_escolar).
- **esperado:** Contradicción registrada sin resolverla
- **ok:** true

### Paso 2

- **entrada:** Generación del informe final
- **accion_resultante:** Motivo literal, edad, evidencia escolar, instrumentos, «No recuerda», contradicción revisada, RV pendiente
- **esperado:** Todo trazable al expediente
- **ok:** true

### Paso 3

- **entrada:** Validación profesional
- **accion_resultante:** Estado: validado
- **ok:** true

## E12 · Bloqueos — **APROBADA**

Requisito: Preguntas fuera del banco, fuera de orden, dobles o equivalentes; respuestas a una pregunta no vigente; informe prematuro.

### Paso 1

- **entrada:** Inventada: «¿Su hijo tiene TDAH?»
- **decision_motor:** Validador
- **accion_resultante:** autorizada: La pregunta no pertenece al banco autorizado del protocolo.
- **esperado:** Bloqueada (autorizada)
- **ok:** true

### Paso 2

- **entrada:** Fuera de orden (dimensión durante la fase inicial): «¿Le cuesta quedarse quieto en situaciones en que se espera que lo esté, como en la mesa o en clases?»
- **decision_motor:** Validador
- **accion_resultante:** orden_inicial: No se pueden explorar dimensiones antes de completar motivo, edad, informe escolar y ruta.
- **esperado:** Bloqueada (orden_inicial)
- **ok:** true

### Paso 3

- **entrada:** Texto alterado de una pregunta autorizada: «¿Por qué vino y qué edad tiene?»
- **decision_motor:** Validador
- **accion_resultante:** autorizada: El texto difiere del autorizado para INI-MOTIVO.
- **esperado:** Bloqueada (autorizada)
- **ok:** true

### Paso 4

- **entrada:** Doble pregunta: «¿Se distrae? ¿Y duerme bien?»
- **decision_motor:** Validador
- **accion_resultante:** una_sola_pregunta: Contiene 2 preguntas. | autorizada: La pregunta no pertenece al banco autorizado del protocolo.
- **esperado:** Bloqueada (una_sola_pregunta)
- **ok:** true

### Paso 5

- **entrada:** Respuesta enviada para INI-EDAD cuando la vigente es INI-MOTIVO
- **accion_resultante:** HTTP 409
- **esperado:** Rechazada
- **ok:** true

### Paso 6

- **entrada:** Informe final al inicio
- **accion_resultante:** HTTP 409: Evaluación pendiente: no se puede generar el informe final.
- **estado_despues:** `["fase_inicial_completa","entrevista_cerrada","tamizaje_completo","instrumentos_obligatorios","interpretacion_profesional"]`
- **esperado:** Bloqueado con lista de faltantes
- **ok:** true

## A1 · Ambigüedad — **APROBADA**

Requisito: «A veces» no se convierte en sí ni en no.

### Paso 1

- **entrada:** `{"pregunta":"INA-OLV-P1 — ¿Suele olvidar cosas de la rutina diaria o perder objetos que necesita (útiles, ropa, llaves)?","respuesta":"Depende del día"}`
- **estado_antes:** `{"turno":6,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Consulta general","edad":"7","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-OLV-P2","justificacion":"La respuesta sobre «presencia» de «Olvidos y pérdida de objetos» fue ambigua; se formula una pregunta más específica en lugar de suponer."}`
- **interpretacion:** `{"clasificacion":"ambiguo","estado_dato":"ambiguo","valor":null,"interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: En el último mes, ¿cuántas veces aproximadamente olvidó o perdió algo importante para el colegio?
- **estado_despues:** `{"turno":7,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Consulta general","edad":"7","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:parcial","contradicciones_abiertas":0}`
- **esperado:** Pregunta más específica del mismo dato
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"INA-OLV-P2 — En el último mes, ¿cuántas veces aproximadamente olvidó o perdió algo importante para el colegio?","respuesta":"Más o menos"}`
- **estado_antes:** `{"turno":7,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Consulta general","edad":"7","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:parcial","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"HIP-MOT-P1","justificacion":"Dimensión obligatoria pendiente «Inquietud motora» (hiperactividad): no hay datos en el expediente desde ninguna fuente."}`
- **interpretacion:** `{"clasificacion":"ambiguo","estado_dato":"ambiguo","valor":null,"interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: ¿Le cuesta quedarse quieto en situaciones en que se espera que lo esté, como en la mesa o en clases?
- **estado_despues:** `{"turno":8,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Consulta general","edad":"7","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:parcial","contradicciones_abiertas":0}`
- **esperado:** Sin más preguntas específicas: queda parcial (ambigua) y avanza
- **ok:** true

## A2 · Contradicción — **APROBADA**

Requisito: Datos que se contradicen no se resuelven por suposición.

### Paso 1

- **entrada:** `{"pregunta":"INA-SOST-P1 — ¿Le cuesta mantener la atención en lo que está haciendo, por ejemplo en tareas o juegos?","respuesta":"Sí, mucho"}`
- **estado_antes:** `{"turno":4,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Consulta","edad":"9","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-SOST-FRECUENCIA","justificacion":"Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia»."}`
- **interpretacion:** `{"clasificacion":"si","estado_dato":"valor","valor":"si","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: Respecto de la distracción o pérdida de atención: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.
- **estado_despues:** `{"turno":5,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Consulta","edad":"9","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:en_curso","contradicciones_abiertas":0}`
- **esperado:** Presencia sí
- **ok:** true

### Paso 2

- **entrada:** Extracción estructurada contradictoria (presencia «no» con evidencia)
- **accion_resultante:** «presencia» registrado como «si» (fuente: apoderado) y luego como «no» (fuente: informe_escolar).
- **estado_despues:** Presencia: contradicción; requisito contradicciones_revisadas = false
- **esperado:** Registrada, no resuelta
- **ok:** true

## A3 · Error de API — **APROBADA**

Requisito: Caída, tiempo agotado o JSON inválido de la IA no detienen la entrevista ni corrompen el expediente.

### Paso 1

- **entrada:** `{"pregunta":"INI-MOTIVO — Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.","respuesta":"Se distrae mucho"}`
- **estado_antes:** `{"turno":1,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"sin_dato","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-EDAD","justificacion":"Secuencia inicial obligatoria (paso 2): «Edad (años)»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Se distrae mucho","interprete":"reglas (contingencia)","menciones":[{"dimension_id":"INA-SOST","palabra_clave":"se distrae","evidencia":"Se distrae mucho"}]}`
- **accion_resultante:** Pregunta: ¿Qué edad tiene la persona evaluada?
- **estado_despues:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Falla «red caída» → contingencia y error auditado (Fallo de red o API: ECONNRESET)
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"INI-MOTIVO — Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.","respuesta":"Se distrae mucho"}`
- **estado_antes:** `{"turno":1,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"sin_dato","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-EDAD","justificacion":"Secuencia inicial obligatoria (paso 2): «Edad (años)»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Se distrae mucho","interprete":"reglas (contingencia)","menciones":[{"dimension_id":"INA-SOST","palabra_clave":"se distrae","evidencia":"Se distrae mucho"}]}`
- **accion_resultante:** Pregunta: ¿Qué edad tiene la persona evaluada?
- **estado_despues:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Falla «HTTP 529» → contingencia y error auditado (API respondió 529)
- **ok:** true

### Paso 3

- **entrada:** `{"pregunta":"INI-MOTIVO — Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.","respuesta":"Se distrae mucho"}`
- **estado_antes:** `{"turno":1,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"sin_dato","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-EDAD","justificacion":"Secuencia inicial obligatoria (paso 2): «Edad (años)»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Se distrae mucho","interprete":"reglas (contingencia)","menciones":[{"dimension_id":"INA-SOST","palabra_clave":"se distrae","evidencia":"Se distrae mucho"}]}`
- **accion_resultante:** Pregunta: ¿Qué edad tiene la persona evaluada?
- **estado_despues:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Falla «JSON inválido» → contingencia y error auditado (La respuesta de la IA no contiene JSON)
- **ok:** true

### Paso 4

- **entrada:** `{"pregunta":"INI-MOTIVO — Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.","respuesta":"Se distrae mucho"}`
- **estado_antes:** `{"turno":1,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"sin_dato","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-EDAD","justificacion":"Secuencia inicial obligatoria (paso 2): «Edad (años)»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Se distrae mucho","interprete":"reglas (contingencia)","menciones":[{"dimension_id":"INA-SOST","palabra_clave":"se distrae","evidencia":"Se distrae mucho"}]}`
- **accion_resultante:** Pregunta: ¿Qué edad tiene la persona evaluada?
- **estado_despues:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Falla «clasificación fuera de esquema» → contingencia y error auditado (Clasificación fuera del esquema)
- **ok:** true

## A4 · IA acotada — **APROBADA**

Requisito: La IA clasifica y detecta menciones, pero no elige preguntas; su salida se valida.

### Paso 1

- **entrada:** `{"pregunta":"INI-MOTIVO — Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.","respuesta":"Le cuesta concentrarse y no para quieto"}`
- **estado_antes:** `{"turno":1,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"sin_dato","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-EDAD","justificacion":"Secuencia inicial obligatoria (paso 2): «Edad (años)»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Le cuesta concentrarse","interprete":"ia","menciones":[{"dimension_id":"HIP-MOT","evidencia":"no para quieto"}]}`
- **accion_resultante:** Pregunta: ¿Qué edad tiene la persona evaluada?
- **estado_despues:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Le cuesta concentrarse","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Mención válida registrada; dimensión inventada descartada; siguiente pregunta la decide el motor
- **ok:** true

## A5 · Validación de entradas — **APROBADA**

Requisito: El backend rechaza entradas incompletas o inválidas sin modificar el expediente.

### Paso 1

- **entrada:** Respuesta vacía
- **accion_resultante:** HTTP 400: La respuesta está vacía.
- **esperado:** HTTP 400
- **ok:** true

### Paso 2

- **entrada:** Tipo de respuesta no válido
- **accion_resultante:** HTTP 400: Tipo de respuesta no válido: tal_vez
- **esperado:** HTTP 400
- **ok:** true

### Paso 3

- **entrada:** Caso inexistente
- **accion_resultante:** HTTP 404: Caso no encontrado
- **esperado:** HTTP 404
- **ok:** true

### Paso 4

- **entrada:** Instrumento fuera del protocolo
- **accion_resultante:** HTTP 400: Instrumento no contemplado en el protocolo: OTRO
- **esperado:** HTTP 400
- **ok:** true

### Paso 5

- **entrada:** Realizada sin fecha
- **accion_resultante:** HTTP 400: Una evaluación realizada requiere fecha.
- **esperado:** HTTP 400
- **ok:** true

### Paso 6

- **entrada:** No aplica sin justificación
- **accion_resultante:** HTTP 400: «No aplica» requiere justificación en observaciones.
- **esperado:** HTTP 400
- **ok:** true

### Paso 7

- **entrada:** Cambio de ruta antes de la fase inicial
- **accion_resultante:** HTTP 409: La ruta solo puede cambiarse después de la fase inicial.
- **esperado:** HTTP 409
- **ok:** true

### Paso 8

- **entrada:** Interpretación sin profesional
- **accion_resultante:** HTTP 400: Se requiere el texto y el profesional responsable.
- **esperado:** HTTP 400
- **ok:** true

### Paso 9

- **entrada:** Informe escolar vacío
- **accion_resultante:** HTTP 400: Debe enviar el texto del informe o una extracción estructurada.
- **esperado:** HTTP 400
- **ok:** true

### Paso 10

- **entrada:** Extracción manual sin evidencia
- **accion_resultante:** HTTP 400: hechos[0]: falta evidencia (frase del informe)
- **esperado:** HTTP 400
- **ok:** true

## A6 · Cambio de ruta — **APROBADA**

Requisito: Si el informe anunciado no llega, el profesional cambia la ruta y la entrevista cubre lo escolar.

### Paso 1

- **entrada:** Cambio de ruta a «completa» con motivo
- **decision_motor:** Dimensión obligatoria pendiente «Rendimiento académico» (escolar): no hay datos en el expediente desde ninguna fuente.
- **accion_resultante:** Pregunta: ¿Tiene dificultades en su rendimiento escolar, como notas bajas o asignaturas en riesgo?
- **esperado:** Se exploran las dimensiones escolares en la entrevista
- **ok:** true

# Evidencia E2E — entrevista

Generado: 2026-10-15T16:15:52.099Z

## E01 · Orden inicial obligatorio — **APROBADA**

Requisito: Motivo → edad → informe escolar → disponibilidad → ruta, antes de cualquier dimensión.

### Paso 1

- **entrada:** `{"pregunta":"INI-MOTIVO — Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.","respuesta":"Se distrae mucho"}`
- **estado_antes:** `{"turno":1,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"sin_dato","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-EDAD","justificacion":"Secuencia inicial obligatoria (paso 2): «Edad (años)»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Se distrae mucho","interprete":"reglas","menciones":[{"dimension_id":"INA-SOST","palabra_clave":"se distrae","evidencia":"Se distrae mucho"}]}`
- **accion_resultante:** Pregunta: ¿Qué edad tiene la persona evaluada?
- **estado_despues:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Siguiente paso de la secuencia inicial
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"INI-EDAD — ¿Qué edad tiene la persona evaluada?","respuesta":"9"}`
- **estado_antes:** `{"turno":2,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"sin_dato","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-INF-EXISTE","justificacion":"Secuencia inicial obligatoria (paso 3): «Existe informe escolar»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"9","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: ¿Existe un informe escolar (del profesor jefe o del colegio) sobre la persona evaluada?
- **estado_despues:** `{"turno":3,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"9","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Siguiente paso de la secuencia inicial
- **ok:** true

### Paso 3

- **entrada:** `{"pregunta":"INI-INF-EXISTE — ¿Existe un informe escolar (del profesor jefe o del colegio) sobre la persona evaluada?","respuesta":"sí"}`
- **estado_antes:** `{"turno":3,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"9","informe_existe":"sin_dato","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INI-INF-DISP","justificacion":"Secuencia inicial obligatoria (paso 4): «Informe escolar disponible u obtenible»."}`
- **interpretacion:** `{"clasificacion":"si","estado_dato":"valor","valor":"si","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: ¿Ese informe está disponible o se puede solicitar al colegio para esta evaluación?
- **estado_despues:** `{"turno":4,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"9","informe_existe":"si","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **esperado:** Siguiente paso de la secuencia inicial
- **ok:** true

### Paso 4

- **entrada:** `{"pregunta":"INI-INF-DISP — ¿Ese informe está disponible o se puede solicitar al colegio para esta evaluación?","respuesta":"sí"}`
- **estado_antes:** `{"turno":4,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Se distrae mucho","edad":"9","informe_existe":"si","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-SOST-FRECUENCIA","justificacion":"Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia»."}`
- **interpretacion:** `{"clasificacion":"si","estado_dato":"valor","valor":"si","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: Respecto de la distracción o pérdida de atención: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.
- **estado_despues:** `{"turno":5,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Se distrae mucho","edad":"9","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:en_curso, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe","contradicciones_abiertas":0}`
- **esperado:** Siguiente paso de la secuencia inicial
- **ok:** true

## E02 · Ruta según informe escolar — **APROBADA**

Requisito: Con informe: el hogar no explora lo escolar hasta tener el informe. Sin informe: ruta completa, sin preguntar disponibilidad.

### Paso 1

- **entrada:** Caso A: informe existe y está disponible
- **decision_motor:** ruta=con_informe
- **accion_resultante:** estado=esperando_informe_escolar; preguntas ESC formuladas: 0
- **esperado:** con_informe, 0 preguntas escolares, espera el informe
- **ok:** true

### Paso 2

- **entrada:** Caso B: no existe informe
- **decision_motor:** ruta=completa
- **accion_resultante:** ESC preguntadas: ESC-REND-P1, ESC-AULA-P1
- **esperado:** completa, explora lo escolar, no pregunta disponibilidad
- **ok:** true

## E03-E13 · Persistencia y recuperación — **APROBADA**

Requisito: El expediente sobrevive al cierre del servidor y la entrevista continúa en la misma pregunta.

### Paso 1

- **entrada:** Cierre y reapertura del servidor
- **estado_antes:** `{"turno":8,"pregunta":"INA-SOST-IMPACTO","hechos":9}`
- **estado_despues:** `{"turno":8,"pregunta":"INA-SOST-IMPACTO","hechos":9}`
- **esperado:** Idénticos
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"INA-SOST-IMPACTO — Respecto de la distracción o pérdida de atención: ¿de qué manera afecta su vida diaria (tareas, familia, amistades)?","respuesta":"Las tareas le toman el doble de tiempo y hay discusiones en la casa"}`
- **estado_antes:** `{"turno":8,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:en_curso, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:en_curso","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"FUN-FAMILIA-DESCRIPCION","justificacion":"Profundización: «Funcionamiento familiar cotidiano» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: descripcion. Se pregunta por «Descripción»."}`
- **interpretacion:** `{"clasificacion":"valor","estado_dato":"valor","valor":"Las tareas le toman el doble de tiempo y hay discusiones en la casa","interprete":"reglas","menciones":[{"dimension_id":"FUN-FAMILIA","palabra_clave":"discusiones","evidencia":"Las tareas le toman el doble de tiempo y hay discusiones en la casa"}]}`
- **accion_resultante:** Pregunta: Respecto de la convivencia familiar: ¿podría describir en qué consiste y cómo ha sido?
- **estado_despues:** `{"turno":9,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, FUN-FAMILIA:en_curso, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:en_curso","contradicciones_abiertas":0}`
- **esperado:** Continúa desde la pregunta pendiente antes de la interrupción
- **ok:** true

### Paso 3

- **entrada:** Se completa la entrevista tras la reapertura
- **accion_resultante:** esperando_informe_escolar
- **esperado:** Sin repeticiones
- **ok:** true

## E04 · Adaptación a la respuesta — **APROBADA**

Requisito: Misma pregunta, respuestas distintas → siguiente pregunta distinta.

### Paso 1

- **entrada:** `{"pregunta":"HIP-MOT-P1 — ¿Le cuesta quedarse quieto en situaciones en que se espera que lo esté, como en la mesa o en clases?","respuesta":"Sí, todo el tiempo"}`
- **estado_antes:** `{"turno":13,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:resuelta, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:resuelta","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"HIP-MOT-FRECUENCIA","justificacion":"Profundización: «Inquietud motora» tiene presencia referida (fuente: apoderado) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia»."}`
- **interpretacion:** `{"clasificacion":"si","estado_dato":"valor","valor":"si","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: Respecto de la inquietud o el movimiento excesivo: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.
- **estado_despues:** `{"turno":14,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:resuelta, HIP-MOT:en_curso, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:resuelta","contradicciones_abiertas":0}`
- **esperado:** Profundiza en inquietud motora
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"HIP-MOT-P1 — ¿Le cuesta quedarse quieto en situaciones en que se espera que lo esté, como en la mesa o en clases?","respuesta":"No"}`
- **estado_antes:** `{"turno":13,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:resuelta, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:resuelta","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"IMP-ESPERA-P1","justificacion":"Dimensión obligatoria pendiente «Dificultad para esperar» (impulsividad): no hay datos en el expediente desde ninguna fuente."}`
- **interpretacion:** `{"clasificacion":"no","estado_dato":"valor","valor":"no","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: ¿Le cuesta esperar su turno, por ejemplo en juegos o en una fila?
- **estado_despues:** `{"turno":14,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:resuelta, INA-OLV:resuelta, HIP-MOT:resuelta, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:resuelta","contradicciones_abiertas":0}`
- **esperado:** Pasa a la siguiente dimensión pendiente
- **ok:** true

## E05 · Sin redundancia — **APROBADA**

Requisito: Datos establecidos por mención, equivalencias funcionales y reformulaciones no se vuelven a preguntar.

### Paso 1

- **entrada:** 37 preguntas formuladas
- **decision_motor:** Motivo menciona distracción y sueño; AUT-RUTINAS ambigua
- **accion_resultante:** INA-SOST-P1 formulada: false; TAM-SUENO-P1: false; AUT-RUTINAS-P2: false
- **esperado:** false, false, false (sin repeticiones)
- **ok:** true

### Paso 2

- **entrada:** Propuesta externa: «¿Necesita recordatorios para completar la tarea que comenzó?»
- **decision_motor:** Validador
- **accion_resultante:** autorizada: La pregunta no pertenece al banco autorizado del protocolo. | no_equivalente: Equivalente funcional a INA-ORG-P1 ya formulada (similitud 1.00). | no_equivalente: Pertenece al grupo de equivalencia EQ-RECORDATORIOS («Necesitar recordatorios o insistencia para terminar lo que se empieza»), ya explorado.
- **esperado:** Bloqueada: no autorizada y equivalente
- **ok:** true

### Paso 3

- **entrada:** Bloqueos registrados por el motor durante la entrevista
- **accion_resultante:** 0 bloqueos
- **ok:** true

## E06 · Profundización — **APROBADA**

Requisito: Presencia referida → se caracterizan inmediatamente los datos esenciales; el límite se supera solo con justificación.

### Paso 1

- **entrada:** `{"pregunta":"INI-INF-DISP — ¿Ese informe está disponible o se puede solicitar al colegio para esta evaluación?","respuesta":"Sí, el colegio lo puede enviar"}`
- **estado_antes:** `{"turno":4,"ruta":null,"fase_inicial_completa":false,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-SOST-FRECUENCIA","justificacion":"Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia»."}`
- **interpretacion:** `{"clasificacion":"si","estado_dato":"valor","valor":"si","interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: Respecto de la distracción o pérdida de atención: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.
- **estado_despues:** `{"turno":5,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:en_curso, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:en_curso","contradicciones_abiertas":0}`
- **esperado:** Tras la fase inicial, profundiza la conducta mencionada en el motivo
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"INA-ORG-INICIO — Respecto de la necesidad de recordatorios para terminar tareas: ¿desde qué edad o desde cuándo lo nota?","respuesta":"(botón: no_recuerdo)"}`
- **estado_antes:** `{"turno":15,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:en_curso, FUN-FAMILIA:resuelta, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:parcial","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-ORG-IMPACTO","justificacion":"Profundización: «Organización y finalización de tareas» tiene presencia referida (fuente: apoderado) y falta caracterizar: impacto. Se pregunta por «Interferencia en el funcionamiento». Se supera el límite orientativo de 4 preguntas porque falta un dato esencial. [límite 4/4 superado por dato esencial]"}`
- **interpretacion:** `{"clasificacion":"no_recuerdo","estado_dato":"no_recuerda","valor":null,"interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: Respecto de la necesidad de recordatorios para terminar tareas: ¿de qué manera afecta su vida diaria (tareas, familia, amistades)?
- **estado_despues:** `{"turno":16,"ruta":"con_informe","fase_inicial_completa":true,"iniciales":{"motivo":"Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.","edad":"8","informe_existe":"si","informe_disponible":"si"},"dimensiones_no_pendientes":"INA-SOST:resuelta, INA-ORG:en_curso, FUN-FAMILIA:resuelta, ESC-REND:pendiente_informe, ESC-AULA:pendiente_informe, TAM-SUENO:parcial","contradicciones_abiertas":0}`
- **esperado:** Supera el límite con justificación explícita
- **ok:** true

## E07 · Incertidumbre — **APROBADA**

Requisito: No sé / no recuerdo se registran como desconocidos, generan a lo sumo una alternativa y aparecen en el informe.

### Paso 1

- **entrada:** `{"pregunta":"INA-SOST-P1 — ¿Le cuesta mantener la atención en lo que está haciendo, por ejemplo en tareas o juegos?","respuesta":"(botón: no_se)"}`
- **estado_antes:** `{"turno":4,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Problemas de conducta","edad":"10","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"(ninguna)","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-SOST-P3","justificacion":"Se respondió «no sé» sobre «presencia» de «Atención sostenida»: no se interpreta como negativa; se intenta una única pregunta alternativa con un ejemplo concreto."}`
- **interpretacion:** `{"clasificacion":"no_se","estado_dato":"no_sabe","valor":null,"interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: Pensando en la última semana, ¿recuerda alguna situación concreta en que se haya distraído y no terminara algo?
- **estado_despues:** `{"turno":5,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Problemas de conducta","edad":"10","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:parcial","contradicciones_abiertas":0}`
- **esperado:** no_sabe y una única pregunta alternativa concreta
- **ok:** true

### Paso 2

- **entrada:** `{"pregunta":"INA-SOST-P3 — Pensando en la última semana, ¿recuerda alguna situación concreta en que se haya distraído y no terminara algo?","respuesta":"No me acuerdo, la verdad"}`
- **estado_antes:** `{"turno":5,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Problemas de conducta","edad":"10","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:parcial","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"INA-ORG-P1","justificacion":"Dimensión obligatoria pendiente «Organización y finalización de tareas» (inatencion): no hay datos en el expediente desde ninguna fuente."}`
- **interpretacion:** `{"clasificacion":"no_recuerdo","estado_dato":"no_recuerda","valor":null,"interprete":"reglas","menciones":[]}`
- **accion_resultante:** Pregunta: ¿Necesita recordatorios para completar una tarea que ya comenzó?
- **estado_despues:** `{"turno":6,"ruta":"completa","fase_inicial_completa":true,"iniciales":{"motivo":"Problemas de conducta","edad":"10","informe_existe":"no","informe_disponible":"sin_dato"},"dimensiones_no_pendientes":"INA-SOST:parcial","contradicciones_abiertas":0}`
- **esperado:** no_recuerda; dimensión parcial (no «ausente»); continúa
- **ok:** true

### Paso 3

- **entrada:** Informe borrador
- **accion_resultante:** Lista «Atención sostenida — Presencia: No recuerda» entre los datos desconocidos
- **esperado:** Incertidumbre visible, no negativa
- **ok:** true

## E08 · Cierre controlado — **APROBADA**

Requisito: Mientras haya dimensiones obligatorias pendientes no hay cierre ni informe final.

### Paso 1

- **entrada:** Solicitud de informe final a mitad de entrevista
- **accion_resultante:** HTTP 409: Evaluación pendiente: no se puede generar el informe final.
- **esperado:** 409 y lista de requisitos pendientes
- **ok:** true
- **estado_despues:** `["entrevista_cerrada","informe_escolar_segun_ruta","tamizaje_completo","instrumentos_obligatorios","interpretacion_profesional"]`

### Paso 2

- **entrada:** Fin de la entrevista del hogar
- **accion_resultante:** esperando_informe_escolar
- **esperado:** Solo se detiene cuando lo único pendiente es el informe escolar
- **ok:** true

## E09 · Tamizaje diferencial — **APROBADA**

Requisito: Abre solo las ramas que corresponden, sin duplicar, y distingue ausente / presente / desconocido / requiere verificación.

### Paso 1

- **entrada:** Sueño mencionado en el motivo; visión «no sé»; audición «no»
- **accion_resultante:** Preguntas de tamizaje: TAM-SUENO-DESCRIPCION, TAM-SUENO-EVALUADO_PROFESIONAL, TAM-VISION-P1, TAM-AUDICION-P1, TAM-MEDICO-P1
- **esperado:** Sueño: sin repetir presencia; ramas solo donde corresponde
- **ok:** true

### Paso 2

- **entrada:** Sección 7 del informe
- **accion_resultante:** Explicaciones alternativas que requieren consideración

_El tamizaje no constituye diagnóstico médico y no cierra otras áreas de evaluación._

- **Sueño:** Situación presente: Le cuesta dormirse y se despierta en la noche, desde hace un año. Evaluada por profesional: No sabe. **Requiere verificación profesional.**
- **Visión:** Información desconocida (No sabe). **Requiere verificación profesional.**
- **Audición:** Situación no referida.
- **Condiciones médicas y medicamentos:** Situación no referida.
- **ok:** true

## E10 · Informe escolar — **APROBADA**

Requisito: Extracción estructurada con fuente y evidencia; el hogar solo cubre vacíos.

### Paso 1

- **entrada:** Carga del informe escolar ficticio
- **accion_resultante:** INA-SOST.presencia=si; INA-SOST.contextos=Colegio (según informe escolar); INA-SOST.frecuencia=frecuentemente (según informe escolar); HIP-MOT.presencia=si; HIP-MOT.contextos=Colegio (según informe escolar); ESC-REND.presencia=si; ESC-REND.descripcion=Presenta notas bajas en Lenguaje y Matemática durante el primer semestre.
- **esperado:** Hechos con fuente informe_escolar y evidencia literal
- **ok:** true

### Paso 2

- **entrada:** Motor tras el informe
- **decision_motor:** Dimensión obligatoria pendiente «Conducta en el aula» (escolar): no hay datos en el expediente desde ninguna fuente. El informe escolar no resolvió este dato (vacío relevante).
- **accion_resultante:** Pregunta: ¿El colegio ha informado dificultades de conducta o de comportamiento en clases?
- **esperado:** Solo se pregunta lo que el informe no resolvió
- **ok:** true

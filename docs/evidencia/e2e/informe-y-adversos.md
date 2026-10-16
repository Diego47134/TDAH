# Evidencia E2E — informe-y-adversos

Generado: 2026-10-16T00:19:10.450Z

## E11 · Informe desde el expediente — **APROBADA**

Requisito: El informe se construye solo con el expediente: 19 secciones de la Etapa 9 §28.2, contraste DSM-5-TR R1–R10, evidencia literal y validación profesional.

### Paso 1

- **entrada:** Expediente completo + revisión + interpretación
- **accion_resultante:** Informe final #1 (34147 caracteres)
- **esperado:** 19 secciones con datos reales
- **ok:** true

### Paso 2

- **entrada:** Validación profesional
- **accion_resultante:** estado=validado
- **esperado:** validado
- **ok:** true

## E12 · Bloqueos — **APROBADA**

Requisito: Preguntas externas, respuestas a preguntas no vigentes e informes sin requisitos se rechazan y quedan auditados.

### Paso 1

- **entrada:** Pregunta externa / respuesta fuera de turno / informe prematuro
- **accion_resultante:** Pregunta descartada por el validador; el motor mantiene su alternativa autorizada. · HTTP 409 · HTTP 409
- **esperado:** Todo bloqueado y auditado
- **ok:** true

## A1 · Ambigüedad — **APROBADA**

Requisito: Una respuesta libre que no corresponde a ninguna alternativa queda como ambigua y no se convierte en Sí ni No.

### Paso 1

- **entrada:** `{"pregunta":"A09 — ¿Se distrae fácilmente con estímulos que ocurren alrededor?","respuesta":"mmm"}`
- **estado_antes:** `{"turno":5,"estado_global":"entrevista","ruta":"con_informe","edad":8,"fase_inicial_completa":true,"sintomas":"R1.8:EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN","barrido":"NO_REALIZADO","tamizaje":"NO_REALIZADO","contradicciones_abiertas":0}`
- **decision_motor:** `{"accion":"preguntar","pregunta_id":"R1.8-FRECUENCIA","justificacion":"Profundización del síntoma R1.8 «Se distrae fácilmente» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad)."}`
- **interpretacion:** `{"clasificacion":"ambiguo","estado_dato":"ambiguo","valor":null,"menciones":[]}`
- **accion_resultante:** Pregunta: Sobre «se distrae fácilmente con estímulos que ocurren alrededor»: ¿Con qué frecuencia sucede?
- **estado_despues:** `{"turno":6,"estado_global":"entrevista","ruta":"con_informe","edad":8,"fase_inicial_completa":true,"sintomas":"R1.8:EVIDENCIA RELACIONADA — REQUIERE CARACTERIZACIÓN","barrido":"NO_REALIZADO","tamizaje":"NO_REALIZADO","contradicciones_abiertas":0}`
- **esperado:** Dato ambiguo; sin supuesto
- **ok:** true

## A2 · Discrepancias — **APROBADA**

Requisito: Apoderado «Sí» vs. colegio «No» en R2.9: se conserva sin resolver por suposición y exige revisión profesional.

### Paso 1

- **entrada:** «Interrumpe o invade actividades de otros»: apoderado informa «Sí» y informe_escolar informa «No». Puede explicarse por contexto, demanda, observador o supervisión (Etapa 9 §11); se conserva sin resolver.
- **accion_resultante:** Revisión con nota y profesional
- **esperado:** Requisito cumplido solo tras la revisión
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
- **accion_resultante:** HTTP 400: Instrumento no contemplado en el protocolo: INVENTADO
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
- **accion_resultante:** HTTP 400: hechos[0]: falta la evidencia (frase del informe).
- **esperado:** HTTP 400
- **ok:** true

### Paso 11

- **entrada:** Pregunta de colegio inexistente
- **accion_resultante:** HTTP 400: Pregunta de colegio no válida: X99
- **esperado:** HTTP 400
- **ok:** true

### Paso 12

- **entrada:** Entrevista NNA sin edad
- **accion_resultante:** HTTP 409: Primero debe registrarse la edad.
- **esperado:** HTTP 409
- **ok:** true

## A6 · Cambio de ruta — **APROBADA**

Requisito: Si el informe anunciado no llega, el profesional cambia a Ruta A y el apoderado aporta lo escolar.

### Paso 1

- **entrada:** Cambio de ruta a «completa» con motivo
- **decision_motor:** Ruta A (Etapa 7 §5.1): el apoderado aporta lo que conozca del funcionamiento escolar (no equivale a observación del colegio).
- **accion_resultante:** Pregunta: Según lo que usted sabe del colegio: ¿Qué dificultades observa actualmente en el funcionamiento del estudiante?
- **esperado:** Se pregunta lo escolar al apoderado
- **ok:** true

## A7 · Otras fuentes — **APROBADA**

Requisito: Solo se envían al colegio las preguntas que el informe no cubre; la entrevista al niño usa el banco D (<12 años) y se puede finalizar.

### Paso 1

- **entrada:** Colegio: 7 preguntas por enviar; NNA: D04
- **accion_resultante:** Respuestas registradas con su fuente (profesor / niño)
- **esperado:** Sin preguntar lo ya cubierto
- **ok:** true

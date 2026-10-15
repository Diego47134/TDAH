# Demostración E2E — caso ficticio

Generado: 2026-10-15T15:09:07.845Z  
Datos 100 % ficticios. El guion responde según la pregunta que **elige el motor**; no es una lista fija.

Caso: **CASO-0001** (Caso ficticio A (demostración))

## 1. Entrevista al apoderado

### Turno 1 · `INI-MOTIVO`

**Pregunta:** Para comenzar, ¿cuál es el motivo de consulta? Cuénteme qué es lo que le preocupa.  
**Respuesta:** Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.  
**Interpretación:** valor = «Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas; además duerme mal.» (reglas) · menciones: INA-SOST, TAM-SUENO  
**Decisión del motor:** preguntar → `INI-EDAD`  
**Justificación:** Secuencia inicial obligatoria (paso 2): «Edad (años)».

### Turno 2 · `INI-EDAD`

**Pregunta:** ¿Qué edad tiene la persona evaluada?  
**Respuesta:** 8 años  
**Interpretación:** valor = «8» (reglas)  
**Decisión del motor:** preguntar → `INI-INF-EXISTE`  
**Justificación:** Secuencia inicial obligatoria (paso 3): «Existe informe escolar».

### Turno 3 · `INI-INF-EXISTE`

**Pregunta:** ¿Existe un informe escolar (del profesor jefe o del colegio) sobre la persona evaluada?  
**Respuesta:** Sí, la profesora jefe hizo uno  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `INI-INF-DISP`  
**Justificación:** Secuencia inicial obligatoria (paso 4): «Informe escolar disponible u obtenible».

### Turno 4 · `INI-INF-DISP`

**Pregunta:** ¿Ese informe está disponible o se puede solicitar al colegio para esta evaluación?  
**Respuesta:** Sí, el colegio lo puede enviar  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `INA-SOST-FRECUENCIA`  
**Justificación:** Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia».

### Turno 5 · `INA-SOST-FRECUENCIA`

**Pregunta:** Respecto de la distracción o pérdida de atención: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.  
**Respuesta:** Varias veces al día  
**Interpretación:** valor = «Varias veces al día» (reglas)  
**Decisión del motor:** preguntar → `INA-SOST-CONTEXTOS`  
**Justificación:** Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: contextos, inicio, impacto. Se pregunta por «Contextos en que ocurre».

### Turno 6 · `INA-SOST-CONTEXTOS`

**Pregunta:** Respecto de la distracción o pérdida de atención: ¿en qué lugares o situaciones ocurre (casa, colegio, con amigos u otros)?  
**Respuesta:** En la casa con las tareas y también lo dicen en el colegio  
**Interpretación:** valor = «En la casa con las tareas y también lo dicen en el colegio» (reglas)  
**Decisión del motor:** preguntar → `INA-SOST-INICIO`  
**Justificación:** Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: inicio, impacto. Se pregunta por «Inicio».

### Turno 7 · `INA-SOST-INICIO`

**Pregunta:** Respecto de la distracción o pérdida de atención: ¿desde qué edad o desde cuándo lo nota?  
**Respuesta:** Desde los 5 o 6 años, cuando entró a kínder  
**Interpretación:** valor = «Desde los 5 o 6 años, cuando entró a kínder» (reglas)  
**Decisión del motor:** preguntar → `INA-SOST-IMPACTO`  
**Justificación:** Profundización: «Atención sostenida» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: impacto. Se pregunta por «Interferencia en el funcionamiento».

### Turno 8 · `INA-SOST-IMPACTO`

**Pregunta:** Respecto de la distracción o pérdida de atención: ¿de qué manera afecta su vida diaria (tareas, familia, amistades)?  
**Respuesta:** Las tareas le toman el doble de tiempo y hay discusiones en la casa  
**Interpretación:** valor = «Las tareas le toman el doble de tiempo y hay discusiones en la casa» (reglas) · menciones: FUN-FAMILIA  
**Decisión del motor:** preguntar → `FUN-FAMILIA-DESCRIPCION`  
**Justificación:** Profundización: «Funcionamiento familiar cotidiano» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: descripcion. Se pregunta por «Descripción».

### Turno 9 · `FUN-FAMILIA-DESCRIPCION`

**Pregunta:** Respecto de la convivencia familiar: ¿podría describir en qué consiste y cómo ha sido?  
**Respuesta:** Las tareas generan tensión y discusiones casi a diario  
**Interpretación:** valor = «Las tareas generan tensión y discusiones casi a diario» (reglas)  
**Decisión del motor:** preguntar → `TAM-SUENO-DESCRIPCION`  
**Justificación:** Profundización: «Sueño» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: descripcion, evaluado_profesional. Se pregunta por «Descripción».

### Turno 10 · `TAM-SUENO-DESCRIPCION`

**Pregunta:** Respecto de el sueño: ¿qué ha observado exactamente y desde cuándo?  
**Respuesta:** Le cuesta dormirse y se despierta en la noche, desde hace un año  
**Interpretación:** valor = «Le cuesta dormirse y se despierta en la noche, desde hace un año» (reglas)  
**Decisión del motor:** preguntar → `TAM-SUENO-EVALUADO_PROFESIONAL`  
**Justificación:** Profundización: «Sueño» tiene presencia referida (fuente: apoderado, mención espontánea) y falta caracterizar: evaluado_profesional. Se pregunta por «Evaluado por un profesional».

### Turno 11 · `TAM-SUENO-EVALUADO_PROFESIONAL`

**Pregunta:** Respecto de el sueño: ¿lo ha evaluado algún profesional de la salud?  
**Respuesta:** (botón «no_se»)  
**Interpretación:** no_sabe (reglas)  
**Decisión del motor:** preguntar → `INA-ORG-P1`  
**Justificación:** Dimensión obligatoria pendiente «Organización y finalización de tareas» (inatencion): no hay datos en el expediente desde ninguna fuente.

### Turno 12 · `INA-ORG-P1`

**Pregunta:** ¿Necesita recordatorios para completar una tarea que ya comenzó?  
**Respuesta:** Sí, siempre hay que recordarle  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `INA-ORG-FRECUENCIA`  
**Justificación:** Profundización: «Organización y finalización de tareas» tiene presencia referida (fuente: apoderado) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia».

### Turno 13 · `INA-ORG-FRECUENCIA`

**Pregunta:** Respecto de la necesidad de recordatorios para terminar tareas: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.  
**Respuesta:** Todos los días  
**Interpretación:** valor = «Todos los días» (reglas)  
**Decisión del motor:** preguntar → `INA-ORG-CONTEXTOS`  
**Justificación:** Profundización: «Organización y finalización de tareas» tiene presencia referida (fuente: apoderado) y falta caracterizar: contextos, inicio, impacto. Se pregunta por «Contextos en que ocurre».

### Turno 14 · `INA-ORG-CONTEXTOS`

**Pregunta:** Respecto de la necesidad de recordatorios para terminar tareas: ¿en qué lugares o situaciones ocurre (casa, colegio, con amigos u otros)?  
**Respuesta:** En la casa y en el colegio  
**Interpretación:** valor = «En la casa y en el colegio» (reglas)  
**Decisión del motor:** preguntar → `INA-ORG-INICIO`  
**Justificación:** Profundización: «Organización y finalización de tareas» tiene presencia referida (fuente: apoderado) y falta caracterizar: inicio, impacto. Se pregunta por «Inicio».

### Turno 15 · `INA-ORG-INICIO`

**Pregunta:** Respecto de la necesidad de recordatorios para terminar tareas: ¿desde qué edad o desde cuándo lo nota?  
**Respuesta:** (botón «no_recuerdo»)  
**Interpretación:** no_recuerda (reglas)  
**Decisión del motor:** preguntar → `INA-ORG-IMPACTO`  
**Justificación:** Profundización: «Organización y finalización de tareas» tiene presencia referida (fuente: apoderado) y falta caracterizar: impacto. Se pregunta por «Interferencia en el funcionamiento». Se supera el límite orientativo de 4 preguntas porque falta un dato esencial. [límite 4/4 superado por dato esencial]

### Turno 16 · `INA-ORG-IMPACTO`

**Pregunta:** Respecto de la necesidad de recordatorios para terminar tareas: ¿de qué manera afecta su vida diaria (tareas, familia, amistades)?  
**Respuesta:** Llega con tareas incompletas al colegio  
**Interpretación:** valor = «Llega con tareas incompletas al colegio» (reglas)  
**Decisión del motor:** preguntar → `INA-OLV-P1`  
**Justificación:** Dimensión obligatoria pendiente «Olvidos y pérdida de objetos» (inatencion): no hay datos en el expediente desde ninguna fuente.

### Turno 17 · `INA-OLV-P1`

**Pregunta:** ¿Suele olvidar cosas de la rutina diaria o perder objetos que necesita (útiles, ropa, llaves)?  
**Respuesta:** A veces  
**Interpretación:** ambiguo (reglas)  
**Decisión del motor:** preguntar → `INA-OLV-P2`  
**Justificación:** La respuesta sobre «presencia» de «Olvidos y pérdida de objetos» fue ambigua; se formula una pregunta más específica en lugar de suponer.

### Turno 18 · `INA-OLV-P2`

**Pregunta:** En el último mes, ¿cuántas veces aproximadamente olvidó o perdió algo importante para el colegio?  
**Respuesta:** Sí, bastantes veces  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `INA-OLV-FRECUENCIA`  
**Justificación:** Profundización: «Olvidos y pérdida de objetos» tiene presencia referida (fuente: apoderado) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia».

### Turno 19 · `INA-OLV-FRECUENCIA`

**Pregunta:** Respecto de los olvidos o pérdidas de objetos: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.  
**Respuesta:** Una o dos veces por semana  
**Interpretación:** valor = «Una o dos veces por semana» (reglas)  
**Decisión del motor:** preguntar → `INA-OLV-CONTEXTOS`  
**Justificación:** Profundización: «Olvidos y pérdida de objetos» tiene presencia referida (fuente: apoderado) y falta caracterizar: contextos, inicio, impacto. Se pregunta por «Contextos en que ocurre».

### Turno 20 · `INA-OLV-CONTEXTOS`

**Pregunta:** Respecto de los olvidos o pérdidas de objetos: ¿en qué lugares o situaciones ocurre (casa, colegio, con amigos u otros)?  
**Respuesta:** Colegio, sobre todo con útiles y la colación  
**Interpretación:** valor = «Colegio, sobre todo con útiles y la colación» (reglas)  
**Decisión del motor:** preguntar → `INA-OLV-INICIO`  
**Justificación:** Profundización: «Olvidos y pérdida de objetos» tiene presencia referida (fuente: apoderado) y falta caracterizar: inicio, impacto. Se pregunta por «Inicio». Se supera el límite orientativo de 4 preguntas porque falta un dato esencial. [límite 4/4 superado por dato esencial]

### Turno 21 · `INA-OLV-INICIO`

**Pregunta:** Respecto de los olvidos o pérdidas de objetos: ¿desde qué edad o desde cuándo lo nota?  
**Respuesta:** Desde que entró al colegio  
**Interpretación:** valor = «Desde que entró al colegio» (reglas)  
**Decisión del motor:** preguntar → `INA-OLV-IMPACTO`  
**Justificación:** Profundización: «Olvidos y pérdida de objetos» tiene presencia referida (fuente: apoderado) y falta caracterizar: impacto. Se pregunta por «Interferencia en el funcionamiento». Se supera el límite orientativo de 4 preguntas porque falta un dato esencial. [límite 5/4 superado por dato esencial]

### Turno 22 · `INA-OLV-IMPACTO`

**Pregunta:** Respecto de los olvidos o pérdidas de objetos: ¿de qué manera afecta su vida diaria (tareas, familia, amistades)?  
**Respuesta:** Hay que reponer materiales y a veces le anotan  
**Interpretación:** valor = «Hay que reponer materiales y a veces le anotan» (reglas)  
**Decisión del motor:** preguntar → `HIP-MOT-P1`  
**Justificación:** Dimensión obligatoria pendiente «Inquietud motora» (hiperactividad): no hay datos en el expediente desde ninguna fuente.

### Turno 23 · `HIP-MOT-P1`

**Pregunta:** ¿Le cuesta quedarse quieto en situaciones en que se espera que lo esté, como en la mesa o en clases?  
**Respuesta:** No, en la casa es tranquilo  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** preguntar → `IMP-ESPERA-P1`  
**Justificación:** Dimensión obligatoria pendiente «Dificultad para esperar» (impulsividad): no hay datos en el expediente desde ninguna fuente.

### Turno 24 · `IMP-ESPERA-P1`

**Pregunta:** ¿Le cuesta esperar su turno, por ejemplo en juegos o en una fila?  
**Respuesta:** No  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** preguntar → `IMP-INTERR-P1`  
**Justificación:** Dimensión obligatoria pendiente «Interrupciones» (impulsividad): no hay datos en el expediente desde ninguna fuente.

### Turno 25 · `IMP-INTERR-P1`

**Pregunta:** ¿Interrumpe a otras personas cuando hablan o se mete en conversaciones o juegos ajenos?  
**Respuesta:** Sí  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `IMP-INTERR-FRECUENCIA`  
**Justificación:** Profundización: «Interrupciones» tiene presencia referida (fuente: apoderado) y falta caracterizar: frecuencia, contextos, inicio, impacto. Se pregunta por «Frecuencia».

### Turno 26 · `IMP-INTERR-FRECUENCIA`

**Pregunta:** Respecto de las interrupciones a otras personas: ¿con qué frecuencia ocurre? Por ejemplo, varias veces al día o algunas veces por semana.  
**Respuesta:** Algunas veces por semana  
**Interpretación:** valor = «Algunas veces por semana» (reglas)  
**Decisión del motor:** preguntar → `IMP-INTERR-CONTEXTOS`  
**Justificación:** Profundización: «Interrupciones» tiene presencia referida (fuente: apoderado) y falta caracterizar: contextos, inicio, impacto. Se pregunta por «Contextos en que ocurre».

### Turno 27 · `IMP-INTERR-CONTEXTOS`

**Pregunta:** Respecto de las interrupciones a otras personas: ¿en qué lugares o situaciones ocurre (casa, colegio, con amigos u otros)?  
**Respuesta:** Sobre todo en la casa, en las comidas  
**Interpretación:** valor = «Sobre todo en la casa, en las comidas» (reglas)  
**Decisión del motor:** preguntar → `IMP-INTERR-INICIO`  
**Justificación:** Profundización: «Interrupciones» tiene presencia referida (fuente: apoderado) y falta caracterizar: inicio, impacto. Se pregunta por «Inicio».

### Turno 28 · `IMP-INTERR-INICIO`

**Pregunta:** Respecto de las interrupciones a otras personas: ¿desde qué edad o desde cuándo lo nota?  
**Respuesta:** No sé  
**Interpretación:** no_sabe (reglas)  
**Decisión del motor:** preguntar → `IMP-INTERR-IMPACTO`  
**Justificación:** Profundización: «Interrupciones» tiene presencia referida (fuente: apoderado) y falta caracterizar: impacto. Se pregunta por «Interferencia en el funcionamiento». Se supera el límite orientativo de 4 preguntas porque falta un dato esencial. [límite 4/4 superado por dato esencial]

### Turno 29 · `IMP-INTERR-IMPACTO`

**Pregunta:** Respecto de las interrupciones a otras personas: ¿de qué manera afecta su vida diaria (tareas, familia, amistades)?  
**Respuesta:** Molesta a sus hermanos, pero no es lo principal  
**Interpretación:** valor = «Molesta a sus hermanos, pero no es lo principal» (reglas)  
**Decisión del motor:** preguntar → `DES-HITOS-P1`  
**Justificación:** Dimensión obligatoria pendiente «Desarrollo temprano» (desarrollo): no hay datos en el expediente desde ninguna fuente.

### Turno 30 · `DES-HITOS-P1`

**Pregunta:** Durante sus primeros años, ¿hubo algún retraso o dificultad en el desarrollo (caminar, hablar, control de esfínter)?  
**Respuesta:** No, todo normal  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** preguntar → `TRA-EVOL-P1`  
**Justificación:** Dimensión obligatoria pendiente «Trayectoria de las dificultades» (trayectoria): no hay datos en el expediente desde ninguna fuente.

### Turno 31 · `TRA-EVOL-P1`

**Pregunta:** ¿Las dificultades que le preocupan han cambiado con el tiempo (aparecieron, aumentaron o disminuyeron en algún momento)?  
**Respuesta:** Sí, este año empeoró  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `TRA-EVOL-DESCRIPCION`  
**Justificación:** Profundización: «Trayectoria de las dificultades» tiene presencia referida (fuente: apoderado) y falta caracterizar: descripcion. Se pregunta por «Descripción».

### Turno 32 · `TRA-EVOL-DESCRIPCION`

**Pregunta:** Respecto de la evolución de las dificultades: ¿podría describir en qué consiste y cómo ha sido?  
**Respuesta:** Antes se notaba menos; con más exigencia escolar aumentaron las dificultades  
**Interpretación:** valor = «Antes se notaba menos; con más exigencia escolar aumentaron las dificultades» (reglas)  
**Decisión del motor:** preguntar → `AUT-RUTINAS-P1`  
**Justificación:** Dimensión obligatoria pendiente «Autonomía en rutinas» (autonomia): no hay datos en el expediente desde ninguna fuente.

### Turno 33 · `AUT-RUTINAS-P1`

**Pregunta:** ¿Tiene dificultades para realizar solo sus rutinas esperables para su edad (vestirse, asearse, preparar sus cosas)?  
**Respuesta:** Sí, hay que ayudarlo a vestirse y preparar la mochila  
**Interpretación:** valor = «si» (reglas)  
**Decisión del motor:** preguntar → `AUT-RUTINAS-DESCRIPCION`  
**Justificación:** Profundización: «Autonomía en rutinas» tiene presencia referida (fuente: apoderado) y falta caracterizar: descripcion. Se pregunta por «Descripción».

### Turno 34 · `AUT-RUTINAS-DESCRIPCION`

**Pregunta:** Respecto de la autonomía en las rutinas del hogar: ¿podría describir en qué consiste y cómo ha sido?  
**Respuesta:** Necesita supervisión diaria para las rutinas de la mañana  
**Interpretación:** valor = «Necesita supervisión diaria para las rutinas de la mañana» (reglas)  
**Decisión del motor:** preguntar → `FUN-PARES-P1`  
**Justificación:** Dimensión obligatoria pendiente «Relación con pares» (funcionamiento): no hay datos en el expediente desde ninguna fuente.

### Turno 35 · `FUN-PARES-P1`

**Pregunta:** ¿Tiene dificultades para hacer o mantener amistades con niños de su edad?  
**Respuesta:** No, tiene amigos  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** preguntar → `TAM-VISION-P1`  
**Justificación:** Dimensión obligatoria pendiente «Visión» (tamizaje): no hay datos en el expediente desde ninguna fuente.

### Turno 36 · `TAM-VISION-P1`

**Pregunta:** ¿Ha notado alguna dificultad para ver, por ejemplo acercarse mucho a los textos o entrecerrar los ojos?  
**Respuesta:** No  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** preguntar → `TAM-AUDICION-P1`  
**Justificación:** Dimensión obligatoria pendiente «Audición» (tamizaje): no hay datos en el expediente desde ninguna fuente.

### Turno 37 · `TAM-AUDICION-P1`

**Pregunta:** ¿Ha notado alguna dificultad para oír, como pedir que le repitan seguido o subir mucho el volumen?  
**Respuesta:** No  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** preguntar → `TAM-MEDICO-P1`  
**Justificación:** Dimensión obligatoria pendiente «Condiciones médicas y medicamentos» (tamizaje): no hay datos en el expediente desde ninguna fuente.

### Turno 38 · `TAM-MEDICO-P1`

**Pregunta:** ¿Tiene alguna condición médica diagnosticada o toma algún medicamento de forma regular?  
**Respuesta:** No  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** esperar_informe  
**Justificación:** La entrevista del hogar está completa; las dimensiones escolares se esperan del informe escolar.

> Estado tras la entrevista del hogar: **esperando_informe_escolar** — ruta «con_informe». Existe informe escolar y está disponible: la entrevista al apoderado se centra en hogar, desarrollo, trayectoria, autonomía, funcionamiento y vacíos del informe.

## 2. Informe escolar

```text
Informe de profesora jefe (documento ficticio para pruebas).
El estudiante se distrae frecuentemente durante las clases y necesita apoyo para iniciar las tareas.
Es inquieto: se para de su puesto varias veces por clase.
Presenta notas bajas en Lenguaje y Matemática durante el primer semestre.
```

Método de extracción: reglas. Datos extraídos:

- `INA-SOST.presencia` = si — «El estudiante se distrae frecuentemente durante las clases y necesita apoyo para iniciar las tareas.»
- `INA-SOST.contextos` = Colegio (según informe escolar) — «El estudiante se distrae frecuentemente durante las clases y necesita apoyo para iniciar las tareas.»
- `INA-SOST.frecuencia` = frecuentemente (según informe escolar) — «El estudiante se distrae frecuentemente durante las clases y necesita apoyo para iniciar las tareas.»
- `HIP-MOT.presencia` = si — «Es inquieto: se para de su puesto varias veces por clase.»
- `HIP-MOT.contextos` = Colegio (según informe escolar) — «Es inquieto: se para de su puesto varias veces por clase.»
- `ESC-REND.presencia` = si — «Presenta notas bajas en Lenguaje y Matemática durante el primer semestre.»
- `ESC-REND.descripcion` = Presenta notas bajas en Lenguaje y Matemática durante el primer semestre. — «Presenta notas bajas en Lenguaje y Matemática durante el primer semestre.»

Contradicciones detectadas: «presencia» registrado como «no» (fuente: apoderado) y luego como «si» (fuente: informe_escolar).

El motor reabre la entrevista solo para el vacío: `ESC-AULA-P1` — Dimensión obligatoria pendiente «Conducta en el aula» (escolar): no hay datos en el expediente desde ninguna fuente. El informe escolar no resolvió este dato (vacío relevante).

### Entrevista de vacíos

### Turno 39 · `ESC-AULA-P1`

**Pregunta:** ¿El colegio ha informado dificultades de conducta o de comportamiento en clases?  
**Respuesta:** No que yo sepa, nunca nos han dicho nada  
**Interpretación:** valor = «no» (reglas)  
**Decisión del motor:** cerrar  
**Justificación:** Todas las dimensiones obligatorias están exploradas (resueltas, parciales o no aplicables).

## 3. Instrumentos

- ESCALA-APODERADO: realizada (2026-10-10)
- ESCALA-DOCENTE: realizada (2026-10-12)
- NESPLORA: realizada (2026-10-14)
- RV-PROPIA: no realizada (opcional; queda como pendiente en el informe)

## 4. Bloqueo de informe prematuro

Intento de informe final antes de la revisión profesional → POST /api/casos/533e3468-62d9-4503-9548-07f2235f27b3/informes → 409: Evaluación pendiente: no se puede generar el informe final.

## 5. Revisión profesional

- Contradicción revisada: «presencia» registrado como «no» (fuente: apoderado) y luego como «si» (fuente: informe_escolar).
- Interpretación clínica registrada por el profesional (texto de demostración).

## 6. Informe final

Generado y validado. Ver [informe-final.md](informe-final.md).

## 7. Auditoría

| Tipo de decisión | Cantidad |
|---|---|
| caso_creado | 1 |
| pregunta_seleccionada | 39 |
| respuesta_registrada | 39 |
| mencion_detectada | 2 |
| ruta_determinada | 1 |
| espera_informe_escolar | 1 |
| contradiccion_registrada | 1 |
| informe_escolar_cargado | 1 |
| entrevista_cerrada | 1 |
| evaluacion_registrada | 3 |
| informe_final_bloqueado | 1 |
| contradiccion_revisada | 1 |
| interpretacion_registrada | 1 |
| informe_final_generado | 1 |
| informe_validado | 1 |

Preguntas formuladas: 39 (de 72 en el banco). Repetidas: 0.

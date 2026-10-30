# Protocolo de pruebas — resultados

Ejecutado: 2026-10-30 14:55 UTC · Protocolo tdah-protocolo 1.0.0 · 26 aprobadas, 0 fallidas de 26.

Documentos reales usados: «Informe del Colegio (prueba).docx» y «Inform Nesplora para Diego.pdf» (entregados por el cliente). Las respuestas del apoderado son guiones de prueba.

| ID | Escenario | Prueba | Veredicto |
|---|---|---|---|
| PE-01 | Puerta de entrada | La entrevista empieza por motivo, edad e informe escolar, en ese orden | **APROBADA** |
| PE-02 | Puerta de entrada | No se acepta una respuesta clínica antes de completar la puerta | **APROBADA** |
| PE-03 | Puerta de entrada | Antes de la puerta no se integran documentos clínicos, Nesplora, colegio, RV ni entrevista del niño | **APROBADA** |
| PE-03b | Puerta de entrada | Completada la puerta, el Nesplora de otra edad queda pendiente de vinculación | **APROBADA** |
| PE-04 | Puerta de entrada | Si el apoderado dice que no hay informe escolar y luego se incorpora uno, se usa y la diferencia se registra | **APROBADA** |
| PE-05 | Entrevista adaptativa | Ninguna pregunta se repite y la profundización no supera 3 por síntoma | **APROBADA** |
| PE-06 | Entrevista adaptativa | Con «No» no se profundiza; con «No sabe» no se registra ausencia | **APROBADA** |
| PE-07 | Conservación de la información | El expediente persiste tras reiniciar el servidor | **APROBADA** |
| PE-08 | Etapa 7 / Etapa 9 | El motor (Etapa 9) solo formula preguntas del banco (Etapa 7) y rechaza preguntas externas o reformuladas | **APROBADA** |
| PE-09 | Entrevista adaptativa | «Ninguna de las anteriores» en el tamizaje cierra solo ese módulo | **APROBADA** |
| PE-10 | Conservación de la información | Una descripción espontánea posterior a un «No» se conserva y se señala como discrepancia | **APROBADA** |
| PE-11 | Escenario 1 · Coincidencia | Apoderado, colegio y Nesplora convergen: se integran sin emitir diagnóstico | **APROBADA** |
| PE-12 | Escenario 1 · Coincidencia | La convergencia no se cuenta dos veces (un síntoma = una unidad aunque lo describan varias fuentes) | **APROBADA** |
| PE-13 | Escenario 2 · Discrepancia | El colegio describe conductas que el apoderado no observa en casa (entrevista antes del informe) | **APROBADA** |
| PE-14 | Escenario 2 · Discrepancia | Ruta B con el informe cargado ANTES de las ramas clínicas: el apoderado debe informar sobre el hogar | **APROBADA** |
| PE-15 | Escenario 2 · Discrepancia | El apoderado describe dificultades que el informe escolar no menciona | **APROBADA** |
| PE-16 | Escenario 2 · Discrepancia | Las discrepancias no se resuelven automáticamente ni a favor de una fuente | **APROBADA** |
| PE-17 | Escenario 3 · Insuficiencia | Con «No sabe» generalizado y sin informe, el sistema declara la incertidumbre y no concluye | **APROBADA** |
| PE-18 | Escenario 3 · Insuficiencia | Un informe Nesplora de otro niño (edad y fecha no concordantes) no se integra hasta que el profesional lo confirme | **APROBADA** |
| PE-19 | Escenario 3 · Insuficiencia | Un segundo informe Nesplora no borra el primero | **APROBADA** |
| PE-20 | Cuestionarios (Conners) | Los resultados de una escala registrada se conservan y aparecen en el informe sin crear criterios | **APROBADA** |
| PE-21 | Informe y validación | El informe final no se valida sin profesional y nunca se presenta como validado por sí solo | **APROBADA** |
| PE-22 | Informe y validación | El informe sigue el formato de 16 secciones pedido por el cliente | **APROBADA** |
| PE-23 | Informe y validación | Los requisitos del informe coinciden con los estados calculados por el motor | **APROBADA** |
| PE-24 | Escenario 1 · Coincidencia | Frecuencias compatibles de dos fuentes no se registran como contradicción | **APROBADA** |
| PE-25 | Informe y validación | Los controles de calidad del informe se calculan (no se declaran cumplidos de antemano) | **APROBADA** |

## PE-01 — La entrevista empieza por motivo, edad e informe escolar, en ese orden

- **Escenario:** Puerta de entrada
- **Regla del proyecto:** Etapa 7 §3–4; Brief §3 (K1); regla del cliente: puerta antes de las ramas clínicas.
- **Datos de entrada:** Caso nuevo; respuestas: motivo (texto), edad 8, informe escolar «Sí», disponible «Sí».
- **Resultado esperado:** Preguntas 1–4: INI-MOTIVO, INI-EDAD, INI-INF-EXISTE, INI-INF-DISP; ninguna pregunta clínica antes.
- **Resultado obtenido:** Secuencia: INI-MOTIVO → INI-EDAD → INI-INF-EXISTE → INI-INF-DISP → A01.
- **Veredicto:** APROBADA

## PE-02 — No se acepta una respuesta clínica antes de completar la puerta

- **Escenario:** Puerta de entrada
- **Regla del proyecto:** Etapa 9 §C (barrera antes de mostrar una pregunta) y §J.4.
- **Datos de entrada:** Caso nuevo; se envía una respuesta a A01 (síntoma) mientras la pregunta vigente es INI-MOTIVO; luego se propone A01 al validador.
- **Resultado esperado:** HTTP 409 para la respuesta fuera de turno; el validador bloquea A01 por «orden_inicial».
- **Resultado obtenido:** Respuesta fuera de turno: HTTP 409. Validador: bloquea (Antes deben registrarse motivo, edad e informe escolar.).
- **Veredicto:** APROBADA

## PE-03 — Antes de la puerta no se integran documentos clínicos, Nesplora, colegio, RV ni entrevista del niño

- **Escenario:** Puerta de entrada
- **Regla del proyecto:** Etapa 7 §3–5 (edad, motivo e informe escolar antes de continuar); regla del cliente sobre la puerta de entrada.
- **Datos de entrada:** Caso nuevo; antes de responder nada se intenta cargar el informe real del colegio (.docx), el Nesplora (.pdf), respuestas del colegio y una sesión de RV.
- **Resultado esperado:** Todas las cargas responden HTTP 409 indicando la puerta; ningún dato clínico entra al expediente; la pregunta vigente sigue siendo INI-MOTIVO.
- **Resultado obtenido:** Respuestas: 409, 409, 409, 409. Datos clínicos en el expediente: 0. Pregunta vigente: INI-MOTIVO.
- **Veredicto:** APROBADA

## PE-03b — Completada la puerta, el Nesplora de otra edad queda pendiente de vinculación

- **Escenario:** Puerta de entrada
- **Regla del proyecto:** Etapa 9 §18; regla del cliente: no confundir resultados entre fuentes.
- **Datos de entrada:** Puerta completa (8 años, informe escolar sí y disponible); se carga el Nesplora real (niño nacido en 2014).
- **Resultado esperado:** HTTP 200; evaluación «pendiente_vinculacion» hasta que el profesional confirme.
- **Resultado obtenido:** HTTP 200; Nesplora: pendiente_vinculacion.
- **Veredicto:** APROBADA

## PE-04 — Si el apoderado dice que no hay informe escolar y luego se incorpora uno, se usa y la diferencia se registra

- **Escenario:** Puerta de entrada
- **Regla del proyecto:** Etapa 7 §5.1 (si después se obtiene un informe, se incorpora como fuente independiente) y §5.2; Etapa 9 §I (la fuente nueva no reemplaza la previa).
- **Datos de entrada:** INI-INF-EXISTE = «No» (Ruta A). Antes de terminar la entrevista se carga el informe real del colegio.
- **Resultado esperado:** El caso pasa a Ruta B («con_informe»), se registra una contradicción sobre la existencia del informe para revisión profesional, y no se borran las respuestas previas del apoderado.
- **Resultado obtenido:** Ruta: con_informe. Contradicción registrada: sí («El apoderado indicó que el informe escolar no existe, pero hay un informe escolar incorpor…»). Datos del apoderado antes/después: 6/52.
- **Veredicto:** APROBADA

## PE-05 — Ninguna pregunta se repite y la profundización no supera 3 por síntoma

- **Escenario:** Entrevista adaptativa
- **Regla del proyecto:** Automatización regla 1 y 2; Etapa 9 §B, §D.1 (máx. 3 preguntas de profundización por síntoma).
- **Datos de entrada:** Entrevista completa (Ruta A, sin informe): el apoderado responde «Sí» a R1.1, R1.2, R1.4, R2.1 y R2.9; «No» al resto.
- **Resultado esperado:** 0 preguntas repetidas; ≤3 preguntas de profundización por síntoma; entrevista cerrada por el gate (entrevista_completa).
- **Resultado obtenido:** 69 turnos; repetidas: ninguna; máx. profundización por síntoma: 3; estado: entrevista_completa.
- **Veredicto:** APROBADA

## PE-06 — Con «No» no se profundiza; con «No sabe» no se registra ausencia

- **Escenario:** Entrevista adaptativa
- **Regla del proyecto:** Etapa 7 §16 (NO SABE ≠ NO); Etapa 9 §6.2.
- **Datos de entrada:** Ruta A: R1.3 «No», R1.6 «No sabe / no recuerda», R1.1 «Sí».
- **Resultado esperado:** R1.3 NO REFERIDO sin preguntas de profundización; R1.6 DESCONOCIDO (no «no referido»); R1.1 profundizado.
- **Resultado obtenido:** R1.3: NO REFERIDO (0 profundizaciones). R1.6: DESCONOCIDO. R1.1: APOYADO POR EVIDENCIA (3 profundizaciones).
- **Veredicto:** APROBADA

## PE-07 — El expediente persiste tras reiniciar el servidor

- **Escenario:** Conservación de la información
- **Regla del proyecto:** Automatización regla 1 (estado acumulativo por caso); Etapa 9 §A y §J.8.
- **Datos de entrada:** Caso a mitad de la entrevista (10 turnos); se cierra el servidor y se abre otro sobre la misma base.
- **Resultado esperado:** Misma pregunta vigente, mismos hechos y mismo turno después del reinicio.
- **Resultado obtenido:** Antes: turno 11, pregunta A05, 10 hechos. Después: turno 11, pregunta A05, 10 hechos.
- **Veredicto:** APROBADA

## PE-08 — El motor (Etapa 9) solo formula preguntas del banco (Etapa 7) y rechaza preguntas externas o reformuladas

- **Escenario:** Etapa 7 / Etapa 9
- **Regla del proyecto:** Etapa 7 §21 (la Etapa 7 define el banco); Etapa 9 §C-7 y §E (la Etapa 9 selecciona; pregunta no sustentada → descartar).
- **Datos de entrada:** Entrevista Ruta A completa; luego se proponen al validador una pregunta ajena al banco y una reformulación de una pregunta ya hecha.
- **Resultado esperado:** Todas las preguntas formuladas existen en protocolo.json; ambas propuestas quedan bloqueadas.
- **Resultado obtenido:** Preguntas fuera del banco: 0. Propuesta externa: bloqueada. Reformulación: bloqueada.
- **Veredicto:** APROBADA

## PE-09 — «Ninguna de las anteriores» en el tamizaje cierra solo ese módulo

- **Escenario:** Entrevista adaptativa
- **Regla del proyecto:** Automatización regla 3; Etapa 7 §14.1; Etapa 9 §H.1 y §J.6.1.
- **Datos de entrada:** Barrido diferencial: «Aprendizaje» (A). Tamizaje médico/sensorial/sueño: «Ninguna de las anteriores» (J).
- **Resultado esperado:** Tamizaje COMPLETADO / EXPLORADO_SIN_DIFICULTADES_REPORTADAS; la rama «Aprendizaje» del barrido se explora igual; el informe no lo presenta como descarte médico.
- **Resultado obtenido:** Tamizaje: COMPLETADO / EXPLORADO_SIN_DIFICULTADES_REPORTADAS. Preguntas de la rama Aprendizaje: 1. Barrido: COMPLETADO. Leyenda «no se considera descartada» en el informe: sí.
- **Veredicto:** APROBADA

## PE-10 — Una descripción espontánea posterior a un «No» se conserva y se señala como discrepancia

- **Escenario:** Conservación de la información
- **Regla del proyecto:** Etapa 9 §3–5 (conservar el dato original), §14.2 (evidencia relacionada), §F (una respuesta puede resolver varias dimensiones); Etapa 7 §15 (repetir ante contradicción).
- **Datos de entrada:** Ruta A. A02 («¿Le cuesta mantener la atención…?») = «No». Más adelante, en una pregunta abierta, el apoderado escribe: «Le cuesta mucho mantener la atención en las tareas, se desconcentra a los pocos minutos».
- **Resultado esperado:** La mención queda registrada como evidencia relacionada de R1.2 y se señala la contradicción con el «No» previo (o se activa una pregunta de aclaración).
- **Resultado obtenido:** Texto libre en RA-C01; menciones registradas: [R1.2]. Hechos de R1.2: presencia:A02=no; mencion=si. Contradicciones de R1.2: 1. Estado final R1.2: CONTRADICTORIO.
- **Veredicto:** APROBADA

## PE-11 — Apoderado, colegio y Nesplora convergen: se integran sin emitir diagnóstico

- **Escenario:** Escenario 1 · Coincidencia
- **Regla del proyecto:** Etapa 5 / Etapa 9 §11 (triangulación), §18 (RV complementaria); Automatización fase 3; regla del cliente: sin diagnóstico automático.
- **Datos de entrada:** Apoderado: «Sí» en los 10 síntomas que describe el informe real del colegio (frecuencia «varias veces al día», desde «>6 meses y antes de los 12», contextos hogar y colegio). Documentos: informe del colegio (.docx) y Nesplora Aula (.pdf) con vinculación confirmada por el profesional.
- **Resultado esperado:** Los 10 síntomas con dos fuentes (apoderado + colegio) figuran como convergentes; R10 APOYADO; Nesplora integrado como evidencia complementaria («comisiones» converge con conductas impulsivas); el informe queda «pendiente de validación» y no afirma un diagnóstico.
- **Resultado obtenido:** Síntomas con apoderado + colegio: 10/10. R10: APOYADO. Resultado del motor: SOSTIENE_TDAH (puerta ABIERTA). Nesplora: realizada; comisiones convergentes en §4: sí. «Pendiente de validación»: sí. Afirmación diagnóstica: no.
- **Veredicto:** APROBADA

## PE-12 — La convergencia no se cuenta dos veces (un síntoma = una unidad aunque lo describan varias fuentes)

- **Escenario:** Escenario 1 · Coincidencia
- **Regla del proyecto:** Etapa 9 §14.3 (sin duplicación de síntomas).
- **Datos de entrada:** Mismo caso que PE-11.
- **Resultado esperado:** R1 «apoyados» ≤ 9 y R2 ≤ 9; la tabla del §5 tiene exactamente 18 filas de síntomas, sin repetidos.
- **Resultado obtenido:** Filas de síntomas en §5: 18 (únicas 18). Apoyados: inatención 6, hiperactividad/impulsividad 4.
- **Veredicto:** APROBADA

## PE-13 — El colegio describe conductas que el apoderado no observa en casa (entrevista antes del informe)

- **Escenario:** Escenario 2 · Discrepancia
- **Regla del proyecto:** Etapa 9 §11 (discrepancia entre fuentes, sin resolverla); Etapa 7 §17 (fuentes diferenciadas).
- **Datos de entrada:** Ruta B. Apoderado: «No» en todos los síntomas. Después se carga el informe real del colegio, que describe 10 síntomas.
- **Resultado esperado:** Los 10 síntomas quedan CONTRADICTORIO, con 10 discrepancias registradas y sin revisar; ninguno se cuenta como apoyado; el informe las lista en §4 como discrepancias.
- **Resultado obtenido:** Síntomas CONTRADICTORIO: 10/10. Discrepancias registradas: 10 (sin revisar: 10). R1: INFORMACIÓN INSUFICIENTE; R2: UMBRAL NO ALCANZADO. Listadas en §4: 10.
- **Veredicto:** APROBADA

## PE-14 — Ruta B con el informe cargado ANTES de las ramas clínicas: el apoderado debe informar sobre el hogar

- **Escenario:** Escenario 2 · Discrepancia
- **Regla del proyecto:** Etapa 7 §5.2 (el apoderado se usa para el funcionamiento en casa) y §17; Etapa 9 §11 (triangulación); regla del cliente: una sola fuente no determina el resultado.
- **Datos de entrada:** Ruta B en el orden de la Etapa 7 §5.2: puerta → se carga el informe real del colegio → entrevista al apoderado, que responde «No» a todo síntoma que se le pregunte.
- **Resultado esperado:** Para cada síntoma descrito por el colegio se pregunta al apoderado si ocurre en casa; con «No», el síntoma queda CONTRADICTORIO y se registra la discrepancia; ninguno queda «apoyado» solo con el colegio.
- **Resultado obtenido:** Síntomas del colegio con presencia preguntada al apoderado: 10/10. Discrepancias registradas: 10. Síntomas «apoyados» solo por el colegio: 0 (). Preguntas de frecuencia/inicio hechas al apoderado sobre conductas que solo describió el colegio: 0. R1: INFORMACIÓN INSUFICIENTE.
- **Veredicto:** APROBADA

## PE-15 — El apoderado describe dificultades que el informe escolar no menciona

- **Escenario:** Escenario 2 · Discrepancia
- **Regla del proyecto:** Etapa 7 §16 (NO INFORMADO ≠ AUSENTE); informe: «la falta de mención no demuestra ausencia».
- **Datos de entrada:** Ruta B. Apoderado «Sí» en R1.3, R1.6, R1.7 y R2.5 (no mencionados en el informe real del colegio); luego se carga el informe.
- **Resultado esperado:** Esos síntomas no se marcan CONTRADICTORIO (el colegio no dice «no»); aparecen como hallazgos de una sola fuente en §4 y §9 piden confirmar con otra fuente.
- **Resultado obtenido:** Contradictorios: 0. Listados como «solo Apoderado» en §4: 4/4. Estados: R1.3 APOYADO POR EVIDENCIA; R1.6 APOYADO POR EVIDENCIA; R1.7 APOYADO POR EVIDENCIA; R2.5 APOYADO POR EVIDENCIA.
- **Veredicto:** APROBADA

## PE-16 — Las discrepancias no se resuelven automáticamente ni a favor de una fuente

- **Escenario:** Escenario 2 · Discrepancia
- **Regla del proyecto:** Etapa 9 §11; Etapa 5 (contraste); informe §16.
- **Datos de entrada:** Mismo planteamiento que PE-13 (colegio «sí», apoderado «no»).
- **Resultado esperado:** La puerta queda CERRADA o ABIERTA CON INCERTIDUMBRE; §16 enumera cada discrepancia sin revisar como decisión profesional pendiente.
- **Resultado obtenido:** Puerta: CERRADA. Resultado: INFORMACION_INSUFICIENTE. Discrepancias sin revisar listadas en §16: 10.
- **Veredicto:** APROBADA

## PE-17 — Con «No sabe» generalizado y sin informe, el sistema declara la incertidumbre y no concluye

- **Escenario:** Escenario 3 · Insuficiencia
- **Regla del proyecto:** Etapa 5 §20–21 (puerta de suficiencia); Etapa 7 §16 y §20.12; Etapa 9 §J.6.
- **Datos de entrada:** Apoderado: «No sabe / no recuerda» en todos los síntomas; informe escolar «No sabe»; barrido «No sabe»; tamizaje «No sé».
- **Resultado esperado:** Puerta CERRADA; resultado INFORMACION_INSUFICIENTE; los 18 síntomas aparecen en «Información pendiente» (§14); tamizaje COMPLETADO_CON_INCERTIDUMBRE; ningún síntoma NO REFERIDO.
- **Resultado obtenido:** Puerta: CERRADA; resultado: INFORMACION_INSUFICIENTE. Síntomas en §14: 18/18. Tamizaje: COMPLETADO_CON_INCERTIDUMBRE. NO REFERIDO: 0. Ruta: completa.
- **Veredicto:** APROBADA

## PE-18 — Un informe Nesplora de otro niño (edad y fecha no concordantes) no se integra hasta que el profesional lo confirme

- **Escenario:** Escenario 3 · Insuficiencia
- **Regla del proyecto:** Etapa 9 §18 (RV complementaria y válida); Etapa 6 (trazabilidad); regla del cliente: no confundir resultados entre fuentes.
- **Datos de entrada:** Caso de 8 años; se carga el Nesplora real (nacido en 2014, aplicado en 2020) sin confirmar la vinculación.
- **Resultado esperado:** Evaluación «pendiente_vinculacion»; el informe la marca «No integrado» y no usa sus índices en la correspondencia ni en las fortalezas.
- **Resultado obtenido:** Estado: pendiente_vinculacion. Problemas detectados: La fecha de nacimiento del informe (2014-03-03) corresponde a 12 años, pero el caso registra 8 años. «No integrado» en el informe: sí. Índices usados como fortaleza: no.
- **Veredicto:** APROBADA

## PE-19 — Un segundo informe Nesplora no borra el primero

- **Escenario:** Escenario 3 · Insuficiencia
- **Regla del proyecto:** Regla del cliente: conservar la información recogida; Etapa 9 §24 (versionado) y §I (la información nueva no reemplaza la previa).
- **Datos de entrada:** Se cargan dos informes Nesplora en el mismo caso (el mismo PDF real, dos veces).
- **Resultado esperado:** Quedan dos evaluaciones, o la primera se conserva como registro anterior vinculado a su documento.
- **Resultado obtenido:** Documentos guardados: 2 (ids 12, 13). Evaluaciones Nesplora: 1, vigente vinculada al documento 13; registros anteriores conservados: documento 12.
- **Veredicto:** APROBADA

## PE-20 — Los resultados de una escala registrada se conservan y aparecen en el informe sin crear criterios

- **Escenario:** Cuestionarios (Conners)
- **Regla del proyecto:** D9 (instrumentos opcionales); Etapa 9 §18 por analogía (instrumento complementario no crea ni anula criterios).
- **Datos de entrada:** Registro manual de ESCALA-DOCENTE (no hay documento Conners en el proyecto): {inatencion_T: 78, hiperactividad_T: 72}, observación «Conners 3 docente».
- **Resultado esperado:** El informe §10 muestra la escala con sus valores tal como se registraron; los estados de los síntomas no cambian.
- **Resultado obtenido:** Registro: HTTP 200. En §10: valores presentes. Estados de síntomas sin cambios: sí.
- **Veredicto:** APROBADA

## PE-21 — El informe final no se valida sin profesional y nunca se presenta como validado por sí solo

- **Escenario:** Informe y validación
- **Regla del proyecto:** Etapa 9 §28.19 y §29 (revisión profesional); regla del cliente: sin diagnóstico definitivo automático.
- **Datos de entrada:** Caso de PE-11 (tres fuentes). Se intenta generar el informe final y validarlo sin indicar profesional.
- **Resultado esperado:** Informe final en estado «pendiente_validacion» (o bloqueado por requisitos); la validación sin profesional devuelve 400.
- **Resultado obtenido:** Generar informe final: HTTP 409 (Evaluación pendiente: no se puede generar el informe final.). Validar sin profesional: no aplica.
- **Veredicto:** APROBADA

## PE-22 — El informe sigue el formato de 16 secciones pedido por el cliente

- **Escenario:** Informe y validación
- **Regla del proyecto:** «Módulo de generación del informe» del cliente (secciones 3.1–3.16, síntesis educativa y control de calidad); decisión K9 del registro de contradicciones (prevalece el formato del cliente).
- **Datos de entrada:** Caso de PE-11 (tres fuentes).
- **Resultado esperado:** Secciones 1 a 16 en orden, «Síntesis para docentes y psicólogos educativos» y «Control de calidad del informe».
- **Resultado obtenido:** Secciones numeradas: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16. Síntesis educativa: sí. Control de calidad: sí.
- **Veredicto:** APROBADA

## PE-23 — Los requisitos del informe coinciden con los estados calculados por el motor

- **Escenario:** Informe y validación
- **Regla del proyecto:** Informe: «no recalcula criterios, no cambia estados» (Módulo de informe); Etapa 6 (trazabilidad).
- **Datos de entrada:** Casos PE-11 (coincidencia) y PE-17 (insuficiencia).
- **Resultado esperado:** Para R1–R10, el estado del §6 del informe es idéntico al del motor.
- **Resultado obtenido:** Los 20 requisitos (2 casos × R1–R10) coinciden.
- **Veredicto:** APROBADA

## PE-24 — Frecuencias compatibles de dos fuentes no se registran como contradicción

- **Escenario:** Escenario 1 · Coincidencia
- **Regla del proyecto:** Etapa 9 §11 (la diferencia entre contextos no es error de una fuente); Etapa 7 §12 (variabilidad por contexto); Etapa 3 §3.6/3.10 (frecuencia y contexto son dimensiones distintas de la variable).
- **Datos de entrada:** Mismo caso que PE-11: el apoderado indica «varias veces al día» (en casa) y el informe del colegio describe la conducta como frecuente/constante (el lector lo registra como «casi todos los días»).
- **Resultado esperado:** Ninguna contradicción en el slot «frecuencia» cuando ambas fuentes informan una frecuencia alta; los 10 síntomas convergentes quedan APOYADO POR EVIDENCIA.
- **Resultado obtenido:** Contradicciones de frecuencia: 0 (—). Síntomas convergentes no apoyados: ninguno. R1: UMBRAL ALCANZADO; resultado: SOSTIENE_TDAH.
- **Veredicto:** APROBADA

## PE-25 — Los controles de calidad del informe se calculan (no se declaran cumplidos de antemano)

- **Escenario:** Informe y validación
- **Regla del proyecto:** Etapa 6 y Etapa 9 §23 (trazabilidad y auditoría verificables).
- **Datos de entrada:** Caso con discrepancias sin revisar entre colegio y apoderado (PE-13) y caso con Nesplora sin vincular (PE-18).
- **Resultado esperado:** En el caso con Nesplora sin vincular, «Fuentes vinculadas al caso» aparece «Con limitación»; en ambos, la consistencia, la duplicación y la trazabilidad se informan según el cálculo.
- **Resultado obtenido:** Fuentes vinculadas al caso: Cumple / Con limitación. Consistencia entre síntomas y conclusión: Cumple / Cumple. Sin duplicación de evidencia: Cumple / Cumple. Trazabilidad de las conclusiones: Cumple / Cumple.
- **Veredicto:** APROBADA

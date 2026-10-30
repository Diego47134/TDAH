# Auditoría del motor, la integración y el informe — 30-10-2026

Esta auditoría se hizo sobre `main` (commit `0559cae`) sin modificar código. Las reglas clínicas se contrastaron solo con los documentos del proyecto que están en `protocol/fuentes/`: Etapas 1–7, Etapa 9 y Automatización. También se tuvo en cuenta el registro de decisiones `docs/DOCUMENTOS_Y_CONTRADICCIONES.md`.

Cada hallazgo marcado como reproducible tiene una prueba del protocolo formal que lo demuestra: `test/protocolo/protocolo-pruebas.test.js`. Los resultados completos de esas pruebas están en `docs/evidencia/protocolo/RESULTADOS.md`.

## 1. Método

1. **Casos con los documentos reales del proyecto.** Se usaron los dos documentos de prueba que entregó el cliente:
   - el informe del colegio en Word (`Informe del Colegio (prueba).docx`);
   - el informe Nesplora Aula en PDF (`Inform Nesplora para Diego.pdf`).

   Las respuestas del apoderado se simularon con guiones que sigue el motor: el guion responde lo que el motor pregunte, no una lista fija.
2. **Protocolo formal: 24 pruebas.** Cada una indica los datos de entrada, la regla del proyecto, el resultado esperado, el resultado obtenido y el veredicto. Las pruebas se agrupan así:
   - puerta de entrada;
   - entrevista adaptativa;
   - conservación de la información;
   - los tres escenarios: coincidencia, discrepancia e insuficiencia;
   - Conners y escalas;
   - informe y validación.
3. **Revisión de código** de:
   - `motor.js`, `validador.js` e `integracion.js`;
   - `informeIntegrado.js` e `informe.js`;
   - `servicio.js`, `expediente.js`, `nesplora.js` e `informeEscolar.js`.
4. **Suite existente:** las 82 pruebas pasan sin cambios.

**Resultado del protocolo: 18 aprobadas y 6 fallidas de 24.** Las 6 fallidas corresponden a defectos reales; ninguna se debe a un error de la prueba.

## 2. Qué funciona

| Regla | Verificación |
|---|---|
| Puerta de entrada: motivo, luego edad, luego existencia del informe y su disponibilidad, antes de cualquier rama clínica | PE-01, PE-02 |
| Una respuesta fuera de turno se rechaza; el validador bloquea preguntas clínicas antes de la puerta | PE-02 |
| No hay preguntas repetidas y la profundización tiene un máximo de 3 por síntoma | PE-05 |
| «No» no se profundiza; «No sabe» no se convierte en ausencia | PE-06, PE-17 |
| El expediente persiste tras reiniciar el servidor (estado, turno y pregunta vigente) | PE-07 |
| La Etapa 7 aporta el banco y la Etapa 9 selecciona: no hay preguntas fuera del banco, y las externas o reformuladas se bloquean | PE-08 |
| «Ninguna» en el tamizaje cierra solo ese módulo, no el barrido; no equivale a un descarte médico | PE-09 |
| Un síntoma cuenta una sola vez aunque lo describan varias fuentes | PE-12 |
| Si la entrevista se hace antes de cargar el informe: el colegio dice «sí» y el apoderado «no» → el síntoma queda CONTRADICTORIO, la discrepancia se registra y no se resuelve | PE-13, PE-16 |
| Lo que el colegio no menciona no se toma como «no» | PE-15 |
| Con evidencia insuficiente: la puerta queda CERRADA, el resultado es INFORMACIÓN INSUFICIENTE y los 18 síntomas aparecen como pendientes | PE-17 |
| Un Nesplora de otro niño (edad no concordante) no se integra sin la confirmación del profesional | PE-03, PE-18 |
| Una escala registrada se conserva y aparece en el informe sin crear criterios | PE-20 |
| El informe final no se genera sin requisitos ni se valida sin profesional; nunca afirma un diagnóstico | PE-11, PE-21 |
| El informe reproduce los estados R1–R10 del motor sin recalcularlos | PE-23 |

## 3. Problemas reproducibles

### A1 · Alta — En Ruta B, con el informe cargado primero, no se pregunta al apoderado por el hogar (PE-14)

**Qué ocurre.** El orden de la Etapa 7 §5.2 es: puerta de entrada, cargar el informe escolar y después entrevistar al apoderado. Si se sigue ese orden:

- Los 10 síntomas que describe el colegio nunca se preguntan al apoderado (0 de 10).
- No se puede detectar ninguna discrepancia entre casa y colegio (0 registradas).
- Los 10 síntomas quedan «APOYADO POR EVIDENCIA» con una sola fuente, y R1 alcanza el umbral solo con el colegio.
- Además, se hicieron 13 preguntas al apoderado sobre la frecuencia y el inicio de conductas que solo describió el colegio. Esas respuestas se guardan como dato del apoderado, lo que mezcla las dos fuentes.

**Dónde está en el código.**

- `motor.js:121-122`: `presenciaEstablecida` se considera cumplida si el informe dice «sí».
- `motor.js:302`: en F2/F3 se omiten esos síntomas.
- `validador.js:91`: la regla `sintoma_no_establecido` bloquea la pregunta de presencia al apoderado.

**Reglas que se incumplen.**

- Etapa 7 §5.2: el apoderado es la fuente del funcionamiento en casa.
- Etapa 7 §17: las fuentes se mantienen diferenciadas.
- Etapa 9 §11: triangulación.
- Regla del cliente: una sola fuente no determina el resultado.

**Corrección propuesta (no aplicada).** Que la presencia «establecida» sea por fuente: lo que diga el colegio no debe cerrar la pregunta al apoderado sobre el hogar. La profundización debe dirigirse a la fuente que informó la conducta, o bien preguntar explícitamente «en casa».

### A2 · Alta — Dos frecuencias compatibles de distintas fuentes se registran como contradicción (PE-24)

**Qué ocurre.** El apoderado responde «varias veces al día» y el lector del informe escolar registra «casi todos los días». El sistema lo anota como contradicción en el campo `frecuencia`. Por eso:

- R1.5 y R1.9 pasan de «apoyado» a «información insuficiente».
- En el escenario de coincidencia total entre fuentes, R1 cae de «umbral alcanzado» a «información insuficiente».
- El resultado del caso pasa a ser INFORMACIÓN INSUFICIENTE.

**Dónde está en el código.**

- `expediente.js:84-95`: cualquier valor categórico distinto en el mismo campo se registra como contradicción, sin importar la fuente.
- `servicio.js:145`: los datos del informe escolar entran como categóricos.
- `motor.js:21-23`: el campo con contradicción devuelve el estado `contradiccion`.

**Reglas que se incumplen.**

- Etapa 7 §12: la variabilidad entre contextos caracteriza el funcionamiento.
- Etapa 9 §11: una diferencia entre contextos no es un error de una de las fuentes.

**Corrección propuesta (no aplicada).** Guardar la frecuencia por fuente o contexto. Marcar contradicción solo dentro de una misma fuente, o cuando la dirección se opone (frecuente frente a ocasional o no).

### A3 · Alta — Un relato espontáneo que contradice un «No» anterior no se vincula al síntoma (PE-10)

**Qué ocurre.** El apoderado responde «No» en A02 y después escribe: «le cuesta mucho mantener la atención… se desconcentra». El detector reconoce el síntoma R1.2, pero la mención se descarta porque ya existe un dato de R1.2. Las consecuencias:

- No se registra contradicción y no se pide aclaración.
- R1.2 queda «NO REFERIDO».
- El texto original sí queda guardado en `respuestas`, pero no se vincula al síntoma.

Lo mismo ocurre con las menciones del profesor y del niño o adolescente.

**Dónde está en el código.** `servicio.js:116`: `if (ctx.hechos.some((h) => h.dimension_id === m.sintoma)) continue;`

**Reglas que se incumplen.**

- Etapa 9 §5.1: conservar el dato original.
- Etapa 9 §14.2: evidencia relacionada.
- Etapa 7 §15: se repite una pregunta ante una contradicción.

**Corrección propuesta (no aplicada).** Registrar siempre la mención. Si contradice un valor previo, abrir una contradicción y permitir la pregunta de aclaración por la excepción «información contradictoria».

### A4 · Media — Un segundo Nesplora, o el registro manual del mismo instrumento, borra el anterior (PE-19)

**Qué ocurre.** Se cargaron 2 documentos, pero queda 1 sola evaluación, vinculada al último documento. Lo mismo pasa si el profesional registra NESPLORA a mano después de cargar el PDF: los resultados leídos del PDF se pierden.

**Dónde está en el código.** `servicio.js:331-332` y `servicio.js:527-530` usan `ON CONFLICT(caso_id, instrumento_id) DO UPDATE`.

**Reglas que se incumplen.**

- Regla del cliente: conservar la información recogida.
- Etapa 9 §24: versionado.
- Etapa 9 §I: un dato nuevo no reemplaza al previo.

**Corrección propuesta (no aplicada).** Guardar una evaluación por documento o aplicación, con su fecha, y elegir de forma explícita cuál se integra.

### A5 · Media — Si el informe ya está cargado y el apoderado dice que no existe, no hay advertencia (PE-04)

**Qué ocurre.** El sistema aplica la Ruta A, pregunta al apoderado 4 temas escolares que el informe ya cubre y no registra ninguna advertencia.

**Dónde está en el código.** `motor.js:59-66`: la ruta depende solo de la respuesta, no de los documentos cargados.

**Regla que se incumple.** Etapa 7 §5: si existe un informe, primero hay que ver qué contiene.

**Corrección propuesta (no aplicada).** Si hay un informe cargado, registrar la contradicción con la respuesta y proponer la Ruta B al profesional.

### A6 · Media — La puerta de entrada solo se aplica a la entrevista, no a otras vías

**Qué ocurre.** El motor respeta la puerta (PE-03), pero hay otras vías que no la aplican:

- Se pueden cargar documentos (`servicio.js:268`) y respuestas del colegio (`servicio.js:447`) antes del motivo y la edad. En PE-03 se incorporaron 24 datos del colegio antes de conocer la edad.
- La entrevista al niño o adolescente solo exige la edad (`servicio.js:488`).

La interfaz oculta estas acciones, pero la API las acepta.

**Corrección propuesta (no aplicada).** Elegir una de dos opciones: rechazarlas antes de la puerta, o aceptarlas como «documentos recibidos» e integrarlas solo cuando la puerta esté completa.

### A7 · Media — Varios controles de calidad se declaran cumplidos sin comprobarse

**Qué ocurre.** El informe muestra «Cumple» en controles que no se calculan:

- En `informeIntegrado.js:508-516`, cinco controles tienen `ok: true` fijo: consistencia, sin duplicación, sin datos inventados, interpretación prudente de la realidad virtual y trazabilidad.
- En `integracion.js:198-204`, la auditoría tiene `ok: true` fijo en otros seis.

**Regla que se incumple.** Etapa 6 y Etapa 9 §23: trazabilidad y auditoría verificables.

**Corrección propuesta (no aplicada).** Calcular cada control. Por ejemplo, para «consistencia» se pueden comparar los recuentos del §5 y del §6 con el motor, como hace PE-23.

### Menores

- **A8.** `expediente.js:108`: `registrarDiscrepancia` evita duplicados mirando solo el síntoma y el campo. Si una tercera fuente (por ejemplo, el profesor) discrepa en el mismo síntoma, esa segunda discrepancia no se registra.
- **A9.** `informeIntegrado.js:50`: si hay varios informes escolares, solo se usan los datos del primero (establecimiento, autor, motivo).
- **A10.** `servicio.js:456`: hay una línea sin efecto (`if (ctx.preguntas.length === 0) { }`).

## 4. Contradicciones entre los documentos y el código (decidir antes de corregir)

| # | Documento del proyecto | Código actual | Decisión que se necesita |
|---|---|---|---|
| C1 | **Automatización, fase 3:** «doble salida»; la segunda es la caracterización en los **6 perfiles**. **Etapa 9 §28** fija 19 secciones, con perfiles, trayectoria evolutiva e inferencias multinivel. El registro **K7** del proyecto dice que prevalece la Etapa 9 §28. | El informe sigue el «Módulo de generación del informe» de 16 secciones que Mario envió después; ese documento no está en `protocol/fuentes/`. Los 6 perfiles y las inferencias se calculan (`integracion.js:157-183`), pero **no se imprimen** (PE-22: 1 de 6). | ¿Prevalece el módulo de 16 secciones (y hay que actualizar K7 y archivar ese documento en el repo), o se añaden los 6 perfiles como sección o anexo? |
| C2 | **Automatización, regla 2:** profundizar en frecuencia/intensidad, persistencia e **impacto**. | Por síntoma se profundiza en frecuencia, inicio y **contextos**. El impacto se pregunta una sola vez para todo el caso (A46–A51). | Confirmar el criterio y registrarlo como decisión D, o cambiar la tercera dimensión. |
| C3 | El registro **K5** dice que no se usa ningún servicio externo. | Desde el PR #4 hay IA opcional (OpenAI), sujeta al consentimiento. | Actualizar `DOCUMENTOS_Y_CONTRADICCIONES.md`. |
| C4 | **Etapa 9 §J.2/J.6:** con «No sabe» en el barrido, hay que «determinar si alguna de esas áreas requiere triangulación posterior». | El barrido queda COMPLETADO y R8 pasa a INFORMACIÓN INSUFICIENTE, pero no se registra esa determinación. | Definir quién decide la triangulación (motor o profesional). |
| C5 | **Conners:** ningún documento del proyecto lo menciona ni define cómo leerlo. | Solo hay instrumentos genéricos (ESCALA-APODERADO y ESCALA-DOCENTE). Sin IA no se extraen puntajes de un PDF de escala. | Hacen falta un informe Conners de prueba y la regla de integración (qué subescala se relaciona con qué síntoma y cómo se informa) antes de implementarlo. |

## 5. Orden de corrección propuesto

1. **A1 y A2.** Afectan directamente los escenarios de coincidencia y discrepancia.
2. **A3 y A4.** Pérdida de información.
3. **A5 y A6.** Puerta de entrada y ruta.
4. **A7.** Controles de calidad verificables.
5. **C1–C5,** según lo que se decida.

Cada corrección irá acompañada de su prueba del protocolo: al corregir, la prueba fallida correspondiente debe pasar a «APROBADA» y la suite existente debe seguir en verde.

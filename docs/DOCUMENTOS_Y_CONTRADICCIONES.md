# Documentos vigentes y registro de contradicciones

El brief (§2) exige identificar las versiones vigentes de los documentos y registrar explícitamente cualquier contradicción entre ellos **antes** de programar las reglas clínicas.

## Inventario

| Documento | Función en el sistema | Versión vigente | Recibido | Codificado en |
|---|---|---|---|---|
| Modelo científico | Marco conceptual y criterios de interpretación | — | ❌ | (informe, requisitos) |
| Etapa 4 | Información a caracterizar por síntoma/dimensión | — | ❌ | `protocol/` → `dimensiones`, `perfiles` |
| Etapa 7 | Estructura de la entrevista y banco de preguntas | — | ❌ | `protocol/` → `fase_inicial`, `preguntas`, `plantillas` |
| Etapa 9 | Motor: qué falta, qué preguntar, cuándo avanzar | — | ❌ | `protocol/` → `limites`, `orden_dominios`, `grupos_equivalencia`, `requisitos_informe_final`; `src/motor.js` |
| Prompt de entrevista adaptativa | Capa de ejecución | — | ❌ | `prompts/` |
| Archivo de automatización («lenguaje») | Uso opcional según el cliente | — | ❌ | por definir |
| Módulo de tamizaje médico, sensorial y del sueño (documentos corregidos) | Barrido diferencial | — | ❌ | `protocol/` → dominio `tamizaje` |

## Contenido provisional actual

`protocol/protocolo.provisional.json` (v0.1.0-provisional) fue redactado por el equipo de desarrollo **solo para ejercitar el software**: 17 dimensiones, 72 preguntas, 1 grupo de equivalencia, 4 instrumentos. No debe usarse con pacientes. La aplicación lo advierte en la cabecera, en la lista de casos y en cada informe.

## Registro de contradicciones entre documentos

| # | Documentos | Contradicción | Resolución acordada | Fecha |
|---|---|---|---|---|
| — | — | Pendiente de recibir los documentos | — | — |

## Decisiones de diseño tomadas a falta de documentos (a confirmar)

| # | Decisión | Motivo |
|---|---|---|
| D1 | Si se responde «no sé» a la existencia del informe escolar, se aplica la ruta completa | Prioriza no perder información; no se trata como «no» (queda registrado como desconocido) |
| D2 | Una conducta mencionada espontáneamente se registra como presente (fuente apoderado, origen «mención espontánea») y se profundiza sin volver a preguntar su presencia | Brief §3 y §4: no preguntar datos ya establecidos y profundizar de inmediato |
| D3 | Tras «no sé/no recuerdo» se permite como máximo una pregunta alternativa con ejemplo concreto | Equilibrio entre no convertir incertidumbre en negativa y no insistir |
| D4 | Discrepancia entre apoderado e informe escolar se registra como contradicción que el profesional debe revisar (no se resuelve) | Brief §4: registrar sin suponer. Puede refinarse si el Modelo científico distingue «diferencia de contexto» de «contradicción» |
| D5 | Límite orientativo de 4 preguntas por dimensión y tope absoluto de 8 | Valores de ejemplo; la Etapa 9 debe fijarlos |
| D6 | Requisitos del informe final: fase inicial, entrevista cerrada, informe escolar según ruta, tamizaje, instrumentos obligatorios, contradicciones revisadas, interpretación profesional | Brief §8–§9; el protocolo aprobado debe confirmarlos |

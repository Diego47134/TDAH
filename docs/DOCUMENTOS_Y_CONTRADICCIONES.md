# Documentos vigentes y registro de contradicciones

El brief (§2) exige identificar las versiones vigentes de los documentos y registrar explícitamente cualquier contradicción entre ellos **antes** de programar las reglas clínicas. Este archivo es ese registro.

## Inventario de documentos vigentes

| Documento | Contenido | Función en el sistema | SHA-256 | Codificado en |
|---|---|---|---|---|
| `TDAH_Etapas_1-7.docx` | Etapa 1 (modelo científico y seis perfiles), Etapa 2 (trayectoria evolutiva por edad), Etapa 3, Etapa 4 (requisitos DSM-5-TR R1–R10 y 18 síntomas), Etapas 5–6 (integración y suficiencia), Etapa 7 (estructura de la entrevista, rutas A/B y Anexos 7-A a 7-G) | Contenido clínico: síntomas, banco de preguntas, rutas, preguntas al colegio y al niño/adolescente, matriz por edad | `3bf37ce137386b92…` | `protocol/protocolo.json` → `sintomas`, `banco`, `ruta_a_escolar`, `colegio`, `nino`, `adolescente`, `etapas_edad`, `trayectoria_etapa2`, `perfiles` |
| `ETAPA_9_COMPLETA_CORREGIDA_ALINEADA.docx` | Motor o «cerebro»: selección de preguntas, validador, barrido diferencial, tamizaje médico/sensorial/sueño, gate de cierre, integración, informe en 19 secciones, sugerencias y referencias | Reglas de decisión y estructura del informe | `8c14f6303c7fae4f…` | `src/motor.js`, `src/validador.js`, `src/integracion.js`, `src/informe.js`; `protocolo.json` → `barrido`, `tamizaje`, `areas`, `sugerencias`, `referencias`, `parametros` |
| `AUTOMATIZACION_TDAH_CORREGIDA_COMPLETA.docx` | «Lenguaje»: fases 1–9 de la entrevista, reglas de formato, esquema de datos e informe | Uso opcional según el cliente: orden de fases y bloques temáticos | `4d51c9271d6797b2…` | `protocolo.json` → `fases`, `bloques` |

Los archivos originales y su conversión a texto están en `protocol/fuentes/`. Autoría registrada en los metadatos de los tres documentos: Amanda Denisse Florido Cid. El protocolo se regenera con `python3 scripts/construir_protocolo.py` y se valida con `npm run validar-protocolo`; cada pregunta conserva en `origen` la sección del documento de la que proviene.

## Registro de contradicciones entre documentos

| # | Documentos | Contradicción | Resolución aplicada |
|---|---|---|---|
| K1 | Brief §3 vs. Etapa 7 / Anexo 7-G | El brief fija el orden motivo → edad → informe escolar → tipo de entrevista; el Anexo 7-G dice «la edad se registra primero». | Prevalece el brief (especificación del cliente para el software): motivo, edad, existencia del informe, disponibilidad. El motivo se formula con la pregunta abierta de la Etapa 7 §4. |
| K2 | Automatización (formato obligatorio A–E, nunca abierta) vs. Etapa 9 §G | La automatización exige selección múltiple A–E en todos los turnos; la Etapa 9 fija SÍ / NO / OCASIONALMENTE / NO SABE-NO RECUERDA para presencia y admite preguntas abiertas (motivo, descripciones). | Prevalece la Etapa 9 (el motor). Presencia con 4 alternativas; frecuencia, inicio y contextos con alternativas propias; abiertas donde la Etapa 7 las define. |
| K3 | Automatización («Etapas 1–9» de la entrevista) vs. Etapas 1–9 del proyecto | La automatización llama «Etapa 1…9» a fases de la entrevista; en el proyecto las Etapas son documentos (Etapa 9 = motor). | Se renombran como **fases F1–F9** (`protocolo.json` → `fases`), conservando su contenido. |
| K4 | Automatización (Fase 4 «integración del contexto escolar previo») vs. Etapa 7 §5 (Rutas A y B) | La automatización pregunta siempre lo escolar al apoderado; la Etapa 7 distingue Ruta B (con informe: lo escolar viene del informe) y Ruta A (sin informe: el apoderado aporta lo que sepa). | Prevalece la Etapa 7: en Ruta B no se pregunta lo escolar en el hogar hasta incorporar el informe y luego solo sus vacíos; en Ruta A se usan las preguntas RA (Anexo 7-C) con el prefijo «Según lo que usted sabe del colegio». |
| K5 | Automatización (orquestación con un servicio externo) vs. brief §10 | La automatización describe un orquestador que depende de un servicio externo de procesamiento de lenguaje. | No se usa: todo el flujo lo ejecuta el software del sistema con reglas deterministas, en el propio servidor y sin enviar datos a terceros. **Actualización (PR #4):** se incorporó IA opcional (OpenAI) solo para redactar, leer documentos e interpretar respuestas libres, con autorización expresa en el consentimiento, datos seudonimizados y verificación de su salida; el motor de reglas sigue decidiendo. |
| K6 | Automatización (orden: médico/sueño F6 antes que emocional F7) vs. Etapa 9 §J.5 | La Etapa 9 exige el barrido diferencial general antes del tamizaje médico, sensorial y del sueño. | Prevalece la Etapa 9: barrido (F7) y luego tamizaje (F6). El validador bloquea el tamizaje antes del barrido (`orden_barrido_tamizaje`). |
| K7 | Automatización (estructura de salida) vs. Etapa 9 §28.2 | Estructuras de informe distintas. | Prevalece la Etapa 9: informe en 19 secciones más identificación, auditoría automática, síntesis de fuentes y referencias. **Reemplazada por K9.** |
| K8 | Etapa 7 / Etapa 9 (Etapa 8: realidad virtual) | La Etapa 8 (realidad virtual del proyecto) se anuncia pero no fue entregada. | RV y Nesplora se registran como evidencia complementaria opcional (Etapa 9 §18): no crean ni anulan criterios. El informe declara la RV como información no disponible si no se registra. |
| K9 | Automatización fase 3 / Etapa 9 §28 (19 secciones, 6 perfiles) vs. «Módulo de generación del informe» del cliente (16 secciones) | El módulo del cliente, posterior, no incluye la sección de los seis perfiles ni las inferencias multinivel. | Decisión del cliente (30-10-2026): **prevalece el formato de 16 secciones** del cliente. Los seis perfiles y las inferencias se siguen calculando en la integración (auditoría del caso), pero no se imprimen en el informe. |

## Decisiones de implementación (no definidas explícitamente en los documentos)

| # | Decisión | Fundamento |
|---|---|---|
| D1 | «No sabe» sobre la existencia o disponibilidad del informe escolar → Ruta A | No se pierde información escolar; queda registrado como desconocido, no como «no». |
| D2 | Alternativas de frecuencia: varias veces al día / casi todos los días / algunas veces por semana / ocasionalmente / no sabe | Anexo 7-B 5 y Automatización regla 2a (frecuencia e intensidad); se requieren categorías cerradas para el contraste. |
| D3 | Alternativas de inicio: < 6 meses / > 6 meses y antes de los 12 / > 6 meses y desde los 12 (solo ≥ 12 años) / no sabe | Contraste directo de R3 (≥ 6 meses) y R4 (antes de los 12 años). |
| D4 | Máximos por bloque temático (ejecutivas 5, contexto 5, trayectoria 5, impacto 7, desarrollo 4, impulsividad funcional 1) | Etapa 9 §D: pregunta mínima suficiente; evita recorrer el Anexo 7-A por orden numérico. |
| D5 | Tamizaje: hasta 3 preguntas por categoría marcada (Anexo 7-F) | Etapa 9 §H.1: profundizar solo lo marcado, sin baterías. |
| D6 | Preguntas al colegio (Anexo 7-C) que el informe ya cubre no se envían | Brief §3 y Etapa 7 §5.2: preguntar solo vacíos. |
| D7 | Prefijo «Según lo que usted sabe del colegio:» en Ruta A | Etapa 7 §5.1: lo que aporta el apoderado no equivale a observación del colegio. |
| D8 | «Varios» síntomas (R4, R5) = al menos 2 | Lectura literal de DSM-5-TR («varios»); parámetro `varios_minimo`. |
| D9 | Todos los instrumentos son opcionales | Ningún documento fija un instrumento como obligatorio; el informe declara los no realizados. |
| D10 | Entrevista al niño/niña con el Anexo 7-D (< 12 años) y al adolescente con el 7-E (≥ 12) | Corte de edad de la Etapa 7. |
| D11 | «Ocasionalmente» en presencia → se registra y se cuantifica solo la frecuencia; el síntoma queda POSIBLE | Etapa 9 §6.2: «registrar · evaluar necesidad de profundización», sin convertirlo en batería. |
| D12 | Una mención espontánea activa la pregunta específica del banco más parecida a lo mencionado, sin confirmar el síntoma por asociación | Etapa 9 §14.2 (activación inmediata). |
| D13 | La presencia de un síntoma se establece por fuente: lo que informa el colegio no cierra la pregunta al apoderado sobre el hogar; con el apoderado solo se profundiza lo que él mismo informa | Etapa 7 §5.2 y §17; Etapa 9 §11. Permite detectar las discrepancias casa/colegio también cuando el informe se carga primero. |
| D14 | La frecuencia se guarda por fuente; frecuencias distintas en casa y en el colegio no son contradicción (solo dentro de una misma fuente). El síntoma usa la frecuencia de las fuentes que lo informan | Etapa 7 §12; Etapa 9 §11. |
| D15 | Una descripción espontánea que contradice un «No» de la misma fuente se registra siempre y abre una contradicción para revisión profesional (el síntoma queda CONTRADICTORIO) | Etapa 9 §5.1 y §14.2; Etapa 7 §15. |
| D16 | Un nuevo registro de un instrumento (otro Nesplora, registro manual) no borra el anterior: se conserva en `resultados.anteriores` y el informe usa el más reciente | Etapa 9 §24 y §I. |
| D17 | La puerta de entrada se aplica también a la API: informes escolares, Nesplora/RV, respuestas del colegio, resultados de instrumentos y entrevista del niño requieren motivo, edad e informe escolar | Etapa 7 §3–5. |
| D18 | Si hay un informe escolar incorporado se aplica la Ruta B aunque el apoderado haya dicho que no existe; la diferencia se registra como contradicción | Etapa 7 §5.1–5.2. |
| D19 | Los controles de calidad del informe y la auditoría se calculan sobre el expediente; ninguno se declara cumplido sin comprobarlo | Etapa 6; Etapa 9 §23. |

Cualquier cambio en estas decisiones se hace en `scripts/construir_protocolo.py` (contenido) o en `src/` (reglas), con su prueba correspondiente.

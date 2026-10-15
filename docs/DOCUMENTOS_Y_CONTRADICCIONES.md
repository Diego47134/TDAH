# Documentos vigentes y registro de contradicciones

El brief (§2) exige identificar las versiones vigentes de los documentos y registrar explícitamente cualquier contradicción entre ellos **antes** de programar las reglas clínicas. Este archivo es ese registro.

## Inventario de documentos vigentes

| Documento | Contenido | Función en el sistema | SHA-256 | Codificado en |
|---|---|---|---|---|
| `TDAH_Etapas_1-7.docx` | Etapa 1 (modelo científico y seis perfiles), Etapa 2 (trayectoria evolutiva por edad), Etapa 3, Etapa 4 (requisitos DSM-5-TR R1–R10 y 18 síntomas), Etapas 5–6 (integración y suficiencia), Etapa 7 (estructura de la entrevista, rutas A/B y Anexos 7-A a 7-G) | Contenido clínico: síntomas, banco de preguntas, rutas, preguntas al colegio y al niño/adolescente, matriz por edad | `3bf37ce137386b92…` | `protocol/protocolo.json` → `sintomas`, `banco`, `ruta_a_escolar`, `colegio`, `nino`, `adolescente`, `etapas_edad`, `trayectoria_etapa2`, `perfiles` |
| `ETAPA_9_COMPLETA_CORREGIDA_ALINEADA.docx` | Motor o «cerebro»: selección de preguntas, validador, barrido diferencial, tamizaje médico/sensorial/sueño, gate de cierre, integración, informe en 19 secciones, sugerencias y referencias | Reglas de decisión y estructura del informe | `8c14f6303c7fae4f…` | `src/motor.js`, `src/validador.js`, `src/integracion.js`, `src/informe.js`; `protocolo.json` → `barrido`, `tamizaje`, `areas`, `sugerencias`, `referencias`, `parametros` |
| `AUTOMATIZACION_TDAH_CORREGIDA_COMPLETA.docx` | «Lenguaje»: System Prompt Maestro, prompt de ejecución, esquema JSON, fases 1–9 de la entrevista y ejemplo de orquestador | Uso opcional según el cliente: prompts de la IA y orden de fases | `4d51c9271d6797b2…` | `prompts/`, `protocolo.json` → `fases`, `bloques` |

Los archivos originales y su conversión a texto están en `protocol/fuentes/`. Autoría registrada en los metadatos de los tres documentos: Amanda Denisse Florido Cid. El protocolo se regenera con `python3 scripts/construir_protocolo.py` y se valida con `npm run validar-protocolo`; cada pregunta conserva en `origen` la sección del documento de la que proviene.

## Registro de contradicciones entre documentos

| # | Documentos | Contradicción | Resolución aplicada |
|---|---|---|---|
| K1 | Brief §3 vs. Etapa 7 / Anexo 7-G | El brief fija el orden motivo → edad → informe escolar → tipo de entrevista; el Anexo 7-G dice «la edad se registra primero». | Prevalece el brief (especificación del cliente para el software): motivo, edad, existencia del informe, disponibilidad. El motivo se formula con la pregunta abierta de la Etapa 7 §4. |
| K2 | Automatización (formato obligatorio A–E, nunca abierta) vs. Etapa 9 §G | La automatización exige selección múltiple A–E en todos los turnos; la Etapa 9 fija SÍ / NO / OCASIONALMENTE / NO SABE-NO RECUERDA para presencia y admite preguntas abiertas (motivo, descripciones). | Prevalece la Etapa 9 (el motor). Presencia con 4 alternativas; frecuencia, inicio y contextos con alternativas propias; abiertas donde la Etapa 7 las define. La IA no elige ni redacta preguntas: solo asigna la respuesta libre a una alternativa autorizada. |
| K3 | Automatización («Etapas 1–9» de la entrevista) vs. Etapas 1–9 del proyecto | La automatización llama «Etapa 1…9» a fases de la entrevista; en el proyecto las Etapas son documentos (Etapa 9 = motor). | Se renombran como **fases F1–F9** (`protocolo.json` → `fases`), conservando su contenido. |
| K4 | Automatización (Fase 4 «integración del contexto escolar previo») vs. Etapa 7 §5 (Rutas A y B) | La automatización pregunta siempre lo escolar al apoderado; la Etapa 7 distingue Ruta B (con informe: lo escolar viene del informe) y Ruta A (sin informe: el apoderado aporta lo que sepa). | Prevalece la Etapa 7: en Ruta B no se pregunta lo escolar en el hogar hasta incorporar el informe y luego solo sus vacíos; en Ruta A se usan las preguntas RA (Anexo 7-C) con el prefijo «Según lo que usted sabe del colegio». |
| K5 | Automatización (OpenAI `gpt-4o`) vs. brief §10 | La automatización muestra un orquestador con OpenAI; el brief pide integración con «la API de IA» sin fijar proveedor. | Proveedor configurable: `IA_PROVEEDOR=anthropic` (por defecto) u `openai`; el modelo se fija con `IA_MODELO`. Sin clave, el sistema funciona completo con reglas. |
| K6 | Automatización (orden: médico/sueño F6 antes que emocional F7) vs. Etapa 9 §J.5 | La Etapa 9 exige el barrido diferencial general antes del tamizaje médico, sensorial y del sueño. | Prevalece la Etapa 9: barrido (F7) y luego tamizaje (F6). El validador bloquea el tamizaje antes del barrido (`orden_barrido_tamizaje`). |
| K7 | Automatización (estructura de salida) vs. Etapa 9 §28.2 | Estructuras de informe distintas. | Prevalece la Etapa 9: informe en 19 secciones más identificación, auditoría automática, síntesis de fuentes y referencias. |
| K8 | Etapa 7 / Etapa 9 (Etapa 8: realidad virtual) | La Etapa 8 (realidad virtual del proyecto) se anuncia pero no fue entregada. | RV y Nesplora se registran como evidencia complementaria opcional (Etapa 9 §18): no crean ni anulan criterios. El informe declara la RV como información no disponible si no se registra. |

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

Cualquier cambio en estas decisiones se hace en `scripts/construir_protocolo.py` (contenido) o en `src/` (reglas), con su prueba correspondiente.

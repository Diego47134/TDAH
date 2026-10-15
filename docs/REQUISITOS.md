# Requisitos: cumplidos y pendientes

Estado al 15-10-2026, protocolo vigente 1.0.0 (generado desde los tres documentos del proyecto). Evidencia: `docs/evidencia/` (trazas E2E y resultados JUnit) y `docs/demo/` (caso ficticio completo).

**Leyenda:** ✅ cumplido y probado · ⚠️ cumplido con una decisión de implementación registrada · ❌ pendiente

## Documentos

| | Requisito | Estado |
|---|---|---|
| ✅ | Identificar versiones vigentes y registrar contradicciones antes de programar | `DOCUMENTOS_Y_CONTRADICCIONES.md`: inventario con SHA-256, contradicciones K1–K8 y decisiones D1–D12 |
| ✅ | Etapa 9 como motor; automatización como «lenguaje» opcional | Motor en `src/`; prompts de la automatización en `prompts/` (usados solo si hay IA) |

## Brief §3–§9

| | Requisito | Dónde / prueba |
|---|---|---|
| ✅ | Secuencia inicial: motivo → edad → informe escolar → tipo de entrevista | E01, unitarias «fase inicial» |
| ✅ | Ruta B (con informe) y Ruta A (sin informe) según la Etapa 7 §5 | E02, A6, unitaria «ruta» |
| ✅ | Revisar el expediente antes de cada pregunta; no repetir datos establecidos (cualquier fuente) | E05, E10, validador `informacion_no_resuelta`, `no_utilizada` |
| ✅ | Una sola pregunta por turno, seleccionada por el motor | `motor.js`, regla `una_sola_pregunta`, E04 |
| ✅ | Adaptar la siguiente pregunta a la respuesta anterior | E04 |
| ✅ | Activación inmediata ante una conducta mencionada (Etapa 9 §14.2) | Unitaria «activación inmediata», E06 |
| ✅ | Cobertura individual de los 18 síntomas DSM-5-TR | Auditoría automática del informe; E11 |
| ✅ | Máximo 3 preguntas de profundización por síntoma (frecuencia, inicio, contextos) | E06, unitaria «profundización» |
| ✅ | No recorrer listas fijas ni agotar el banco | Demo: 84 de 222 preguntas del protocolo |
| ✅ | No repetir preguntas aunque cambie la redacción (equivalencias funcionales + similitud) | E05, unitaria «validador» |
| ✅ | Presencia con SÍ / NO / OCASIONALMENTE / NO SABE-NO RECUERDA | Unitarias del intérprete y del protocolo |
| ✅ | «No sé» / «No recuerdo» nunca como negativa | E07, unitarias |
| ✅ | Registrar contradicciones y discrepancias entre fuentes sin resolverlas por suposición | E10, E11, A2 |
| ✅ | Barrido diferencial (áreas A–N) con ramas, antes del tamizaje | E08, E09, unitaria «barrido» |
| ✅ | Tamizaje médico, sensorial y del sueño (A–K) con estados y resultados de la Etapa 9 §H.1 | E09, unitarias «gate» y «tamizaje con No sabe» |
| ✅ | Gate `PUEDE_CERRAR_ENTREVISTA` (Etapa 9 §J.2) | E08 |
| ✅ | Expediente único persistente con todos los campos del §5 | `EXPEDIENTE.md` |
| ✅ | Persistencia entre turnos, pantallas y sesiones; recuperación en el punto exacto | E03/E13 |
| ✅ | Validador previo (17 reglas) con bloqueo y alternativa | `validador.js`, E05, E12 |
| ✅ | Informe escolar: extracción estructurada con fuente y frase literal | E10 (reglas; IA opcional; carga estructurada manual) |
| ✅ | Complementación del colegio (Anexo 7-C) solo con lo no cubierto | A7 |
| ✅ | Entrevista al niño/niña (7-D) o adolescente (7-E) | A7 |
| ⚠️ | Instrumentos del protocolo (escalas, neuropsicológica, Nesplora, RV) | E11 · todos opcionales (D9) |
| ✅ | RV y Nesplora como evidencia complementaria, sin crear ni anular criterios | Informe §11 |
| ✅ | Contraste DSM-5-TR R1–R10, puerta de suficiencia y tipo de resultado | `integracion.js`, E11 |
| ✅ | Informe en 19 secciones (Etapa 9 §28.2) solo desde el expediente, con trazabilidad y referencias | E11 |
| ✅ | Bloqueo del informe final con faltantes explícitos | E08, E12 |
| ✅ | Interpretación clínica y validación por el profesional | E11 |

## Protección de datos y salud mental

| | Requisito | Dónde / prueba |
|---|---|---|
| ✅ | Consentimiento informado del representante legal antes de tratar datos | L1 |
| ✅ | Asentimiento del niño, niña o adolescente antes de su entrevista | A7 |
| ✅ | IA externa solo con autorización expresa | L2 |
| ✅ | Derecho de acceso y portabilidad | L3 |
| ✅ | Política de privacidad, términos de uso y aviso en el informe | L4 · `PRIVACIDAD_Y_CUMPLIMIENTO.md` |
| ❌ | Cuentas por profesional, cifrado en reposo, contratos de encargo, evaluación de impacto | Pendientes del responsable (ver `PRIVACIDAD_Y_CUMPLIMIENTO.md`) |

## Brief §10–§12

| | Requisito | Estado |
|---|---|---|
| ✅ | Componentes separados de la arquitectura propuesta | `ARQUITECTURA.md` |
| ✅ | API de IA (Anthropic u OpenAI) por variables de entorno, sin exponer claves | `.env.example`, `src/ia.js`, A3, A4 |
| ✅ | Pruebas E2E con entrada, estado anterior, decisión, acción, estado posterior y esperado | `docs/evidencia/e2e/*.md` |
| ✅ | Casos adversos: ambiguas, contradicciones, equivalentes, errores de API, interrupciones, datos faltantes | A1–A7, E03/E13, E05 |
| ✅ | Código fuente, instalación, base de datos, arquitectura, auditoría | Este repositorio |
| ✅ | Demostración completa con caso ficticio e informe | `docs/demo/` |
| ✅ | Sin datos de pacientes reales | Solo `test/fixtures/caso-ficticio.js` |
| ✅ | Aplicación accesible en línea | Desplegada en Hostinger (Node.js administrado); conectar el dominio propio desde hPanel: [DESPLIEGUE_HOSTINGER.md](DESPLIEGUE_HOSTINGER.md) |

## Pendientes y mejoras recomendadas

1. Validación clínica del protocolo codificado por la autora de los documentos (revisar `origen` de cada pregunta y las decisiones D1–D12).
2. Etapa 8 (realidad virtual del proyecto) cuando se entregue: hoy se registra como instrumento opcional.
3. Probar la IA real con respuestas anonimizadas (hoy probada con IA simulada y reglas).
4. Lectura de informes escolares en PDF/Word (hoy: texto pegado o .txt).
5. Usuarios por profesional y registro de quién realiza cada acción (hoy una clave compartida).
6. Cifrado de la base de datos y copia de respaldos fuera del servidor.

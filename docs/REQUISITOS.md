# Requisitos: cumplidos y pendientes

Estado al 15-10-2026. Evidencia: `docs/evidencia/` (trazas E2E y resultados JUnit) y `docs/demo/` (caso ficticio completo).

**Leyenda:** ✅ cumplido y probado · ⚠️ cumplido técnicamente, depende de los documentos vigentes · ❌ pendiente

## Bloqueante

| | Requisito | Estado |
|---|---|---|
| ❌ | **Documentos que gobiernan el sistema** (Modelo científico, Etapa 4, Etapa 7, Etapa 9, prompt de entrevista, archivo de automatización) | **No recibidos.** El contenido clínico actual es provisional. Ver `DOCUMENTOS_Y_CONTRADICCIONES.md`. |

## Brief §3–§9

| | Requisito | Dónde / prueba |
|---|---|---|
| ✅ | Secuencia inicial: motivo → edad → informe escolar → tipo de entrevista | E01, unitarias «fase inicial» |
| ✅ | Ruta con informe: hogar, desarrollo, trayectoria, autonomía, funcionamiento y vacíos del informe | E02, E10 |
| ✅ | Ruta completa cuando no hay informe | E02, A6 |
| ✅ | Revisar antecedentes antes de cada pregunta; no repetir datos establecidos (cualquier fuente) | E05, E10, validador `no_en_expediente` |
| ✅ | Ciclo real de decisión con una sola pregunta por turno | `motor.js`, regla `una_sola_pregunta`, E04 |
| ✅ | Adaptar la siguiente pregunta a la respuesta anterior | E04 |
| ✅ | Profundizar de inmediato ante conducta relevante (incluida mención espontánea) | E06 |
| ✅ | No recorrer listas fijas ni agotar el banco | Demo: 39 de 72 preguntas del banco |
| ✅ | No repetir preguntas aunque cambie la redacción | E05 (grupos de equivalencia + similitud) |
| ✅ | No re-explorar en el hogar lo caracterizado por el informe escolar | E10 |
| ✅ | Distinguir sí / no / no sé / no recuerdo; incertidumbre ≠ negativa | E07, unitarias del intérprete |
| ✅ | Registrar contradicciones sin resolverlas por suposición | E11, A2 |
| ✅ | Límite por síntoma como control de redundancia, con justificación al superarlo | E06, unitaria «límite» |
| ✅ | Expediente único persistente con todos los campos del §5 | `EXPEDIENTE.md` |
| ✅ | Persistencia entre turnos, pantallas y sesiones; recuperación en el punto exacto | E03/E13 |
| ✅ | Validador previo con las 7 comprobaciones del §6; bloqueo y alternativa | `validador.js`, E05, E12 |
| ⚠️ | Barrido diferencial médico, sensorial y del sueño, sin duplicaciones, con 4 estados | E09 · categorías y ramas provisionales |
| ✅ | Recepción y extracción estructurada del informe escolar con fuente | E10 (reglas; IA opcional; carga estructurada manual) |
| ⚠️ | Aplicación y registro de instrumentos del protocolo aprobado | E11 · lista de instrumentos provisional |
| ✅ | Integración de RV y Nesplora sin que determinen el diagnóstico | Informe §4 y advertencia explícita |
| ✅ | Registro de evaluaciones realizadas y pendientes | Flujo lateral, informe §9 |
| ✅ | Informe solo desde el expediente; secciones separadas por fuente; sin datos inventados | E11 (verifica que cada valor exista en el expediente) |
| ✅ | Bloqueo del informe final con faltantes explícitos | E08, E12 |
| ✅ | Interpretación clínica solo del profesional; validación profesional | E11 |

## Brief §10–§12

| | Requisito | Estado |
|---|---|---|
| ✅ | Componentes separados de la arquitectura propuesta | `ARQUITECTURA.md` |
| ✅ | API de IA por variables de entorno, sin exponer claves | `.env.example`, `src/ia.js` |
| ✅ | Pruebas E2E con entrada, estado anterior, decisión, acción, estado posterior y esperado | `docs/evidencia/e2e/*.md` |
| ✅ | Casos adversos: ambiguas, contradicciones, equivalentes, errores de API, interrupciones, datos faltantes | A1–A6, E03/E13, E05 |
| ✅ | Código fuente, instalación, base de datos, arquitectura, auditoría | Este repositorio |
| ✅ | Demostración completa con caso ficticio e informe | `docs/demo/` |
| ✅ | Sin datos de pacientes reales | Solo `test/fixtures/caso-ficticio.js` |
| ⚠️ | **Aplicación accesible para pruebas en línea** | Lista para Hostinger (Node.js administrado) o VPS con Docker: entrada `server.js`, token obligatorio, datos fuera de la carpeta de despliegue, respaldos diarios (pruebas P1–P4). Falta crear el dominio y desplegar: [DESPLIEGUE_HOSTINGER.md](DESPLIEGUE_HOSTINGER.md). |

## Pendientes y mejoras recomendadas

1. **Recibir y codificar los documentos vigentes**; registrar sus contradicciones; regenerar pruebas y demo.
2. Desplegar en Hostinger y conectar el dominio siguiendo `DESPLIEGUE_HOSTINGER.md`.
3. Probar el intérprete con la IA real y respuestas de apoderados reales anonimizadas (hoy probado con IA simulada y reglas).
4. Lectura de informes escolares en PDF/Word (hoy: texto pegado o .txt).
5. Autenticación por usuario (profesional) y registro de quién realiza cada acción; hoy hay un token compartido.
6. Cifrado del archivo de base de datos y copia de los respaldos fuera del servidor (hoy: respaldos diarios en el mismo servidor).

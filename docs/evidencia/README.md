# Evidencia de pruebas

Generada con `npm run test:evidencia` (regenerable en cualquier momento).

| Archivo | Contenido |
|---|---|
| `resultados-pruebas.txt` | Salida completa de las 59 pruebas (25 unitarias, 34 de extremo a extremo) |
| `resultados-junit.xml` | Mismo resultado en formato JUnit (para CI) |
| `e2e/entrevista.md` / `.json` | E01–E10 y E13: orden inicial, rutas, persistencia y recuperación, adaptación, redundancia, profundización, incertidumbre, cierre, tamizaje, informe escolar |
| `e2e/produccion.md` / `.json` | P1–P5: configuración inicial de la clave, bloqueo por intentos, carga con require() como en Hostinger, cabeceras de seguridad, entrada `server.js` (socket, datos fuera de la app, respaldo, cierre ordenado) |
| `e2e/consultas.md` / `.json` | Q1–Q3: respuesta propia de la app, búsqueda automática en internet con citas textuales y solo términos clínicos, preguntas pendientes para el profesional |
| `e2e/bibliografia.md` / `.json` | B1–B4: búsqueda en Europe PMC y PubMed, caché, rechazo de datos personales, referencias en el informe (fuentes simuladas con la forma de sus API públicas) |
| `e2e/privacidad.md` / `.json` | L1–L3: consentimiento informado obligatorio, exportación del expediente, política de privacidad y términos |
| `e2e/informe-y-adversos.md` / `.json` | E11–E12, A1, A2 y A5–A7: informe final en 19 secciones, bloqueos, ambigüedad, discrepancias entre fuentes, entradas inválidas, cambio de ruta, colegio y niño/niña |

Cada paso registra: **entrada**, **estado anterior**, **decisión del motor** (con justificación), **acción resultante**, **estado posterior**, **resultado esperado** y si se cumplió.

Las pruebas E2E levantan el servidor HTTP real con una base SQLite temporal; no usan simulaciones del backend.

La demostración completa de un caso ficticio está en `../demo/`.

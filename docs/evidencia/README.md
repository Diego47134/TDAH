# Evidencia de pruebas

Generada con `npm run test:evidencia` (regenerable en cualquier momento).

| Archivo | Contenido |
|---|---|
| `resultados-pruebas.txt` | Salida completa de las 54 pruebas (25 unitarias, 29 de extremo a extremo) |
| `resultados-junit.xml` | Mismo resultado en formato JUnit (para CI) |
| `e2e/entrevista.md` / `.json` | E01–E10 y E13: orden inicial, rutas, persistencia y recuperación, adaptación, redundancia, profundización, incertidumbre, cierre, tamizaje, informe escolar |
| `e2e/produccion.md` / `.json` | P1–P5: configuración inicial de la clave, bloqueo por intentos, carga con require() como en Hostinger, cabeceras de seguridad, entrada `server.js` (socket, datos fuera de la app, respaldo, cierre ordenado) |
| `e2e/privacidad.md` / `.json` | L1–L4: consentimiento informado obligatorio, IA externa solo con autorización, exportación del expediente, política de privacidad y términos |
| `e2e/informe-y-adversos.md` / `.json` | E11–E12 y A1–A7: informe final en 19 secciones, bloqueos, ambigüedad, discrepancias entre fuentes, errores de API, IA acotada (Anthropic y OpenAI), entradas inválidas, cambio de ruta, colegio y niño/niña |

Cada paso registra: **entrada**, **estado anterior**, **decisión del motor** (con justificación), **acción resultante**, **estado posterior**, **resultado esperado** y si se cumplió.

Las pruebas E2E levantan el servidor HTTP real con una base SQLite temporal; no usan simulaciones del backend. La IA se simula solo en A3 (fallos de API) y A4 (respuestas válidas de Anthropic y OpenAI), porque requieren respuestas controladas.

La demostración completa de un caso ficticio está en `../demo/`.

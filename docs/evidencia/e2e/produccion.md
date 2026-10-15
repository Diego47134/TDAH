# Evidencia E2E — produccion

Generado: 2026-10-15T15:24:55.265Z

## P1 · Token obligatorio en producción — **APROBADA**

Requisito: Un dominio público nunca expone el expediente sin token.

### Paso 1

- **entrada:** GET /api/casos sin token configurado
- **accion_resultante:** HTTP 503
- **esperado:** 503 con instrucción
- **ok:** true

## P2 · Acceso con token y cabeceras — **APROBADA**

Requisito: Bearer token y CSP en todas las respuestas.

### Paso 1

- **entrada:** Sin token / token incorrecto / token correcto
- **accion_resultante:** 401 / 401 / 200
- **esperado:** 401 / 401 / 200
- **ok:** true

## P3 · Entrada de producción — **APROBADA**

Requisito: Simula Hostinger: HOME propio, PORT como socket, token configurado, SIGTERM por inactividad.

### Paso 1

- **entrada:** node server.js con HOME temporal y PORT=socket
- **accion_resultante:** GET /api/casos → 200; BD: ~/tdah-datos/tdah.sqlite; respaldos: tdah-2026-10-15T15-24-54.sqlite
- **esperado:** 200, datos y respaldo fuera de la app
- **ok:** true

### Paso 2

- **entrada:** SIGTERM (detención por inactividad)
- **accion_resultante:** Proceso terminó con código 0
- **ok:** true

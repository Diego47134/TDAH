# Evidencia E2E — produccion

Generado: 2026-10-16T00:19:12.240Z

## P1 · Configuración inicial de la clave — **APROBADA**

Requisito: Un dominio público nunca expone el expediente sin clave; la primera clave se crea desde la app y queda cifrada.

### Paso 1

- **entrada:** GET /api/casos antes de configurar
- **accion_resultante:** HTTP 503 (configuracion_inicial)
- **esperado:** 503
- **ok:** true

### Paso 2

- **entrada:** Clave corta / clave válida / segundo intento
- **accion_resultante:** 400 / 200 / 409
- **esperado:** Solo una configuración inicial
- **ok:** true

### Paso 3

- **entrada:** Sin clave / clave incorrecta / clave correcta; reinicio del servidor
- **accion_resultante:** 401 / 401 / 200; tras reiniciar sigue configurada
- **esperado:** Clave cifrada (scrypt) y persistente
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
- **accion_resultante:** GET /api/casos → 200; BD: ~/tdah-datos/tdah.sqlite; respaldos: tdah-2026-10-16T00-19-11.sqlite
- **esperado:** 200, datos y respaldo fuera de la app
- **ok:** true

### Paso 2

- **entrada:** SIGTERM (detención por inactividad)
- **accion_resultante:** Proceso terminó con código 0
- **ok:** true

## P5 · Carga con require() — **APROBADA**

Requisito: El hosting carga el archivo de entrada con require(): no debe haber await de nivel superior.

### Paso 1

- **entrada:** node -e "require('server.js')"
- **accion_resultante:** GET /api/salud → 200
- **esperado:** 200 sin ERR_REQUIRE_ASYNC_MODULE
- **ok:** true

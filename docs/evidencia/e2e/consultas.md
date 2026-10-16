# Evidencia E2E — consultas

Generado: 2026-10-16T00:18:44.080Z

## Q1 · Respuesta propia — **APROBADA**

Requisito: Las dudas frecuentes se responden con el glosario y el protocolo, sin salir a internet.

### Paso 1

- **entrada:** ¿Qué es el TDAH? / ¿Qué significa esta pregunta? (A09) / ¿Qué pasa si no sé?
- **accion_resultante:** Respondidas por la app
- **esperado:** Sin consultas a internet
- **ok:** true

## Q2 · Búsqueda automática — **APROBADA**

Requisito: Sin respuesta propia, la app consulta Europe PMC automáticamente, envía solo términos clínicos y muestra oraciones textuales con su fuente.

### Paso 1

- **entrada:** ¿Juanito Pérez puede tomar melatonina para dormir?
- **accion_resultante:** Consulta enviada: ADHD melatonin sleep
- **esperado:** Solo términos clínicos; cita textual con fuente
- **ok:** true

## Q3 · Pregunta sin respuesta — **APROBADA**

Requisito: Si ni la app ni internet responden, la pregunta del apoderado queda pendiente para el profesional.

### Paso 1

- **entrada:** ¿Cuánto dura la consulta de hoy?
- **accion_resultante:** Sin respuesta; registrada y luego atendida
- **esperado:** Pendiente para el profesional
- **ok:** true

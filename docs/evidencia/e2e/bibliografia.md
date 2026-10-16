# Evidencia E2E — bibliografia

Generado: 2026-10-16T00:18:43.539Z

## B1 · Buscar evidencia en internet — **APROBADA**

Requisito: La app consulta Europe PMC y PubMed y devuelve título, autores, revista, año, DOI/PMID y enlace.

### Paso 1

- **entrada:** Europe PMC y PubMed
- **accion_resultante:** 2 + 2 resultados normalizados
- **esperado:** Resultados con enlace verificable
- **ok:** true

### Paso 2

- **entrada:** Repetir la búsqueda
- **accion_resultante:** Respondida desde caché
- **esperado:** Sin nueva consulta a internet
- **ok:** true

## B2 · Protección de datos — **APROBADA**

Requisito: Se rechazan búsquedas con RUT, correo o teléfono; solo salen términos clínicos generales.

### Paso 1

- **entrada:** TDAH 12.345.678-9
- **accion_resultante:** HTTP 400: La búsqueda parece contener un RUT. Use solo términos clínicos generales: nunca datos del paciente.
- **esperado:** Rechazada
- **ok:** true

### Paso 2

- **entrada:** contacto apoderado@correo.cl
- **accion_resultante:** HTTP 400: La búsqueda parece contener un correo electrónico. Use solo términos clínicos generales: nunca datos del paciente.
- **esperado:** Rechazada
- **ok:** true

### Paso 3

- **entrada:** llamar +56 9 1234 5678
- **accion_resultante:** HTTP 400: La búsqueda parece contener un número de teléfono. Use solo términos clínicos generales: nunca datos del paciente.
- **esperado:** Rechazada
- **ok:** true

### Paso 4

- **entrada:** ab
- **accion_resultante:** HTTP 400: Escriba al menos 3 caracteres para buscar.
- **esperado:** Rechazada
- **ok:** true

## B4 · Referencias en el informe — **APROBADA**

Requisito: Solo se aceptan referencias obtenidas por una búsqueda real; se citan al final del informe.

### Paso 1

- **entrada:** Referencia inventada / sin profesional / válida
- **accion_resultante:** HTTP 404 / 400 / 200; citada en el informe; auditada
- **esperado:** Solo referencias reales
- **ok:** true

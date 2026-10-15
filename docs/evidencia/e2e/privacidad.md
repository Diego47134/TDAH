# Evidencia E2E — privacidad

Generado: 2026-10-15T23:38:00.106Z

## L1 · Consentimiento obligatorio — **APROBADA**

Requisito: Datos de salud mental = datos sensibles: requieren consentimiento expreso (Ley 19.628/21.719; Ley 20.584; Ley 21.331).

### Paso 1

- **entrada:** Sin consentimiento
- **accion_resultante:** HTTP 400: Debe registrar el consentimiento informado del representante legal antes de crear el caso.
- **esperado:** HTTP 400
- **ok:** true

### Paso 2

- **entrada:** Consentimiento no aceptado
- **accion_resultante:** HTTP 400: Sin consentimiento expreso del representante legal no se pueden tratar datos de salud (datos sensibles).
- **esperado:** HTTP 400
- **ok:** true

### Paso 3

- **entrada:** Sin otorgante
- **accion_resultante:** HTTP 400: Indique quién otorga el consentimiento (nombre o referencia al documento firmado).
- **esperado:** HTTP 400
- **ok:** true

### Paso 4

- **entrada:** Sin profesional
- **accion_resultante:** HTTP 400: Indique el profesional responsable que obtiene el consentimiento.
- **esperado:** HTTP 400
- **ok:** true

### Paso 5

- **entrada:** Relación no válida
- **accion_resultante:** HTTP 400: Relación con el niño, niña o adolescente no válida (madre, padre, tutor_legal, otro_representante_legal).
- **esperado:** HTTP 400
- **ok:** true

### Paso 6

- **entrada:** Medio no válido
- **accion_resultante:** HTTP 400: Medio de consentimiento no válido (escrito_firmado, electronico, verbal_registrado).
- **esperado:** HTTP 400
- **ok:** true

### Paso 7

- **entrada:** Consentimiento completo
- **accion_resultante:** Caso creado; consentimiento auditado
- **esperado:** HTTP 201
- **ok:** true

## L2 · Acceso y portabilidad — **APROBADA**

Requisito: El expediente completo se entrega en formato estructurado y la entrega queda registrada.

### Paso 1

- **entrada:** GET /exportar
- **accion_resultante:** 15 secciones; entrega auditada
- **esperado:** Copia íntegra
- **ok:** true

## L3 · Avisos legales — **APROBADA**

Requisito: Las páginas de privacidad y términos están disponibles y el informe incluye la sección de consentimiento y confidencialidad.

### Paso 1

- **entrada:** GET /privacidad.html, /terminos.html, borrador del informe
- **accion_resultante:** Páginas y sección legal presentes
- **esperado:** Disponibles
- **ok:** true

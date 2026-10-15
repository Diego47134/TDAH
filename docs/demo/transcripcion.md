# Demostración E2E — caso ficticio

Generado: 2026-10-15T23:36:52.893Z  
Datos 100 % ficticios. El guion responde según la pregunta que **elige el motor**; no es una lista fija.

Caso: **CASO-0001** (Caso ficticio A (demostración))

## 1. Entrevista al apoderado

### Turno 1 · `INI-MOTIVO`

**Pregunta:** ¿Qué está ocurriendo actualmente que motivó esta evaluación?  
**Respuesta:** Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas.  
**Interpretación:** valor = «Desde primero básico se distrae mucho en clases y le cuesta terminar las tareas.» (undefined) · menciones: R1.8  
**Decisión del motor:** preguntar → `INI-EDAD`  
**Justificación:** Secuencia inicial obligatoria (paso 2 de 3).

### Turno 2 · `INI-EDAD`

**Pregunta:** ¿Qué edad tiene el niño, niña o adolescente evaluado?  
**Respuesta:** 8 años  
**Interpretación:** valor = «8» (undefined)  
**Decisión del motor:** preguntar → `INI-INF-EXISTE`  
**Justificación:** Secuencia inicial obligatoria (paso 3 de 3).

### Turno 3 · `INI-INF-EXISTE`

**Pregunta:** ¿Existe un informe escolar sobre el niño, niña o adolescente?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `INI-INF-DISP`  
**Justificación:** Secuencia inicial obligatoria (paso 4 de 4).

### Turno 4 · `INI-INF-DISP`

**Pregunta:** ¿El informe escolar está disponible o puede obtenerse para esta evaluación?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `A09`  
**Justificación:** Activación inmediata (Etapa 9 §14.2): se mencionó una conducta con posible correspondencia con «Se distrae fácilmente» (R1.8); se usa la pregunta específica del banco para caracterizarla, sin confirmarla por asociación.

### Turno 5 · `A09`

**Pregunta:** ¿Se distrae fácilmente con estímulos que ocurren alrededor?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.8-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.8 «Se distrae fácilmente» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 6 · `R1.8-FRECUENCIA`

**Pregunta:** Sobre «se distrae fácilmente con estímulos que ocurren alrededor»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.8-DESDE`  
**Justificación:** Profundización del síntoma R1.8 «Se distrae fácilmente» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 7 · `R1.8-DESDE`

**Pregunta:** Sobre «se distrae fácilmente con estímulos que ocurren alrededor»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.8-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.8 «Se distrae fácilmente» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 8 · `R1.8-CONTEXTOS`

**Pregunta:** Sobre «se distrae fácilmente con estímulos que ocurren alrededor»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A01`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.1 «Dificultad para prestar atención a detalles / errores por descuido» sin información del apoderado.

### Turno 9 · `A01`

**Pregunta:** ¿Comete errores por no fijarse bien en los detalles?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.1-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.1 «Dificultad para prestar atención a detalles / errores por descuido» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 10 · `R1.1-FRECUENCIA`

**Pregunta:** Sobre «comete errores por no fijarse bien en los detalles»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.1-DESDE`  
**Justificación:** Profundización del síntoma R1.1 «Dificultad para prestar atención a detalles / errores por descuido» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 11 · `R1.1-DESDE`

**Pregunta:** Sobre «comete errores por no fijarse bien en los detalles»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.1-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.1 «Dificultad para prestar atención a detalles / errores por descuido» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 12 · `R1.1-CONTEXTOS`

**Pregunta:** Sobre «comete errores por no fijarse bien en los detalles»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A02`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.2 «Dificultad para mantener la atención» sin información del apoderado.

### Turno 13 · `A02`

**Pregunta:** ¿Le cuesta mantener la atención durante una actividad?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.2-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.2 «Dificultad para mantener la atención» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 14 · `R1.2-FRECUENCIA`

**Pregunta:** Sobre «le cuesta mantener la atención durante una actividad»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.2-DESDE`  
**Justificación:** Profundización del síntoma R1.2 «Dificultad para mantener la atención» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 15 · `R1.2-DESDE`

**Pregunta:** Sobre «le cuesta mantener la atención durante una actividad»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.2-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.2 «Dificultad para mantener la atención» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 16 · `R1.2-CONTEXTOS`

**Pregunta:** Sobre «le cuesta mantener la atención durante una actividad»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A03`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.3 «Parece no escuchar cuando se le habla directamente» sin información del apoderado.

### Turno 17 · `A03`

**Pregunta:** ¿Parece no escuchar cuando se le habla directamente?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.3-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.3 «Parece no escuchar cuando se le habla directamente» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 18 · `R1.3-FRECUENCIA`

**Pregunta:** Sobre «parece no escuchar cuando se le habla directamente»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.3-DESDE`  
**Justificación:** Profundización del síntoma R1.3 «Parece no escuchar cuando se le habla directamente» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 19 · `R1.3-DESDE`

**Pregunta:** Sobre «parece no escuchar cuando se le habla directamente»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.3-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.3 «Parece no escuchar cuando se le habla directamente» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 20 · `R1.3-CONTEXTOS`

**Pregunta:** Sobre «parece no escuchar cuando se le habla directamente»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A04`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.4 «No sigue instrucciones o no completa tareas» sin información del apoderado.

### Turno 21 · `A04`

**Pregunta:** ¿Le cuesta seguir instrucciones completas?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.4-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.4 «No sigue instrucciones o no completa tareas» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 22 · `R1.4-FRECUENCIA`

**Pregunta:** Sobre «le cuesta seguir instrucciones completas»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.4-DESDE`  
**Justificación:** Profundización del síntoma R1.4 «No sigue instrucciones o no completa tareas» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 23 · `R1.4-DESDE`

**Pregunta:** Sobre «le cuesta seguir instrucciones completas»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.4-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.4 «No sigue instrucciones o no completa tareas» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 24 · `R1.4-CONTEXTOS`

**Pregunta:** Sobre «le cuesta seguir instrucciones completas»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A06`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.5 «Dificultad para organizar tareas y actividades» sin información del apoderado.

### Turno 25 · `A06`

**Pregunta:** ¿Le cuesta organizar sus tareas, materiales o actividades?  
**Respuesta:** D. No sabe / No recuerda  
**Interpretación:** no_sabe (undefined)  
**Decisión del motor:** preguntar → `A07`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.6 «Evita o muestra resistencia ante tareas que requieren esfuerzo mental sostenido» sin información del apoderado.

### Turno 26 · `A07`

**Pregunta:** ¿Evita o posterga actividades que requieren esfuerzo mental durante bastante tiempo?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.6-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.6 «Evita o muestra resistencia ante tareas que requieren esfuerzo mental sostenido» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 27 · `R1.6-FRECUENCIA`

**Pregunta:** Sobre «evita o posterga actividades que requieren esfuerzo mental durante bastante tiempo»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.6-DESDE`  
**Justificación:** Profundización del síntoma R1.6 «Evita o muestra resistencia ante tareas que requieren esfuerzo mental sostenido» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 28 · `R1.6-DESDE`

**Pregunta:** Sobre «evita o posterga actividades que requieren esfuerzo mental durante bastante tiempo»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.6-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.6 «Evita o muestra resistencia ante tareas que requieren esfuerzo mental sostenido» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 29 · `R1.6-CONTEXTOS`

**Pregunta:** Sobre «evita o posterga actividades que requieren esfuerzo mental durante bastante tiempo»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A08`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.7 «Pierde objetos necesarios» sin información del apoderado.

### Turno 30 · `A08`

**Pregunta:** ¿Pierde con frecuencia cosas que necesita?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.7-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.7 «Pierde objetos necesarios» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 31 · `R1.7-FRECUENCIA`

**Pregunta:** Sobre «pierde con frecuencia cosas que necesita»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.7-DESDE`  
**Justificación:** Profundización del síntoma R1.7 «Pierde objetos necesarios» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 32 · `R1.7-DESDE`

**Pregunta:** Sobre «pierde con frecuencia cosas que necesita»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.7-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.7 «Pierde objetos necesarios» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 33 · `R1.7-CONTEXTOS`

**Pregunta:** Sobre «pierde con frecuencia cosas que necesita»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A10`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R1.9 «Es olvidadizo en actividades cotidianas» sin información del apoderado.

### Turno 34 · `A10`

**Pregunta:** ¿Olvida con frecuencia cosas que debería recordar?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R1.9-FRECUENCIA`  
**Justificación:** Profundización del síntoma R1.9 «Es olvidadizo en actividades cotidianas» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 35 · `R1.9-FRECUENCIA`

**Pregunta:** Sobre «olvida con frecuencia cosas que debería recordar»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R1.9-DESDE`  
**Justificación:** Profundización del síntoma R1.9 «Es olvidadizo en actividades cotidianas» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 36 · `R1.9-DESDE`

**Pregunta:** Sobre «olvida con frecuencia cosas que debería recordar»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R1.9-CONTEXTOS`  
**Justificación:** Profundización del síntoma R1.9 «Es olvidadizo en actividades cotidianas» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 37 · `R1.9-CONTEXTOS`

**Pregunta:** Sobre «olvida con frecuencia cosas que debería recordar»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A21`  
**Justificación:** Bloque «ejecutivas» (Etapa 7 §9 (organización y funciones ejecutivas); Anexo 7-A 21–28). Mínima pregunta suficiente: 1 de máx. 5.

### Turno 38 · `A21`

**Pregunta:** ¿Le cuesta saber por dónde comenzar una tarea?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A22`  
**Justificación:** Bloque «ejecutivas» (Etapa 7 §9 (organización y funciones ejecutivas); Anexo 7-A 21–28). Mínima pregunta suficiente: 2 de máx. 5.

### Turno 39 · `A22`

**Pregunta:** ¿Le cuesta recordar varios pasos de una instrucción?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `A23`  
**Justificación:** Bloque «ejecutivas» (Etapa 7 §9 (organización y funciones ejecutivas); Anexo 7-A 21–28). Mínima pregunta suficiente: 3 de máx. 5.

### Turno 40 · `A23`

**Pregunta:** ¿Pierde el objetivo de una actividad mientras la está realizando?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A24`  
**Justificación:** Bloque «ejecutivas» (Etapa 7 §9 (organización y funciones ejecutivas); Anexo 7-A 21–28). Mínima pregunta suficiente: 4 de máx. 5.

### Turno 41 · `A24`

**Pregunta:** ¿Le cuesta cambiar de una actividad a otra?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A25`  
**Justificación:** Bloque «ejecutivas» (Etapa 7 §9 (organización y funciones ejecutivas); Anexo 7-A 21–28). Mínima pregunta suficiente: 5 de máx. 5.

### Turno 42 · `A25`

**Pregunta:** ¿Le cuesta cambiar de estrategia cuando una forma de hacer algo no funciona?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `A12`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.1 «Inquietud motora / mueve manos, pies o se mueve en el asiento» sin información del apoderado.

### Turno 43 · `A12`

**Pregunta:** ¿Se mueve constantemente o muestra mucha inquietud?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A11`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.2 «Se levanta cuando se espera que permanezca sentado» sin información del apoderado.

### Turno 44 · `A11`

**Pregunta:** ¿Le cuesta permanecer sentado cuando se espera que lo haga?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A13`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.3 «Corre, trepa o presenta inquietud inapropiada para la situación» sin información del apoderado.

### Turno 45 · `A13`

**Pregunta:** ¿Corre, trepa o se mueve excesivamente en situaciones en que debería estar tranquilo?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A14`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.4 «Dificultad para participar tranquilamente en actividades» sin información del apoderado.

### Turno 46 · `A14`

**Pregunta:** ¿Le cuesta participar en actividades tranquilas?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A15`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.5 «Actúa como si estuviera permanentemente en marcha» sin información del apoderado.

### Turno 47 · `A15`

**Pregunta:** ¿Parece estar permanentemente activo o necesitar estar haciendo algo?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A16`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.6 «Habla excesivamente» sin información del apoderado.

### Turno 48 · `A16`

**Pregunta:** ¿Habla más de lo esperable para la situación?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A17`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.7 «Responde antes de que termine la pregunta» sin información del apoderado.

### Turno 49 · `A17`

**Pregunta:** ¿Responde antes de que terminen de hacerle una pregunta?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A18`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.8 «Dificultad para esperar su turno» sin información del apoderado.

### Turno 50 · `A18`

**Pregunta:** ¿Le cuesta esperar su turno?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A19`  
**Justificación:** Cobertura individual de los 18 síntomas DSM-5-TR (Etapa 9 §14.1): R2.9 «Interrumpe o invade actividades de otros» sin información del apoderado.

### Turno 51 · `A19`

**Pregunta:** ¿Interrumpe conversaciones, juegos o actividades de otras personas?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `R2.9-FRECUENCIA`  
**Justificación:** Profundización del síntoma R2.9 «Interrumpe o invade actividades de otros» (1/3): falta «frecuencia». Prioridad de la Automatización (regla 2a: frecuencia e intensidad).

### Turno 52 · `R2.9-FRECUENCIA`

**Pregunta:** Sobre «interrumpe conversaciones, juegos o actividades de otras personas»: ¿Con qué frecuencia sucede?  
**Respuesta:** A. Varias veces al día  
**Interpretación:** valor = «varias_al_dia» (undefined)  
**Decisión del motor:** preguntar → `R2.9-DESDE`  
**Justificación:** Profundización del síntoma R2.9 «Interrumpe o invade actividades de otros» (2/3): falta «desde». Permite contrastar R3 (≥6 meses) y R4 (antes de los 12 años).

### Turno 53 · `R2.9-DESDE`

**Pregunta:** Sobre «interrumpe conversaciones, juegos o actividades de otras personas»: ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `R2.9-CONTEXTOS`  
**Justificación:** Profundización del síntoma R2.9 «Interrumpe o invade actividades de otros» (3/3): falta «contextos». Permite contrastar R6 (dos o más contextos).

### Turno 54 · `R2.9-CONTEXTOS`

**Pregunta:** Sobre «interrumpe conversaciones, juegos o actividades de otras personas»: ¿Dónde ocurre?  
**Respuesta:** A. Hogar; B. Colegio  
**Interpretación:** valor = «hogar,colegio» (undefined)  
**Decisión del motor:** preguntar → `A20`  
**Justificación:** Bloque «impulsividad_funcional» (Etapa 7 §9 (impulsividad: actuar sin considerar consecuencias)). Mínima pregunta suficiente: 1 de máx. 1.

### Turno 55 · `A20`

**Pregunta:** ¿Actúa rápidamente sin detenerse a pensar qué puede ocurrir después?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A53`  
**Justificación:** Bloque «desarrollo» (Automatización regla 6 (Etapa 5 de la entrevista: anamnesis del desarrollo); Anexo 7-A 53–58). Mínima pregunta suficiente: 1 de máx. 4.

### Turno 56 · `A53`

**Pregunta:** ¿Hubo alguna preocupación relevante durante su desarrollo temprano?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A55`  
**Justificación:** Bloque «desarrollo» (Automatización regla 6 (Etapa 5 de la entrevista: anamnesis del desarrollo); Anexo 7-A 53–58). Mínima pregunta suficiente: 2 de máx. 4.

### Turno 57 · `A55`

**Pregunta:** ¿Hubo alguna circunstancia relevante durante el embarazo, parto o período neonatal?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A57`  
**Justificación:** Bloque «desarrollo» (Automatización regla 6 (Etapa 5 de la entrevista: anamnesis del desarrollo); Anexo 7-A 53–58). Mínima pregunta suficiente: 3 de máx. 4.

### Turno 58 · `A57`

**Pregunta:** ¿Existen antecedentes familiares relevantes de TDAH u otras dificultades del neurodesarrollo?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A58`  
**Justificación:** Bloque «desarrollo» (Automatización regla 6 (Etapa 5 de la entrevista: anamnesis del desarrollo); Anexo 7-A 53–58). Mínima pregunta suficiente: 4 de máx. 4.

### Turno 59 · `A58`

**Pregunta:** ¿Ha existido alguna situación familiar, escolar o ambiental importante que pueda haber afectado su funcionamiento?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A37`  
**Justificación:** Bloque «contexto» (Etapa 7 §12; Etapa 9 §10; Anexo 7-A 29–37). Mínima pregunta suficiente: 1 de máx. 5.

### Turno 60 · `A37`

**Pregunta:** ¿Funciona diferente en casa y en el colegio?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A32`  
**Justificación:** Bloque «contexto» (Etapa 7 §12; Etapa 9 §10; Anexo 7-A 29–37). Mínima pregunta suficiente: 2 de máx. 5.

### Turno 61 · `A32`

**Pregunta:** ¿Disminuyen cuando un adulto lo supervisa de cerca?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A34`  
**Justificación:** Bloque «contexto» (Etapa 7 §12; Etapa 9 §10; Anexo 7-A 29–37). Mínima pregunta suficiente: 3 de máx. 5.

### Turno 62 · `A34`

**Pregunta:** ¿Funciona mucho mejor cuando la actividad le interesa?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A31`  
**Justificación:** Bloque «contexto» (Etapa 7 §12; Etapa 9 §10; Anexo 7-A 29–37). Mínima pregunta suficiente: 4 de máx. 5.

### Turno 63 · `A31`

**Pregunta:** ¿Aumentan cuando hay muchos distractores?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A29`  
**Justificación:** Bloque «contexto» (Etapa 7 §12; Etapa 9 §10; Anexo 7-A 29–37). Mínima pregunta suficiente: 5 de máx. 5.

### Turno 64 · `A29`

**Pregunta:** ¿Las dificultades aumentan cuando la actividad dura bastante tiempo?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A38`  
**Justificación:** Bloque «trayectoria» (Etapa 7 §7 (requisito obligatorio); Etapa 9 §9; Anexo 7-A 38–45). Mínima pregunta suficiente: 1 de máx. 5.

### Turno 65 · `A38`

**Pregunta:** ¿Recuerda haber observado alguna de estas dificultades antes de los 6 años?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `A40`  
**Justificación:** Bloque «trayectoria» (Etapa 7 §7 (requisito obligatorio); Etapa 9 §9; Anexo 7-A 38–45). Mínima pregunta suficiente: 2 de máx. 5.

### Turno 66 · `A40`

**Pregunta:** ¿Las dificultades han estado presentes durante largos períodos?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A41`  
**Justificación:** Bloque «trayectoria» (Etapa 7 §7 (requisito obligatorio); Etapa 9 §9; Anexo 7-A 38–45). Mínima pregunta suficiente: 3 de máx. 5.

### Turno 67 · `A41`

**Pregunta:** ¿Han aumentado a medida que aumentaron las exigencias?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A42`  
**Justificación:** Bloque «trayectoria» (Etapa 7 §7 (requisito obligatorio); Etapa 9 §9; Anexo 7-A 38–45). Mínima pregunta suficiente: 4 de máx. 5.

### Turno 68 · `A42`

**Pregunta:** ¿Hay etapas en que funcionaba claramente mejor?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A39`  
**Justificación:** Bloque «trayectoria» (Etapa 7 §7 (requisito obligatorio); Etapa 9 §9; Anexo 7-A 38–45). Mínima pregunta suficiente: 5 de máx. 5.

### Turno 69 · `A39`

**Pregunta:** ¿Ya existían algunas de estas dificultades antes de entrar al colegio?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A46`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 1 de máx. 7.

### Turno 70 · `A46`

**Pregunta:** ¿Estas dificultades afectan su rendimiento escolar?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A47`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 2 de máx. 7.

### Turno 71 · `A47`

**Pregunta:** ¿Afectan la convivencia familiar?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `A48`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 3 de máx. 7.

### Turno 72 · `A48`

**Pregunta:** ¿Afectan sus relaciones con otros niños o adolescentes?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A49`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 4 de máx. 7.

### Turno 73 · `A49`

**Pregunta:** ¿Afectan actividades cotidianas?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A50`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 5 de máx. 7.

### Turno 74 · `A50`

**Pregunta:** ¿Necesita más ayuda que otros niños de su edad para realizar actividades que debería poder hacer con mayor autonomía?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `A51`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 6 de máx. 7.

### Turno 75 · `A51`

**Pregunta:** ¿Estas dificultades generan frustración, conflictos o consecuencias importantes?  
**Respuesta:** B. No  
**Interpretación:** valor = «no» (undefined)  
**Decisión del motor:** preguntar → `A52`  
**Justificación:** Bloque «impacto» (Etapa 7 §13; Etapa 4 R7; Anexo 7-A 46–52). Mínima pregunta suficiente: 7 de máx. 7.

### Turno 76 · `A52`

**Pregunta:** ¿Cuál considera que es actualmente la principal dificultad de funcionamiento?  
**Respuesta:** Lo que más preocupa es que se está quedando atrás en lectura y se frustra.  
**Interpretación:** valor = «Lo que más preocupa es que se está quedando atrás en lectura y se frustra.» (undefined)  
**Decisión del motor:** preguntar → `BARRIDO`  
**Justificación:** Barrido diferencial obligatorio antes del cierre (Etapa 9 §H; regla absoluta J.2).

### Turno 77 · `BARRIDO`

**Pregunta:** Además de las dificultades que hemos conversado, ¿hay alguna de estas áreas que haya presentado, presente o haya presentado anteriormente alguna dificultad relevante para su funcionamiento?  
**Respuesta:** C. Sueño  
**Interpretación:** valor = «C» (undefined)  
**Decisión del motor:** preguntar → `BAR-C-1`  
**Justificación:** Rama abierta del barrido diferencial: «Sueño». Solo se abren las áreas seleccionadas.

### Turno 78 · `BAR-C-1`

**Pregunta:** ¿Las dificultades aumentan cuando duerme mal o está cansado?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `BAR-C-DESDE`  
**Justificación:** Rama abierta del barrido diferencial: «Sueño». Solo se abren las áreas seleccionadas.

### Turno 79 · `BAR-C-DESDE`

**Pregunta:** ¿Desde cuándo ocurre?  
**Respuesta:** B. Hace más de 6 meses, y comenzó antes de los 12 años  
**Interpretación:** valor = «mas_6_meses_antes_12» (undefined)  
**Decisión del motor:** preguntar → `TAMIZAJE`  
**Justificación:** Módulo obligatorio de tamizaje médico, sensorial y del sueño (Etapa 9 §H.1); la entrevista no puede cerrarse mientras esté NO_REALIZADO o EN_CURSO.

### Turno 80 · `TAMIZAJE`

**Pregunta:** Además de las dificultades que motivaron esta evaluación, ¿se ha observado o diagnosticado alguna de estas situaciones? Seleccione todas las que correspondan  
**Respuesta:** D. Problemas persistentes de sueño, ronquidos intensos, pausas respiratorias durante el sueño o somnolencia diurna marcada.  
**Interpretación:** valor = «D» (undefined)  
**Decisión del motor:** preguntar → `TAM-D-1`  
**Justificación:** Categoría seleccionada del tamizaje: «Sueño»; una sola pregunta por turno sobre la dimensión que falta.

### Turno 81 · `TAM-D-1`

**Pregunta:** ¿Qué problema se observa?  
**Respuesta:** Le cuesta dormirse; ronca algunas noches.  
**Interpretación:** valor = «Le cuesta dormirse; ronca algunas noches.» (undefined)  
**Decisión del motor:** preguntar → `TAM-D-3`  
**Justificación:** Categoría seleccionada del tamizaje: «Sueño»; una sola pregunta por turno sobre la dimensión que falta.

### Turno 82 · `TAM-D-3`

**Pregunta:** ¿Hay ronquidos intensos o pausas respiratorias observadas?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** preguntar → `TAM-D-5`  
**Justificación:** Categoría seleccionada del tamizaje: «Sueño»; una sola pregunta por turno sobre la dimensión que falta.

### Turno 83 · `TAM-D-5`

**Pregunta:** ¿Ha sido evaluado por un profesional?  
**Respuesta:** A. Sí  
**Interpretación:** valor = «si» (undefined)  
**Decisión del motor:** esperar_informe  
**Justificación:** La entrevista del apoderado está completa; la información escolar se obtiene del informe (Ruta B). Al incorporarlo, solo se preguntarán sus vacíos.

> Estado tras la entrevista del hogar: **esperando_informe_escolar** — ruta «con_informe». Ruta B (Etapa 7 §5.2): existe informe escolar disponible; el apoderado se centra en hogar, desarrollo, trayectoria, autonomía e impacto, y solo se pregunta lo que el informe no resuelva.

## 2. Informe escolar

```text
Informe de la profesora jefe (ficticio).
En clases se distrae con facilidad, varias veces al día, con ruidos o compañeros.
No termina las tareas que comienza y deja guías incompletas.
Pierde sus útiles con frecuencia.
No interrumpe a sus compañeros.
Su rendimiento ha bajado este semestre, sobre todo en lenguaje.
Las dificultades se observan desde primero básico.
```

Método de extracción: reglas. Datos extraídos:

- `R1.8.presencia:informe` = si — «En clases se distrae con facilidad, varias veces al día, con ruidos o compañeros.»
- `R1.8.frecuencia` = varias_al_dia — «En clases se distrae con facilidad, varias veces al día, con ruidos o compañeros.»
- `R1.4.presencia:informe` = si — «No termina las tareas que comienza y deja guías incompletas.»
- `R1.7.presencia:informe` = si — «Pierde sus útiles con frecuencia.»
- `R2.9.presencia:informe` = no — «No interrumpe a sus compañeros.»
- `INF.impacto_academico` = si — «Su rendimiento ha bajado este semestre, sobre todo en lenguaje.»
- `INF.desde` = Las dificultades se observan desde primero básico. — «Las dificultades se observan desde primero básico.»

Contradicciones detectadas: «Interrumpe o invade actividades de otros»: apoderado informa «Sí» y informe_escolar informa «No». Puede explicarse por contexto, demanda, observador o supervisión (Etapa 9 §11); se conserva sin resolver.

El motor reabre la entrevista solo para el vacío: `RA-C04` — Ruta B (Etapa 7 §5.2): el informe escolar no contiene esta información; se pregunta solo el vacío.

### Entrevista de vacíos

### Turno 84 · `RA-C04`

**Pregunta:** Según lo que usted sabe del colegio: ¿En qué situaciones funciona mejor?  
**Respuesta:** Dato de prueba ficticio.  
**Interpretación:** valor = «Dato de prueba ficticio.» (undefined)  
**Decisión del motor:** cerrar  
**Justificación:** PUEDE_CERRAR_ENTREVISTA = VERDADERO (Etapa 9 §J.2): barrido diferencial y tamizaje completos, sin ramas abiertas ni información obligatoria pendiente.

## 3. Instrumentos

- NESPLORA: realizada (2026-10-01)
- ESCALA-DOCENTE: no_aplica (undefined)
- RV: no realizada (opcional; el informe lo declara como información no disponible)

## 3b. Complementación del colegio (Anexo 7-C) y entrevista al niño (Anexo 7-D)

Preguntas cubiertas por el informe (no se envían): C01, C02, C03, C07, C08.
Preguntas a enviar al colegio: C04, C05, C06, C09, C10, C11, C12.

- C04 «¿En qué situaciones funciona mejor?» → respuesta ficticia registrada con fuente «profesor».
- Asentimiento del niño registrado antes de su entrevista.
- Niño · D04 «Cuando tienes que concentrarte durante bastante tiempo, ¿qué te pasa?» → «A veces me distraigo cuando hay ruido.»
- Niño · D05 «Cuando empiezas a distraerte, ¿qué haces?» → «Me cuesta terminar las guías.»
- Entrevista al niño finalizada por el profesional.

## 4. Bloqueo de informe prematuro

Intento de informe final antes de la revisión profesional → POST /api/casos/fba0e217-57e2-427c-91cb-d49782d9ff6d/informes → 409: Evaluación pendiente: no se puede generar el informe final.

## 5. Revisión profesional

- Contradicción revisada: «Interrumpe o invade actividades de otros»: apoderado informa «Sí» y informe_escolar informa «No». Puede explicarse por contexto, demanda, observador o supervisión (Etapa 9 §11); se conserva sin resolver.
- Interpretación clínica registrada por el profesional (texto de demostración).

## 6. Informe final

Generado y validado. Ver [informe-final.md](informe-final.md).

## 7. Auditoría

| Tipo de decisión | Cantidad |
|---|---|
| consentimiento_registrado | 1 |
| caso_creado | 1 |
| pregunta_seleccionada | 84 |
| respuesta_registrada | 84 |
| evidencia_relacionada_detectada | 1 |
| ruta_determinada | 1 |
| espera_informe_escolar | 1 |
| discrepancia_registrada | 1 |
| informe_escolar_cargado | 1 |
| preguntas_descartadas | 2 |
| entrevista_cerrada | 2 |
| evaluacion_registrada | 2 |
| complementacion_colegio | 1 |
| asentimiento_nna_registrado | 1 |
| respuesta_nna | 2 |
| entrevista_nna_finalizada | 1 |
| informe_final_bloqueado | 1 |
| contradiccion_revisada | 1 |
| decision_profesional_registrada | 1 |
| informe_final_generado | 1 |
| informe_validado | 1 |

Preguntas formuladas: 84 (de 222 del protocolo). Repetidas: 0.

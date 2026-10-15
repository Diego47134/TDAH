# Brief del cliente (texto original recibido el 15-10-2026)

```text
el proyecto es tdah, la etapa 9 es como el motor o cerebro, y el archivo de automatización es como el lenguaje este últmo puedes o no usarlo, 
Diego esto necesito, te lo evnío ve tu lo que necesitas:
ESPECIFICACIÓN PARA PROGRAMAR EL SISTEMA DE EVALUACIÓN TDAH
1. Objetivo del proyecto
Necesito desarrollar una aplicación funcional para ejecutar un sistema de evaluación de TDAH basado en los documentos científicos y metodológicos que entregaré.

No necesito solamente un chatbot ni una demostración visual. Necesito una aplicación que ejecute la entrevista adaptativa, conserve el estado del caso, procese los antecedentes, controle el flujo de evaluación y genere un informe estructurado cuando corresponda.

El sistema debe funcionar de principio a fin y permitir comprobar técnicamente que cada componente está conectado con los demás.

2. Documentos que deben gobernar el sistema
El programador debe revisar los documentos completos y respetar sus funciones.

Modelo científico: define el marco conceptual y los criterios de interpretación.

Etapa 4: define la información que debe caracterizarse para cada síntoma o dimensión relevante.

Etapa 7: establece la estructura metodológica de la entrevista y el banco de preguntas.

Etapa 9: es el motor que decide qué información falta, qué pregunta corresponde y cuándo continuar a otra dimensión.

Prompt de entrevista adaptativa: es la capa de ejecución. Presenta únicamente la pregunta autorizada por el motor y devuelve la respuesta para que el sistema actualice el estado.

Los documentos corregidos prevalecen sobre las versiones anteriores. Antes de programar, hay que identificar las versiones vigentes y registrar cualquier contradicción entre documentos para resolverla explícitamente.

Regla fundamental: el prompt no debe seleccionar preguntas por su cuenta ni sustituir la lógica de la Etapa 9.

3. Flujo inicial obligatorio de la entrevista
La entrevista debe comenzar respetando esta secuencia:

Motivo de consulta.

Edad de la persona evaluada.

Existencia y disponibilidad del informe escolar.

Determinación del tipo de entrevista que corresponde.

Si existe o se puede obtener un informe escolar, la entrevista al apoderado debe centrarse en los antecedentes del hogar, el desarrollo, la trayectoria, la autonomía, el funcionamiento cotidiano y los aspectos que el informe no haya resuelto.

Si no existe ni se puede obtener el informe, debe ejecutarse la ruta de entrevista completa que establecen los documentos.

Antes de formular cada pregunta, el sistema debe revisar los antecedentes ya registrados. No debe volver a preguntar datos que ya estén suficientemente establecidos.

4. Funcionamiento del motor adaptativo
La entrevista debe operar mediante un ciclo real de decisión:

Consultar estado → identificar información pendiente → seleccionar pregunta autorizada → presentar pregunta → registrar respuesta → actualizar estado → validar redundancia → decidir el siguiente paso.

Requisitos obligatorios:

Formular una sola pregunta por turno.

Adaptar la siguiente pregunta a la respuesta anterior.

Profundizar inmediatamente cuando aparezca una conducta relevante que todavía no esté suficientemente caracterizada.

No avanzar automáticamente por una lista fija de preguntas.

No formular todas las preguntas de un banco por el solo hecho de que existan.

No repetir preguntas ya resueltas, aunque estén redactadas de otra manera.

No volver a explorar en el hogar una dimensión suficientemente caracterizada en el informe escolar, salvo que exista un vacío relevante.

Distinguir entre sí, no, no sé y no recuerdo. No sé y no recuerdo no pueden convertirse en una respuesta negativa.

Registrar las contradicciones sin resolverlas mediante suposiciones.

Cuando falte información importante, preguntar solo por esa dimensión.

Cuando una dimensión esté suficientemente caracterizada, continuar a otra necesidad pendiente.

El límite de preguntas por síntoma debe funcionar como control contra la redundancia, no como una cuota obligatoria. Si faltan datos esenciales, el motor debe justificar la profundización.

5. Memoria persistente y expediente único
La aplicación debe mantener un expediente por persona evaluada. El historial no puede depender exclusivamente de lo que el modelo recuerde en la conversación.

El expediente debe conservar, como mínimo:

Identificador del caso.

Motivo de consulta, edad y ruta de entrevista.

Respuestas originales del apoderado.

Preguntas formuladas y sus identificadores.

Dimensiones exploradas, resueltas, parcialmente resueltas y pendientes.

Datos desconocidos y contradicciones.

Fuente de cada dato: apoderado, informe escolar, prueba, observación u otra fuente identificada.

Fecha y estado de cada evaluación.

Historial de decisiones del motor.

Pregunta anterior y justificación de la siguiente.

Estado global del proceso.

La información debe persistir al cerrar y volver a abrir la aplicación, cambiar de pantalla o iniciar una nueva sesión. Debe ser posible recuperar un caso y continuar desde el punto exacto en que quedó.

6. Control de preguntas repetidas y validación
No basta con comparar literalmente las preguntas. El sistema debe detectar equivalencias funcionales.

Por ejemplo, si ya se estableció que la persona necesita recordatorios para completar una tarea, no debe volver a preguntar lo mismo con expresiones como «¿hay que insistirle?» o «¿necesita que le recuerden que termine?», salvo que falte una dimensión específica que justifique esa nueva pregunta.

Antes de mostrar cualquier pregunta, un validador debe comprobar:

¿Está autorizada por la Etapa 9?

¿Es necesaria para resolver una dimensión pendiente?

¿La información ya está en el expediente o en otra fuente?

¿Es funcionalmente equivalente a una pregunta anterior?

¿Existe una pregunta más específica que permita resolver el vacío?

¿Se respeta la ruta correspondiente al informe escolar?

¿Se está tratando correctamente la incertidumbre?

Si la pregunta no supera la validación, debe bloquearse y solicitar al motor una alternativa autorizada.

7. Barrido diferencial médico, sensorial y del sueño
El sistema debe incorporar el módulo de tamizaje previsto en los documentos corregidos.

Debe explorar las categorías pertinentes y abrir únicamente las ramas que correspondan a las respuestas y antecedentes existentes. Si se identifica una situación que requiere profundización, el sistema debe formular una pregunta por turno y continuar según la información que falte.

Debe distinguir entre:

Ausencia de una situación referida.

Situación presente.

Información desconocida.

Información que requiere verificación profesional.

El tamizaje no debe convertirse en un diagnóstico médico ni cerrar automáticamente otras áreas de evaluación.

8. Flujo completo de evaluación
La aplicación debe contemplar las etapas del proyecto, no limitarse a la entrevista:

Entrevista inicial y antecedentes.

Recepción y extracción estructurada del informe escolar, cuando exista.

Aplicación y registro de los instrumentos que correspondan al protocolo aprobado.

Integración de los resultados de realidad virtual y Nesplora, cuando se hayan realizado.

Integración multidimensional de entrevista, trayectoria, funcionamiento, fuentes documentales y resultados objetivos.

Revisión de explicaciones alternativas, incertidumbres y datos contradictorios.

Generación del informe estructurado.

Revisión y validación por el profesional responsable.

Los resultados de realidad virtual o de un instrumento aislado no deben determinar por sí solos un diagnóstico. La aplicación debe registrar qué evaluaciones se realizaron y cuáles están pendientes.

9. Generación del informe
El informe debe generarse a partir del expediente estructurado y no de una narración improvisada por el modelo.

Debe diferenciar claramente:

Antecedentes aportados por el apoderado.

Información obtenida del informe escolar.

Resultados de instrumentos aplicados.

Hallazgos y patrones observados.

Información ausente o contradictoria.

Explicaciones alternativas que requieren consideración.

Interpretación clínica.

Limitaciones y aspectos pendientes de evaluación.

El informe no debe completarse con datos inventados ni presentar inferencias de la IA como hechos documentados.

El sistema debe impedir la generación de un informe final cuando falten requisitos obligatorios del protocolo. Si el proceso está incompleto, debe mostrar un estado de evaluación pendiente y especificar qué falta.

El resultado debe quedar sujeto a revisión profesional. La aplicación no debe presentar la automatización como sustituto del juicio clínico.

10. Arquitectura técnica solicitada
Propongo evaluar una arquitectura con estos componentes separados:

Interfaz de usuario para la entrevista y visualización del expediente.

Backend que controle el flujo de evaluación.

Integración con la API del modelo de IA.

System Prompt Maestro y prompt de ejecución.

Motor de decisiones de la Etapa 9.

Esquema estructurado de datos y validación de respuestas.

Base de datos persistente.

Validador de preguntas repetidas y no autorizadas.

Módulo de extracción de información del informe escolar.

Módulo de integración de resultados.

Generador de informes.

Registro de auditoría y errores.

La IA puede interpretar respuestas y proponer decisiones dentro de las reglas establecidas, pero el software debe controlar el estado, la persistencia, las transiciones y las validaciones críticas.

La tecnología concreta puede ser propuesta por el programador, pero debe justificar cómo garantiza estos requisitos y cómo se probarán.

11. Pruebas obligatorias antes de considerar terminado el trabajo
No aceptar como demostración suficiente que la aplicación abre, que responde una pregunta o que algunas pruebas unitarias pasan.

Solicito pruebas de extremo a extremo que demuestren:

Que la entrevista comienza en el orden establecido.

Que la ruta cambia correctamente según la existencia del informe escolar.

Que las respuestas se conservan entre turnos y sesiones.

Que la pregunta siguiente depende de las respuestas y del estado real del expediente.

Que no se repiten preguntas ya resueltas, incluso con otra redacción.

Que se profundiza cuando una dimensión importante sigue incompleta.

Que las respuestas «no sé» y «no recuerdo» no se interpretan como negativas.

Que el sistema no cierra la entrevista mientras existan dominios obligatorios sin explorar.

Que el tamizaje médico, sensorial y del sueño funciona sin duplicaciones.

Que los datos del informe escolar se conservan con su fuente.

Que el informe final refleja los datos reales y las incertidumbres.

Que el sistema bloquea preguntas no autorizadas e informes prematuros.

Que, al recuperar un caso interrumpido, la entrevista continúa correctamente.

Cada prueba debe mostrar la entrada, el estado anterior, la decisión del motor, la pregunta o acción resultante, el estado posterior y el resultado esperado.

También se deben probar casos adversos: respuestas ambiguas, contradicciones, preguntas equivalentes, errores de API, interrupciones y datos faltantes.

12. Entregables
Solicito recibir:

Aplicación ejecutable y accesible para pruebas.

Código fuente.

Instrucciones de instalación y ejecución.

Configuración de la API mediante variables de entorno, sin exponer claves secretas.

Base de datos y estructura del expediente.

Documentación de la arquitectura.

Trazas de auditoría de las decisiones del motor.

Resultados de pruebas unitarias y de extremo a extremo.

Lista de requisitos cumplidos y pendientes.

Demostración de una entrevista completa y de la generación del informe a partir de un caso de prueba ficticio.

No debe utilizarse información identificable de pacientes reales para las pruebas iniciales.

13. Condición de aceptación
Consideraré el sistema funcional cuando pueda realizar una entrevista completa de prueba, adaptar las preguntas sin redundancia, conservar el expediente, integrar las fuentes disponibles, detectar lo que falta y producir un informe coherente con los datos registrados.

La condición esencial es demostrar que el flujo completo funciona realmente, no solo que los prompts parecen correctos o que cada módulo funciona por separado.

Antes de cerrar el proyecto, el programador debe mostrar una prueba de extremo a extremo y entregar evidencia verificable de los resultados.
```

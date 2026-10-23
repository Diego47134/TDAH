# Informe integrado y lectura de las tres fuentes

Revisión al 23-10-2026. Implementa el «Módulo de generación del informe clínico-neuropsicológico y educativo» y el «Protocolo de integración de las tres fuentes» entregados por el cliente.

## Fuentes y cómo entran al expediente

| Fuente | Cómo se incorpora | Código |
|---|---|---|
| Entrevista al apoderado | La conduce la app (Etapa 7). | `src/motor.js` |
| Informe escolar | Se sube como documento Word, PDF o texto, o se pega en «Informe escolar y colegio». La lectura no usa IA. Extrae:<br>- las conductas por síntoma, con su frase literal;<br>- la frecuencia;<br>- el impacto académico;<br>- los apoyos ya aplicados en el aula y su efectividad;<br>- el potencial que menciona el docente;<br>- los datos del documento: estudiante, curso, fecha, docente y motivo. | `src/informeEscolar.js` (`leerInformeEscolar`) |
| Nesplora Aula | Se sube el PDF del «Informe interpretativo». La lectura no usa IA. Extrae:<br>- los índices generales (PD, percentil, T e interpretación del propio baremo);<br>- la validez de la aplicación (EVI);<br>- las tablas con y sin distractores, por tarea y por canal sensorial. | `src/nesplora.js` |
| Realidad virtual del proyecto | El casco envía los datos en tiempo real. | `src/rv.js` |

### Vinculación al caso (prueba de aceptación 21)

Antes de integrar un informe de Nesplora, la app compara la fecha de nacimiento o la edad del informe con la edad del caso, y el nombre cuando la etiqueta del caso es un nombre.

- **Si no coinciden, o no se puede verificar:** los resultados quedan **pendientes de vinculación**. No entran en el análisis ni en el informe. El profesional tiene que confirmar la vinculación en la pestaña Documentos e indicar cómo la verificó; la confirmación queda en la auditoría.
- **Si la prueba tiene más de 12 meses:** queda una advertencia en el informe.

## Estructura del informe

1. Identificación y motivo de consulta
2. Fuentes de información (tabla con fecha, aporte, áreas y limitaciones)
3. Síntesis ejecutiva
4. Integración de las fuentes, con:
   - hallazgos convergentes;
   - hallazgos complementarios;
   - discrepancias;
   - la realidad virtual frente a la conducta cotidiana;
   - la información exclusiva de cada fuente;
   - las limitaciones.
5. Análisis de los 18 síntomas DSM-5-TR (estado del motor, fuentes, conductas literales, faltantes)
6. Contraste de requisitos diagnósticos (estados del motor, sin recalcular)
7. Perfil neuropsicológico y funcional
8. Fortalezas y capacidades preservadas. No se inventan: «preservada» se rotula como «no es una fortaleza medida».
9. Dificultades y necesidades de apoyo
10. Realidad virtual y otros instrumentos (índices originales, interpretación del instrumento, correspondencia, condiciones, límites)
11. Explicaciones alternativas y condiciones concurrentes
12. Recomendaciones individualizadas, agrupadas en:
    - A. Aula y profesores
    - B. Psicopedagogía y apoyos al aprendizaje
    - C. Familia y hogar
    - D. Evaluación o seguimiento profesional

    Cada recomendación indica el hallazgo que la justifica, la acción, el responsable, el objetivo y el indicador. Considera los apoyos que el colegio ya aplicó y su efectividad.
13. Plan de seguimiento (sin línea base inventada)
14. Información pendiente
15. Conclusión integrada (reproduce el estado del motor)
16. Revisión y validación profesional

Al final van la **Síntesis para docentes y psicólogos educativos**, sin diagnóstico, y el **Control de calidad del informe** (sección 6 de la especificación).

## Pruebas

`test/e2e/integracion-tres-fuentes.test.js` usa los documentos de ejemplo del cliente (`test/fixtures/documentos/`):

- **I0:** lectura de los documentos.
- **A17–A20:** convergencia, discrepancia de contexto, realidad virtual complementaria e información insuficiente.
- **A21:** fuente no atribuible.

## Redacción asistida por IA (opcional)

Se activa definiendo `OPENAI_API_KEY` en el hosting. Opcionalmente se puede elegir el modelo con `IA_MODELO`; el predeterminado es `gpt-5-mini`.

La IA se usa solo en los casos cuyo representante la autorizó en el consentimiento, y para cuatro tareas:

1. **Redactar el informe:** síntesis ejecutiva, integración de las fuentes, conclusión y síntesis para docentes.
   - Recibe solo los datos que el informe ya estableció, sin nombres (`datosParaRedaccion`).
   - Su texto se verifica antes de usarlo (`verificarRedaccion`). Se rechaza si trae cifras que no están en los datos, nombres del caso, afirmaciones diagnósticas o menciones diagnósticas en la síntesis educativa.
   - Si no pasa la verificación, se usa la redacción del sistema y queda registrado.
   - La conclusión diagnóstica la escribe siempre el sistema con el estado del motor.
2. **Leer documentos** con formatos distintos a los conocidos. Cada dato debe estar respaldado por una frase literal del documento.
3. **Interpretar respuestas libres** del apoderado y asignarlas a una alternativa autorizada.
4. **Redactar respuestas a dudas**, usando solo las fuentes encontradas.

Pruebas: IA1–IA3 (con un proveedor simulado).

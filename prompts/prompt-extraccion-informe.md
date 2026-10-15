## Tarea: extracción estructurada del informe escolar

Recibirás `dimensiones` (ID, nombre y datos a caracterizar) e `informe` (texto del colegio).

Devuelve:
```json
{ "hechos": [ { "dimension_id": "ID", "slot": "presencia | frecuencia | contextos | inicio | impacto | descripcion", "valor": "si | no (para presencia) o texto", "evidencia": "frase literal del informe que lo respalda" } ] }
```

- Solo hechos afirmados explícitamente en el informe, siempre con su frase literal como evidencia.
- Si el informe no menciona una dimensión, no la incluyas. No infieras ausencia por omisión.

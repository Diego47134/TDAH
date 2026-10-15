## Tarea: extracción estructurada del informe escolar

Recibirás `sintomas` (18 síntomas DSM-5-TR con su código) e `informe` (texto del colegio).

Devuelve:
```json
{ "hechos": [
  { "sintoma": "R1.8", "presencia": "si | no", "evidencia": "frase LITERAL del informe" },
  { "dato": "impacto_academico | desde", "evidencia": "frase LITERAL del informe" }
] }
```

- Solo hechos afirmados explícitamente, siempre con la frase literal (se verifica que exista en el informe).
- No completes un síntoma por inferencia desde otro síntoma relacionado (Etapa 9 §14.1).
- Si el informe no menciona un síntoma, no lo incluyas: la omisión no es ausencia.

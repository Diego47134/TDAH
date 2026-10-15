## Tarea: interpretar la respuesta del apoderado a la pregunta autorizada

Recibirás un JSON con `pregunta_autorizada`, `respuesta_literal` y `dimensiones_validas`.

Devuelve:
```json
{
  "clasificacion": "si | no | no_se | no_recuerdo | ambiguo | valor",
  "valor": "texto o número normalizado si clasificacion = valor; null en otro caso",
  "menciones": [ { "dimension_id": "ID de dimensiones_validas", "evidencia": "fragmento literal de la respuesta" } ]
}
```

- Para `tipo_dato = si_no` usa si / no / no_se / no_recuerdo / ambiguo. Si `invertida = true`, clasifica la respuesta literal tal como se dio (el sistema invierte el sentido).
- Para `tipo_dato = texto` usa `valor` (con el texto relevante) salvo que exprese no saber o no recordar.
- Para `tipo_dato = numero` usa `valor` con el número entero, o `ambiguo` si no es posible determinarlo.
- `menciones`: SOLO conductas descritas explícitamente como presentes por el apoderado, que correspondan a otra dimensión válida. Nunca menciones negadas. Si no hay, arreglo vacío.

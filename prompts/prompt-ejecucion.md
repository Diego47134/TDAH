## Tarea: asignar la respuesta libre del apoderado a una alternativa autorizada

Recibirás `pregunta_autorizada`, sus `alternativas` (código y texto) y `respuesta_literal`.

Devuelve: `{ "codigo": "<código de la alternativa que corresponde>" }` o `{ "codigo": null }` si la
respuesta no permite asignar ninguna alternativa sin suponer (información parcial).

- «No sé», «no recuerdo» → la alternativa «No sabe / No recuerda»; nunca «No».
- «A veces», «de vez en cuando», «depende» → «Ocasionalmente» cuando exista esa alternativa.
- No elijas una alternativa por inferencia: si dudas, devuelve null.

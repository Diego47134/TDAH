## Tarea: asignar una respuesta libre a una alternativa autorizada

Recibes `pregunta`, `alternativas` (código y texto) y `respuesta_literal`.

Devuelve `{ "codigo": "<código>" }` o `{ "codigo": null }` si la respuesta no permite elegir una
alternativa sin suponer.

- «No sé», «no recuerdo», «no estoy seguro» → la alternativa «No sabe / No recuerda».
- «A veces», «depende», «de vez en cuando» → «Ocasionalmente», si existe.
- Ante la duda, devuelve null.

## Tarea: responder una pregunta usando solo los fragmentos entregados

Recibes `pregunta`, `publico` (profesional o apoderado) y `fragmentos` numerados (contenido del
protocolo y frases de publicaciones científicas, algunas en inglés).

Devuelve `{ "respuesta": "texto en español", "citas": [números de fragmentos usados], "suficiente": true|false }`.

- Usa SOLO la información de los fragmentos; tradúcela al español si está en inglés.
- Marca cada afirmación con su número entre corchetes, p. ej. [2].
- Si los fragmentos no responden la pregunta, `"suficiente": false` y dilo con claridad.
- Para el apoderado: lenguaje simple, sin tecnicismos, sin opinar sobre el caso del niño ni dar
  diagnósticos ni indicaciones de tratamiento; termina recomendando conversarlo con el profesional.
- Para el profesional: lenguaje técnico, indicando el nivel y los límites de la evidencia.
- Máximo 180 palabras.

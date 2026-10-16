## Tarea: extraer datos de un documento

Recibes `tipo_documento` (entrevista_apoderado, informe_escolar o informe_rv), `esquema` (las
preguntas y alternativas autorizadas del protocolo, y los 18 síntomas DSM-5-TR) y `documento`.

Devuelve un JSON con esta estructura (omite lo que no esté en el documento; listas vacías si no hay):

{
  "documento": {
    "clase": "entrevista_apoderado | escala_estandarizada | observacion_narrativa | informe_general | informe_rv | otro",
    "instrumento": "nombre del instrumento o escala, si se menciona (p. ej. Conners 3, Nesplora AULA)",
    "autor": "rol o cargo del autor (no nombres propios)",
    "fecha": "fecha del documento tal como aparece",
    "condiciones": "condiciones de aplicación, si se describen"
  },
  "respuestas": [ { "pregunta_id": "A09", "codigo": "A", "evidencia": "frase literal" } ],
  "sintomas": [ { "sintoma": "R1.8", "presencia": "si | no | ocasionalmente | no_sabe", "frecuencia": "valor de la lista de frecuencia o null", "evidencia": "frase literal" } ],
  "datos": [ { "dato": "impacto_academico | impacto_social | apoyos | respuesta_apoyos | inicio | trayectoria | desarrollo | sueno | medico | sensorial | emocional | familiar | autonomia", "valor": "resumen breve fiel al texto", "evidencia": "frase literal" } ],
  "puntajes": [ { "escala": "...", "subescala": "...", "puntaje": "...", "interpretacion_del_documento": "lo que dice el propio documento", "evidencia": "frase literal" } ],
  "rv": { "variables": [ { "variable": "...", "resultado": "...", "interpretacion_del_documento": "...", "evidencia": "frase literal" } ], "limitaciones": ["..."] }
}

Reglas:
- `evidencia` debe ser una frase copiada EXACTAMENTE del documento (sin cambiar ni una letra).
- `respuestas` solo para entrevista_apoderado: usa únicamente `pregunta_id` y `codigo` del esquema.
  Para preguntas abiertas, usa `"codigo": null` y pon el texto en `evidencia`.
- `sintomas` solo para informe_escolar: lo que el colegio observa.
- `puntajes` y `rv` solo si el documento los informa. No interpretes más allá de lo que el
  documento dice.

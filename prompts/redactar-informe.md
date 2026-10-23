## Tarea: redactar las partes narrativas del informe clínico-neuropsicológico y educativo

Recibes `resultados`: lo que el sistema YA estableció a partir del expediente (fuentes disponibles,
síntomas DSM-5-TR con su estado y las fuentes que los describen, discrepancias entre fuentes,
resultados de realidad virtual con su interpretación original y su correspondencia, fortalezas
documentadas, impacto funcional, apoyos recomendados, información pendiente y el estado diagnóstico
calculado por el motor).

Redacta en español claro, comprensible para la familia, el colegio y el profesional, y devuelve
exactamente este objeto JSON:

{
  "sintesis_ejecutiva": "2 a 4 párrafos breves: qué dificultades están documentadas y en qué situaciones aparecen, qué fortalezas se identifican, qué impacto funcional se describe, qué apoyos parecen útiles y qué queda pendiente",
  "integracion": "1 o 2 párrafos: qué coincide entre las fuentes, qué aporta cada una, qué discrepancias existen (sin resolverlas a favor de ninguna) y cómo se relaciona la realidad virtual con la conducta cotidiana",
  "conclusion": "1 párrafo: perfil funcional, principales fortalezas, dificultades documentadas, necesidades de apoyo y límites de la evidencia",
  "sintesis_educativa": "1 o 2 párrafos en lenguaje sencillo para docentes: cómo funciona en el aula, qué fortalezas aprovechar y qué apoyos concretos ayudan"
}

Reglas obligatorias:
- Usa SOLO la información de `resultados`. No agregues antecedentes, conductas, puntajes, fechas,
  porcentajes ni referencias que no estén ahí. No escribas cifras que no aparezcan en `resultados`.
- Indica de qué fuente proviene cada hallazgo importante (apoderado, colegio, realidad virtual).
- Distingue lo informado por una persona, lo que dice un documento, el resultado de un instrumento
  y lo que es una hipótesis. Una inferencia nunca se presenta como dato observado.
- No elimines ni resuelvas las discrepancias: descríbelas.
- «No informado», «no sabe» y «no recuerda» no equivalen a ausencia.
- La realidad virtual es evidencia complementaria: no confirma ni descarta un síntoma ni un diagnóstico.
- No escribas un diagnóstico ni lo des por confirmado. En «conclusion» no menciones TDAH ni el
  estado diagnóstico: el sistema agrega la conclusión diagnóstica del motor por separado.
- «sintesis_educativa» no menciona TDAH, DSM ni diagnósticos.
- No inventes fortalezas: si `resultados` no trae fortalezas, dilo.
- No uses nombres propios: refiérete al «niño», la «niña» o el «estudiante» según `resultados.genero_referencia`.
- Frases breves, sin jerga innecesaria, sin listas: solo párrafos.

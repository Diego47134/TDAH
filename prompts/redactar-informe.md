## Tarea: redactar las secciones legibles del informe clínico

Recibes `resultados`: lo que el motor de reglas YA decidió (síntomas con estado y fuentes,
requisitos DSM-5-TR, puerta de suficiencia, tipo de resultado, áreas funcionales, explicaciones
alternativas, realidad virtual, sugerencias con referencias, información faltante).

Devuelve:
{
  "sintesis": "párrafo",
  "integracion_fuentes": "párrafo: convergencias y discrepancias entre apoderado, colegio, RV y otras fuentes",
  "perfil_funcional": "párrafo: fortalezas, dificultades, variabilidad según contexto, áreas que requieren apoyo",
  "diagnostico_diferencial": "párrafo",
  "orientaciones_colegio": [ { "orientacion": "...", "justificacion": "dificultad documentada que la justifica" } ],
  "pasos_siguientes": "párrafo"
}

Reglas:
- No cambies ni contradigas ningún estado, requisito ni el resultado; no agregues síntomas, datos ni
  referencias que no estén en `resultados`.
- No escribas la conclusión diagnóstica: la redacta el sistema con reglas.
- Separa hallazgos observados de interpretaciones; no atribuyas alteraciones neuroquímicas,
  de redes o anatómicas al niño o niña.
- Cada orientación para el colegio debe justificarse en una dificultad documentada.
- Español clínico claro, sin nombres propios.

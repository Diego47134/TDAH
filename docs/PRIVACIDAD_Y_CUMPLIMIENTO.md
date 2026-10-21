# Privacidad, tratamiento de datos de salud mental y cumplimiento normativo (Chile)

Revisión al 21-10-2026. Este documento resume cómo la plataforma aborda la normativa chilena aplicable a datos de salud mental de niños, niñas y adolescentes, y qué queda bajo responsabilidad del prestador que la usa. **No es asesoría legal**: los textos públicos (`public/privacidad.html`, `public/terminos.html`) deben ser revisados por la asesoría legal del responsable antes de usar la plataforma con pacientes reales.

## Normativa considerada

| Norma | Qué exige (en lo pertinente) | Cómo lo aborda la plataforma |
|---|---|---|
| **Ley 19.628**, modificada por la **Ley 21.719** (publicada el 13-12-2024; rige desde el 1-12-2026. El proyecto que la posterga al 1-12-2027 —Boletín 18.623-07— fue aprobado en general por la Comisión de Constitución del Senado el 19-10-2026; se discute si la postergación será total o escalonada) | Datos de salud física y mental = datos sensibles; consentimiento expreso; finalidad, proporcionalidad y minimización; seguridad con cifrado y seudonimización (art. 14 quinquies); reporte de vulneraciones a la Agencia «sin dilaciones indebidas» y aviso a los titulares si hay datos sensibles o de menores de 14 años (art. 14 sexies); deber de secreto; derechos de acceso, rectificación, supresión, oposición, bloqueo y portabilidad (respuesta en 30 días corridos, prorrogable 30); reporte de vulneraciones; Agencia de Protección de Datos Personales | Consentimiento expreso obligatorio para crear un caso (`src/privacidad.js`); seudónimos; finalidad única declarada; exportación íntegra del expediente (`GET /api/casos/:id/exportar`); auditoría de accesos y acciones; política de privacidad versionada; **cifrado AES-256-GCM** de datos clínicos, documentos y respaldos |
| **Ley 21.663** (marco de ciberseguridad, reporte de incidentes desde el 1-3-2025) | Prestadores de servicios esenciales (puede incluir prestadores institucionales de salud) reportan incidentes significativos a la ANCI | La política lo declara; el responsable verifica si está calificado |
| **Ley 20.584** (derechos y deberes de los pacientes) | Ficha clínica reservada; acceso restringido; conservación por al menos 15 años; consentimiento informado | Expediente persistente con respuesta literal, fuente y autoría; auditoría; respaldos; informe con aviso de confidencialidad |
| **Ley 21.331** (derechos en la atención de salud mental) | Consentimiento libre e informado (art. 4); protección de datos personales (art. 9 N° 14); no discriminación por diagnóstico (art. 9 N° 15); NNA informados y oídos (art. 25, que modifica la Ley 20.584) | Asentimiento del NNA obligatorio antes de su entrevista; aviso de no discriminación en el informe y en la política |
| **Decreto 41/2012 MINSAL** (reglamento de fichas clínicas) | Ficha electrónica con confidencialidad, autenticidad, respaldo y trazabilidad de quién modifica y cuándo | Registro inalterable de respuestas; decisiones auditadas con fecha; respaldos diarios (`VACUUM INTO`) |
| **Código Sanitario art. 111 y Decreto 825/1998** (dispositivos médicos, ISP) | Registro sanitario obligatorio solo para categorías incorporadas por decreto; la lista se amplió en 2026 (incluidas categorías de software clínico con plazos de implementación) | La plataforma se presenta como herramienta de apoyo, sin registro ISP; los términos de uso lo declaran y asignan al responsable verificar ante el ISP si corresponde registro |

## Funciones implementadas

- **Consentimiento informado del representante legal** (`POST /api/casos` con `consentimiento`): otorgante, relación (madre, padre, tutor legal, otro representante legal), medio (escrito firmado, electrónico, verbal registrado), profesional y versión de la política. Sin él, el caso no se crea (prueba L1).
- **Asentimiento del niño, niña o adolescente** (`POST /api/casos/:id/nna` con `asentimiento`) antes de su entrevista (prueba A7).
- **Sin servicios externos de procesamiento**: todas las respuestas se interpretan en el servidor de la aplicación; los datos no se envían a terceros.
- **Preguntas a la app**: cuando la app no tiene respuesta propia, busca automáticamente en Europe PMC. No envía el texto de la pregunta: solo términos clínicos reconocidos por un diccionario fijo (p. ej. «melatonina» → «melatonin»), de modo que nombres u otros datos escritos por el usuario nunca salen del servidor (prueba Q2).
- **Búsqueda en la web con confirmación**: si la app no reconoce términos clínicos, propone al profesional palabras de la pregunta sin nombres, palabras con mayúscula, números ni correos, y solo busca en MedlinePlus en español y Europe PMC si el profesional las confirma. Las preguntas del apoderado nunca salen como texto libre (pruebas Q5 y Q6).
- **Cifrado en reposo** de datos clínicos, documentos y respaldos, con clave separada de los datos (pruebas C1–C6). Ver [SEGURIDAD_Y_LICENCIAS.md](SEGURIDAD_Y_LICENCIAS.md).
- **Licencia por instalación**: sin licencia válida, solo lectura; la consulta y exportación de expedientes nunca se bloquean (pruebas L1 y L2).
- **Búsqueda bibliográfica en internet** (Europe PMC y PubMed): solo salen los términos que escribe el profesional; se rechazan búsquedas con RUT, correo o teléfono (prueba B2).
- **Derecho de acceso y portabilidad**: exportación íntegra en JSON, registrada en la auditoría (prueba L2).
- **Avisos legales**: `/privacidad.html` y `/terminos.html`, enlazados en la interfaz y en el formulario de consentimiento; sección «Consentimiento, confidencialidad y alcance» en todo informe (prueba L3).
- **Datos del responsable** configurables por variables de entorno (`RESPONSABLE_NOMBRE`, `RESPONSABLE_RUT`, `RESPONSABLE_DOMICILIO`, `RESPONSABLE_CORREO`); si faltan, las páginas muestran «[completar: …]» resaltado.

## Responsabilidades (deslinde)

| Actor | Rol | Responsabilidad |
|---|---|---|
| Prestador / profesional que usa la plataforma | Responsable del tratamiento y de la ficha clínica | Consentimientos, acceso del equipo, reserva, conservación, atención de derechos, notificación de vulneraciones, verificación regulatoria ante el ISP, decisiones clínicas |
| Profesional que valida el informe | Responsable clínico | Diagnóstico, interpretación e indicaciones (la plataforma no diagnostica) |
| Proveedor tecnológico | Encargado del tratamiento | Operar el software conforme a las instrucciones del responsable, sin usar los datos para fines propios |
| Europe PMC (EMBL-EBI), PubMed (NCBI) y MedlinePlus (NLM) | Fuentes públicas consultadas | Reciben solo términos de búsqueda, sin datos personales |
| Titular del software (licenciante) | Emite la licencia | No accede a los datos; la licencia se verifica sin conexión |
| Alojamiento (Hostinger) | Encargado | Prestación del servicio; puede implicar transferencia internacional |

## Pendientes recomendados antes del uso con pacientes reales

1. Completar los datos del responsable (variables `RESPONSABLE_*`) y revisar ambos textos con asesoría legal.
2. **Cuentas individuales por profesional** (hoy existe una clave compartida): necesario para la trazabilidad de «quién» exigida por el reglamento de fichas clínicas.
3. ~~Cifrado en reposo~~ (implementado). Pendiente del responsable: **custodiar la clave de cifrado** y copiar los respaldos cifrados fuera del servidor.
4. **Contrato de encargo** con el proveedor de alojamiento (cláusulas de confidencialidad, ubicación de datos y transferencia internacional).
5. **Evaluación de impacto** en protección de datos (tratamiento de datos sensibles de NNA) y procedimiento escrito de respuesta ante vulneraciones.
6. Procedimiento de revocación del consentimiento y de atención de solicitudes de rectificación y supresión (la supresión puede quedar limitada por la conservación obligatoria de la ficha clínica).
7. Consulta al ISP sobre si la plataforma queda comprendida en alguna categoría de dispositivo médico sujeta a control.

## Fuentes consultadas

- Trendtic, «Comisión de Constitución aprueba en general y por unanimidad proyecto que posterga su vigencia» (19-10-2026): https://www.trendtic.cl/2026/10/ley-de-proteccion-de-datos-comision-de-constitucion-aprueba-en-general-y-por-unanimidad-proyecto-que-posterga-su-vigencia-y-abre-debate-sobre-aplicacion-gradual/
- Time to Market, «¿Se posterga la Ley 21.719 a 2027? Estado en vivo» (Boletín 18.623-07): https://timetomarket.cl/ley-21719
- Alayia Trust, «Ley 21.719 y ciberseguridad (21.663)» (arts. 14 quinquies y 14 sexies): https://alayiatrust.com/en/blog/ley-21719-ciberseguridad-21663
- Allende Bascuñán, «Chile: comienza a regir la obligación de reportar incidentes de ciberseguridad»: https://allende.com/privacidad-y-ciberseguridad/chile-comienza-a-regir-la-obligacion-de-reportar-los-incidentes-de-ciberseguridad-04-08-2025/
- MedlinePlus, «Servicios web» (condiciones de uso, límite de 85 consultas por minuto, atribución): https://www.medlineplus.gov/about/developers/webservices

- Colegio Médico de Chile, «Protección de datos en el sector salud» (2026): https://www.colegiomedico.cl/wp-content/uploads/2026/04/Proteccion-de-datos-en-el-sector-salud.pdf
- DOE Actualidad Jurídica, «Ley N° 21.719: conoce más sobre la nueva ley de datos personales»: https://actualidadjuridica.doe.cl/ley-n-21-719-conoce-mas-sobre-la-nueva-ley-de-datos-personales/
- Ecosistema Startup, «Chile posterga al 2027 la Ley 21.719» (proyecto en trámite): https://ecosistemastartup.com/?p=104145
- Diario Oficial, Ley 21.331 (11-05-2021): https://www.diariooficial.interior.gob.cl/publicaciones/2021/05/11/42951/01/1942112.pdf
- Superintendencia de Salud, monografía «Ficha clínica» (2025): https://www.superdesalud.gob.cl/app/uploads/2025/12/monografia-ficha-clinica-2025-3.pdf
- Biblioteca del Congreso Nacional, Decreto 41/2012 Reglamento sobre fichas clínicas: https://www.bcn.cl/leychile/navegar?i=1046753
- Albagli Zaliasnik, «Global Practice Guides: salud y dispositivos médicos 2026»: https://www.az.cl/global-practice-guides-salud-dispositivos-medicos-2026/

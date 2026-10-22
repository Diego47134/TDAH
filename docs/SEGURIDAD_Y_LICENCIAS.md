# Cifrado en reposo y licencias

Revisión al 21-10-2026.

## 1. Cifrado en reposo

La Ley 21.719 (art. 14 quinquies) menciona expresamente el **cifrado** y la **seudonimización** como medidas de seguridad. Para los datos sensibles (salud mental de niños, niñas y adolescentes) la plataforma cifra todo lo clínico.

| Qué | Cómo | Dónde está el código |
|---|---|---|
| Campos clínicos de la base: respuestas literales, hechos, interpretaciones, informes, consentimientos, consultas, documentos (texto y nombre), mediciones de RV, auditoría | AES-256-GCM por valor, IV aleatorio de 96 bits y etiqueta de autenticación (detecta alteraciones). Formato `enc1:<huella>:<base64>` | `src/cifrado.js`, `SENSIBLES` en `src/db.js` |
| Documentos adjuntos | Archivo completo cifrado (cabecera `TDAHENC1`), nombre en disco opaco (`<fecha>-<aleatorio>.enc`) | `src/documentos.js` |
| Respaldos diarios | Copia completa cifrada `tdah-<fecha>.sqlite.enc` | `src/respaldo.js` |
| Datos borrados | `PRAGMA secure_delete`: las páginas liberadas se sobrescriben | `src/db.js` |

Las subclaves de campos y de archivos se derivan de una **clave maestra** de 32 bytes con HKDF-SHA256. La clave **nunca** se guarda en la base ni en los respaldos.

Qué queda sin cifrar, a propósito: identificadores internos, código del caso (`CASO-0001`), fechas, estados del flujo y textos de las preguntas del banco (no son datos del paciente). Se necesitan para consultar y ordenar sin descifrar.

### La clave maestra

Se toma, en este orden:

1. Variable de entorno **`TDAH_CLAVE_CIFRADO`** (recomendado). Generar una:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Archivo **`~/.tdah-clave-cifrado`** (o `TDAH_ARCHIVO_CLAVE`). Si no existe, la app lo crea la primera vez con permisos 600 y muestra un aviso en «Licencia y seguridad» y en `/api/salud`.

**Reglas importantes**

- **Guarde una copia de la clave fuera del servidor** (gestor de contraseñas). Sin ella, los datos y los respaldos no se pueden recuperar. Nadie puede descifrarlos sin esa clave, tampoco el proveedor.
- **Nunca cambie la clave** de una instalación con datos. La app comprueba la **huella** de la clave (visible en «Licencia y seguridad») contra la guardada en la base. Si no coincide, **no arranca** y lo explica: nunca mezcla datos de dos claves.
- Para pasar del archivo a la variable de entorno, copie el contenido de `~/.tdah-clave-cifrado` en `TDAH_CLAVE_CIFRADO`. Es la misma clave y la huella no cambia.

### Instalaciones existentes

Al primer arranque con esta versión, la app cifra automáticamente los datos que estaban en texto plano. También cifra los documentos y les quita el nombre original del archivo en disco. Después compacta la base (`VACUUM`) para que no queden restos legibles. Los respaldos **anteriores** a la actualización siguen sin cifrar: bórrelos o guárdelos en un lugar seguro.

### Restaurar un respaldo

```bash
TDAH_CLAVE_CIFRADO='<clave>' node scripts/restaurar-respaldo.js ~/tdah-datos/respaldos/tdah-2026-10-21T03-00-00.sqlite.enc restaurada.sqlite
```

Detenga la app, reemplace `~/tdah-datos/tdah.sqlite` por `restaurada.sqlite` y vuelva a iniciarla con la misma clave.

### Lo que el cifrado no cubre

- **Mientras la app está funcionando**, el servidor tiene la clave en memoria: protege copias de la base, respaldos robados o un disco extraído, no un servidor comprometido en vivo.
- **En Hostinger, las variables de entorno quedan en la misma cuenta.** Quien controle el panel puede leer la clave. Por eso son importantes la clave del panel, el doble factor y que solo usted lo administre.
- **En tránsito** el cifrado lo da HTTPS (certificado automático de Hostinger).

## 2. Licencias por instalación

### Cómo funciona

- Una licencia es un texto `TDAH1.<datos>.<firma>` firmado con **Ed25519** con la **clave privada del titular del software**.
- La app solo contiene la **clave pública** (`CLAVE_PUBLICA_LICENCIAS` en `src/licencia.js`): puede verificar licencias, pero no fabricarlas. Cualquier cambio en una licencia invalida su firma.
- **Datos de la licencia:** id, cliente, RUT, dominios autorizados, fecha de emisión, vencimiento o perpetua, máximo de casos (opcional) y número de profesionales (informativo).
- La verificación se hace en el servidor del cliente, **sin conexión a internet** y sin enviar datos a nadie.

### Qué pasa según el estado (solo en producción)

| Estado | Efecto |
|---|---|
| Vigente | Funciona normal |
| Vence en ≤ 30 días | Funciona, con aviso |
| Vencida hace ≤ 15 días (gracia) | Funciona, con aviso |
| Vencida > 15 días, ausente, alterada o en un dominio no autorizado | **Solo lectura**: se puede entrar, ver y **exportar** los expedientes (derechos de los titulares y conservación de la ficha clínica), pero no crear casos ni registrar información (HTTP 402) |
| Máximo de casos alcanzado | No se crean casos nuevos; los existentes siguen funcionando |

En desarrollo (`npm run dev`) la licencia no se exige.

### Emitir una licencia (titular del software)

La clave privada (`tdah-licencias-CLAVE-PRIVADA.pem`) **no está en el repositorio**. Guárdela fuera de línea, con respaldo. Si se pierde no se pueden emitir licencias nuevas, y si se filtra cualquiera podría emitirlas. En ambos casos genere un par nuevo con `node scripts/licencias.js claves <carpeta>`, reemplace la clave pública en `src/licencia.js` y vuelva a emitir las licencias vigentes.

```bash
node scripts/licencias.js emitir --privada ~/claves/tdah-licencias-CLAVE-PRIVADA.pem \
  --cliente "Centro Ejemplo SpA" --rut 76.123.456-7 \
  --dominio evaluacion.ejemplo.cl --vence 2027-12-31 --profesionales 3 > licencia.txt

node scripts/licencias.js verificar licencia.txt
```

- `--vence perpetua` (u omitirlo): licencia sin vencimiento.
- `--dominio` se puede repetir y acepta `*.ejemplo.cl`. Incluya también el dominio temporal de Hostinger si el cliente lo usará.
- `--casos N`: máximo de casos.

### Instalarla (cliente)

Hay dos formas:

- En la app: **Licencia y seguridad → Instalar licencia**, y pegar el texto. Se necesita la clave de acceso.
- En el hosting: definir la variable de entorno `TDAH_LICENCIA` (tiene prioridad sobre la instalada desde la app).

### Límites de cualquier licencia de software instalado en el servidor del cliente

Quien tenga el código fuente y acceso al servidor podría modificarlo para saltarse la verificación, por ejemplo ejecutándolo en modo desarrollo. La licencia es una medida técnica disuasiva **y un respaldo contractual**: los Términos de uso (§ 9) prohíben eludirla, y el registro del software en el Departamento de Derechos Intelectuales respalda la titularidad. Para un control fuerte, conviene que **el titular administre el hosting** (el cliente solo usa la app) en vez de entregar el código.

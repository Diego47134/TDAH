# Despliegue en Hostinger con dominio propio

La aplicación ya está preparada para el hosting **Node.js administrado** de Hostinger: tiene un punto de entrada de producción (`server.js`), guarda los datos fuera de la carpeta que Hostinger reemplaza en cada despliegue, hace respaldos automáticos y exige un token de acceso.

## 0. Requisitos

- **Plan:** Hostinger *Business Web Hosting* o un plan *Cloud* (Startup, Professional, Enterprise). Los planes Premium/Single no ejecutan apps Node.js. En un VPS también funciona, con Docker (ver al final).
- **Repositorio:** `Diego47134/TDAH` en GitHub (Hostinger pedirá autorizar el acceso a tu cuenta de GitHub, porque el repositorio es privado).
- **Dominio:** comprado en Hostinger o en otro registrador.

> Si el dominio ya tiene un sitio web creado en tu plan, Hostinger exige eliminar ese sitio antes de asignar el dominio a la app Node.js.

## 1. Clave de acceso

No hace falta configurar nada en Hostinger. La **primera vez que se abre la app** muestra «Configuración inicial» y pide crear la clave de acceso (mínimo 12 caracteres). Se guarda cifrada (scrypt) en la base de datos y desde entonces se pide a cada profesional al entrar. Ábrela tú apenas termine el despliegue, para que nadie más la cree antes.

Alternativa: definir la variable de entorno `APP_ACCESS_TOKEN`; si existe, tiene prioridad sobre la clave creada en la app.

## 2. Crear la app Node.js

En el panel de Hostinger: **Sitios web → Agregar sitio web → Aplicación web Node.js → Importar desde GitHub** y elegir `Diego47134/TDAH`, rama `main`.

Configuración del despliegue:

| Campo | Valor |
|---|---|
| Tipo de aplicación (framework) | **Other** (o Express) |
| Versión de Node.js | **24.x** |
| Directorio raíz | `/` (vacío) |
| Script de build | *(vacío)* |
| Directorio de salida | *(vacío)* |
| Archivo de entrada (entry file) | **`server.js`** |
| Gestor de paquetes | npm |

### Variables de entorno

En **Set environment variables** (o después en *Environment variables* del panel), agregar:

| Variable | Valor | ¿Obligatoria? |
|---|---|---|
| `ANTHROPIC_API_KEY` u `OPENAI_API_KEY` (+ `IA_PROVEEDOR`) | clave de la API de IA | No (sin ella funciona con el intérprete de reglas) |
| `APP_ACCESS_TOKEN` | clave fija de acceso | No (por defecto la clave se crea en la app) |

También puedes usar **Import .env** con el archivo `.env.hostinger.example` completado (nunca lo subas al repositorio con valores reales).

**Ninguna variable es obligatoria.** Si Hostinger propone `PORT`, `HOST` o `DB_PATH` (las toma del archivo de ejemplo), elimínalas: no hace falta definir `PORT`, `HOST`, `NODE_ENV` ni `DB_PATH`: `server.js` usa valores seguros por defecto.

Pulsa **Deploy**. Cada `git push` a `main` vuelve a desplegar automáticamente.

## 3. Conectar el dominio

Cuando el despliegue termine, la app queda en un dominio temporal de Hostinger. Para usar tu dominio:

1. **Sitios web** → junto a la app, **Connect domain** (o desde el *Website Dashboard* de la app).
2. Escribe tu dominio (p. ej. `evaluacion.tudominio.cl` o `tudominio.cl`) y confirma.
3. Sigue las instrucciones en pantalla si pide cambios de DNS:
   - **Dominio comprado en Hostinger:** se configura solo.
   - **Dominio en otro registrador:** apunta los *nameservers* a Hostinger, o crea los registros DNS que indique la pantalla.
4. El certificado SSL (HTTPS) se instala automáticamente. La propagación puede tardar hasta 24 horas; mientras tanto la app sigue respondiendo en el dominio temporal.

## 4. Verificar

1. Abre `https://tudominio` y crea la clave de acceso en la pantalla «Configuración inicial».
2. Abre `https://tudominio/api/salud`. Debe mostrar `"entorno": "produccion"`, `"configuracion_inicial_pendiente": false` y `"advertencias": []`.
3. Crea un caso de prueba con un seudónimo.
3. En el navegador (Chrome/Edge en el computador, o «Agregar a pantalla de inicio» en el celular) la app se puede instalar como PWA.

Si `advertencias` no está vacío, el texto indica qué falta corregir.

## Datos y respaldos

| Qué | Dónde (en tu cuenta de Hostinger) |
|---|---|
| Base de datos | `~/tdah-datos/tdah.sqlite` (fuera de `domains/…/hbuilds`, por lo que **no se borra al redesplegar**) |
| Respaldos automáticos | `~/tdah-datos/respaldos/` (uno al día, se conservan 14) |
| Registros de la app | *Runtime logs* en el panel de la app |

Puedes descargar los respaldos desde el **Administrador de archivos** o por SFTP. Para restaurar uno: detener la app, reemplazar `tdah.sqlite` por el respaldo y volver a iniciarla.

Variables opcionales: `DATA_DIR` (carpeta de datos), `BACKUP_EVERY_HOURS`, `BACKUP_KEEP`, `BACKUP_DISABLED=1`.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El despliegue falla con «no es compatible» | Seleccionar **Node.js 24.x** en la configuración (la app requiere 22.13 o superior). |
| Olvidé la clave de acceso | Definir `APP_ACCESS_TOKEN` en las variables de entorno (tiene prioridad) o, con el Administrador de archivos/SSH, borrar la fila `acceso` de la tabla `config` en `~/tdah-datos/tdah.sqlite` para volver a la configuración inicial. |
| «La clave ingresada no es correcta» | La clave no coincide; tras 20 intentos fallidos en 10 minutos el acceso se bloquea temporalmente. |
| La primera carga tras horas sin uso tarda unos segundos | Normal: Hostinger detiene la app sin tráfico y la vuelve a iniciar con la siguiente visita. Los datos no se pierden. |
| `advertencias` menciona «dentro de la carpeta de despliegue» | Se definió `DB_PATH` dentro de la app. Borrar esa variable para usar `~/tdah-datos`. |

## Alternativa: VPS de Hostinger con Docker

```bash
git clone https://github.com/Diego47134/TDAH.git && cd TDAH
docker build -t tdah .
docker run -d --restart unless-stopped -p 3000:3000 -v tdah-datos:/data \
  -e APP_ACCESS_TOKEN='tu-token' tdah
```

Después apunta el dominio al VPS con un registro **A** hacia la IP del servidor y pon delante un proxy con HTTPS (por ejemplo Caddy: `tudominio.cl { reverse_proxy localhost:3000 }`).

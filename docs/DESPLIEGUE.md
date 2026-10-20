# Despliegue · Horizontes en Hostinger (Coolify)

Responsable: equipo de infraestructura. Mismo patrón que el IRMI (https://github.com/yennyporras/IRMI, guías `docs/operacion/despliegue-staging.md` y `despliegue-produccion.md` del 13-oct-2026), con una diferencia de fondo: **Horizontes usa SQLite** (`node:sqlite`, un archivo en un volumen), no Postgres. Ningún secreto real va en este archivo ni en el repo: los valores se escriben solo en Coolify. Lo operativo del pipeline está en `deploy/README.md` y `tools/deploy.sh`.

## 1. Cómo corre

- **Servidor:** VPS de Hostinger con **Coolify v4**. La IP del VPS está en Hostinger → VPS → Resumen. El usuario de Coolify lo tiene Paola.
- **Origen:** repo privado `github.com/yennyporras/horizontes` conectado a Coolify con la GitHub App (`coolify-estratek`). Staging y producción salen de `main`; producción con Auto Deploy apagado.
- **Imagen:** `deploy/Dockerfile` multietapa (Node 24 alpine): typecheck, build de la SPA (`dist/web`) y una imagen de producción que corre el servidor Fastify con `tsx` en el puerto `3000`, con el usuario sin privilegios `horizontes` y `HEALTHCHECK` a `/api/health` (con el `wget` de Alpine).
- **Base de datos:** un archivo SQLite en el volumen `/data` (`DB_PATH=/data/horizontes.sqlite`, ya fijado en la imagen). Las migraciones se aplican solas al arrancar (idempotentes). No hay servicio de base de datos aparte.
- **Sesiones del panel:** se guardan en la base (tabla `sesiones_admin`, cookie `hz_admin` httpOnly con un token al azar). No hay secreto de sesión que configurar.
- **Una sola réplica:** el polling, la caché del tablero, los cierres programados y el modo demo viven en el proceso.

## 2. Recursos en Coolify

Proyecto **Horizontes** con dos ambientes:

| Ambiente | App | Rama | Dominio | Volumen |
|---|---|---|---|---|
| `staging` | `horizontes-staging` | `main` (Auto Deploy encendido) | `https://staging-horizontes.estratek.com.co` | `horizontes-datos-staging` en `/data` |
| `production` | `horizontes` | `main` (Auto Deploy apagado; Deploy manual) | `https://horizontes.estratek.com.co` | `horizontes-datos-prod` en `/data` |

Nunca compartas el volumen ni la base entre ambientes.

### 2.1 DNS (Hostinger → Dominios → estratek.com.co → DNS)

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `staging-horizontes` | IP del VPS | 3600 |
| A | `horizontes` | IP del VPS | 3600 |

No toques otros registros (el correo de Google Workspace depende de ellos). Verifica con `nslookup horizontes.estratek.com.co`.

### 2.2 Aplicación

- **+ New → Applications → Private Repository (with GitHub App)**, repo de Horizontes.
- **Build Pack:** `Dockerfile`, ubicación `/deploy/Dockerfile`, base `/`.
- **Ports Exposes:** `3000`. Sin *Ports Mappings*.
- **Advanced:** Force HTTPS. Certificado Let's Encrypt automático cuando el DNS responda.
- **Healthcheck:** `GET /api/health` → 200, puerto 3000, intervalo 30 s, timeout 10 s, 3 reintentos, start period 60 s. Si la base no responde, `/api/health` da 503 y Coolify marca el contenedor como enfermo.
- **Persistent Storage → Volume Mount:** `horizontes-datos-<ambiente>` en `/data`. Debe ser volumen, no bind mount.
- **Réplicas:** 1.

### 2.3 Variables de entorno (todas solo Runtime; secretos con Literal + candado)

`tools/deploy.sh staging|produccion` las reescribe en cada corrida. El dominio de producción (y con él `BASE_URL`) sale de `HZ_DOMINIO_PROD` en `deploy/.env.deploy`; sin ella, `horizontes.estratek.com.co` (ver §7).

| Variable | Staging | Producción | Notas |
|---|---|---|---|
| `APP_ENV` | `staging` | `production` | |
| `NODE_ENV` | `production` | `production` | Ya en la imagen. |
| `PORT` · `HOST` | `3000` · `0.0.0.0` | igual | Ya en la imagen. |
| `BASE_URL` | `https://staging-horizontes.estratek.com.co` | `https://horizontes.estratek.com.co` | Sin `/` final. Manda en las URL y QR de las mesas. |
| `TZ` | `America/Bogota` | `America/Bogota` | Hora del proceso y de los logs. Cada sala usa además la zona de su país. |
| `DB_PATH` | `/data/horizontes.sqlite` | igual | Ya en la imagen. Los respaldos automáticos quedan junto a ella, en `/data/respaldos/`. |
| `SUPERADMIN_USUARIO` | `paola` | `paola` | La cuenta superadministradora se crea la primera vez que arranca sobre una base vacía. |
| `SUPERADMIN_CLAVE` | 12 caracteres o más | otra distinta | Solo cuenta la primera vez. Después se cambia desde el panel, o con `admin:restablecer` si se perdió (§6.3). |
| `POLITICA_PRIVACIDAD_URL` | `https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/` | igual | Ver `docs/CONSENTIMIENTO.md`. |
| `TRUST_PROXY_HOPS` | `1` | `1` | Saltos de proxy de confianza (Traefik de Coolify). Define la IP que se guarda como evidencia del consentimiento. |

El `.env` local de la raíz es solo para desarrollo y no se sube (`.gitignore`).

### 2.4 Aperturas y cierres programados

No hace falta cron ni *Scheduled Task*: el servidor aplica lo vencido antes de responder cada petición y además cada 15 s con un intervalo propio. Cumple ± 15 s. Si el contenedor estuvo apagado a la hora de un cierre, se aplica en cuanto vuelve (o se descarta si ya no vale en el estado de la sala; queda en la bitácora). Por eso 1 réplica y `TZ=America/Bogota`.

## 3. Respaldos

- **Automáticos, por sala:** al empezar la sala, antes de reiniciar una ronda y al cerrarla, el servidor hace una copia consistente (`VACUUM INTO`) en `/data/respaldos/horizontes_<hora>_<sala>_<momento>.sqlite`. Conserva los 10 más recientes de cada sala.
- **Diario:** *Scheduled Task* de la app, `0 8 * * *` (3:00 a. m. Bogotá), con el comando de `deploy/README.md` (copia en caliente sin el binario `sqlite3`, que Alpine no trae) y conservando 7 días.
- **Al cerrar cada sala:** el admin descarga los CSV desde Exportar (`inscritos.csv`, `votos.csv` y `resultados.csv`). `resultados.csv` no lleva datos personales: es el que se puede entregar al cliente.
- Los respaldos viven en el mismo volumen del VPS. Para tener uno fuera, descarga el más reciente después de cada taller (§6.2, paso 2, con `docker cp`).
- Restaurar solo con aprobación de Paola (§6.2).

## 4. Primer despliegue (staging)

1. DNS de §2.1 creado y respondiendo.
2. Crear la app y el volumen (§2.2). `tools/deploy.sh diagnostico` hasta que todo diga `[ok]`.
3. `tools/deploy.sh staging` (fija dominio, healthcheck y variables, y pide el deploy). En *Logs*: migraciones aplicadas y cuenta superadministradora creada.
4. Estado **Running (healthy)**.
5. Comprobaciones desde tu equipo:
   ```sh
   curl -fsS https://staging-horizontes.estratek.com.co/api/health
   curl -sI https://staging-horizontes.estratek.com.co/admin | head -1   # 200 y certificado válido
   ```
6. Entrar a `/admin` con la cuenta superadministradora, crear una sala de prueba con 2 mesas, inscribir desde un celular por QR, votar y cerrar ronda. O lanzar la demostración (`POST /api/admin/demo`, solo la cuenta superadministradora): una sala de ensayo que se juega sola en cerca de un minuto.
7. Correr el recorrido de QA (`QA-tests/recorrido_integrado.cjs`) sobre staging.

## 5. Producción

1. Staging verde y el recorrido de QA aprobado.
2. App `horizontes` en el ambiente `production` con su propio volumen `horizontes-datos-prod`. Auto Deploy apagado.
3. `tools/deploy.sh produccion` (solo si staging está sano y corre el mismo commit que `main`).
4. Mismas comprobaciones de §4 con `horizontes.estratek.com.co`.
5. *Scheduled Task* del respaldo diario activa en la app de producción.

## 6. Problemas y recuperación

### 6.1 Caída en pleno taller

Objetivo: que la sala no pierda más de 3 minutos. Lo que ya se votó está guardado en el volumen; reiniciar el contenedor no borra nada.

1. **¿Es el wifi o el servidor?** Desde tu celular con datos móviles (no el wifi del salón) abre `https://horizontes.estratek.com.co/api/health`.
   - Responde `{"ok":true,...}`: el servidor está bien y el problema es la red del salón. Pide a la sala que use datos móviles o comparte el tuyo; los celulares retoman solos (el token queda guardado en cada uno).
   - No responde o da 503: sigue con el paso 2.
2. **Coolify → Projects → Horizontes → production → `horizontes`.** Mira el estado y las últimas líneas de *Logs*.
   - Contenedor detenido o *unhealthy*: **Restart**. Tarda entre 30 y 60 s. Al volver, la sala está donde iba.
   - Reinicia en bucle justo después de un despliegue: *Deployments* → **Redeploy** del despliegue anterior que funcionaba (la base no se toca).
   - `EACCES` o `SQLITE_CANTOPEN` en *Logs*: el volumen perdió el dueño. Ver §6.4.
3. **Si a los 3 minutos no volvió:** plan B en papel y Excel (`docs/PLAN_B.md`). Termina la ronda en curso en papel y no mezcles fuentes en la misma ronda.
4. **Cuando vuelva:** revisa en el panel que la sala esté en el estado correcto (un cierre programado que venció con el contenedor apagado se aplica al arrancar). A quien haya perdido la sesión, «Dar acceso de nuevo» desde Participantes.
5. Anota qué pasó y a qué hora en `docs/DECISIONES.md`.

### 6.2 Restaurar un respaldo

Solo con aprobación de Paola. Reemplaza toda la base del ambiente (todas las salas) por la del respaldo: lo que pasó después del respaldo se pierde. Se hace desde la terminal del VPS (Coolify → **Servers** → el VPS → **Terminal**, o por SSH).

1. **Ubica el contenedor, la imagen y el volumen:**
   ```sh
   docker ps --format '{{.Names}}  {{.Image}}' | grep -i horizontes
   docker volume ls | grep -i horizontes-datos
   ```
   Anota el nombre del contenedor de producción (`<contenedor>`), su imagen (`<imagen>`) y el volumen de producción (`<volumen>`).
2. **Elige el respaldo** y, si quieres, bájalo a tu equipo primero:
   ```sh
   docker exec <contenedor> ls -lt /data/respaldos/ /data/ | head -30
   docker cp <contenedor>:/data/respaldos/<archivo>.sqlite ./   # copia en el VPS, fuera del volumen
   ```
3. **Avisa** que la app va a estar fuera un par de minutos y **detén la app** en Coolify (**Stop**).
4. **Guarda la base actual y pon el respaldo en su lugar** con la misma imagen de la app (trae el usuario `horizontes`). Los archivos `-wal` y `-shm` de la base vieja se borran: si quedan, SQLite los aplicaría sobre el respaldo.
   ```sh
   docker run --rm -u 0 -v <volumen>:/data --entrypoint sh <imagen> -c '
     set -e
     cp /data/horizontes.sqlite /data/antes-de-restaurar-$(date +%Y%m%d-%H%M).sqlite
     cp /data/respaldos/<archivo>.sqlite /data/horizontes.sqlite
     rm -f /data/horizontes.sqlite-wal /data/horizontes.sqlite-shm
     chown horizontes:horizontes /data/horizontes.sqlite /data/antes-de-restaurar-*.sqlite'
   ```
5. **Arranca la app** en Coolify (**Start** o **Restart**) y espera **Running (healthy)**.
6. **Comprueba:** `curl -fsS https://horizontes.estratek.com.co/api/health` y, en el panel, que la sala tenga los inscritos y votos esperados.
7. Si algo salió mal, repite el paso 4 con `antes-de-restaurar-<fecha>.sqlite` en lugar del respaldo.
8. Anota la restauración en `docs/DECISIONES.md` (qué respaldo, por qué, quién aprobó).

### 6.3 Se perdió la clave de la cuenta superadministradora

Ninguna otra cuenta puede restablecerla desde el panel. En Coolify, pon la clave nueva en `SUPERADMIN_CLAVE` (**Save**, sin redeploy todavía) y en la terminal del contenedor (Coolify → la app → **Terminal**):
```sh
node_modules/.bin/tsx server/restablecer_superadmin.ts             # dice qué haría, no cambia nada
node_modules/.bin/tsx server/restablecer_superadmin.ts --confirmar # aplica
```
Si la variable no se ve todavía en la terminal, haz **Restart** y repite. El script pone esa clave, activa la cuenta, no pide cambiarla y cierra sus sesiones abiertas. No imprime la clave. En local: `SUPERADMIN_CLAVE='…' npm run admin:restablecer -- --confirmar`.

### 6.4 Otros

- **`EACCES` en `/data`:** el volumen se creó como root. Desde la terminal del VPS: `docker exec -u 0 <contenedor> chown -R horizontes:horizontes /data` y **Restart**.
- **Certificado no sale:** el DNS aún no apunta al VPS; espera y redeploy.
- **Los cierres programados no se aplican a la hora:** revisa `TZ`, que haya 1 sola réplica y la hora del servidor (`servidor_at` del detalle de sala, que el panel usa al programar).
- **Reversión de la app:** *Deployments* → **Redeploy** del despliegue anterior. Las migraciones solo agregan, así que la versión anterior lee la base nueva. No se restaura la base para revertir la app.
- **Aviso rojo en el panel «Los QR apuntan a …, pero estás en …»** (C19-1): el `BASE_URL` de esa app no es el dominio desde el que abriste el panel. Coolify → la app → **Environment Variables** → `BASE_URL` con el dominio de ese ambiente, con `https://` y sin `/` final → **Save** → **Redeploy**. Los QR impresos con el dominio equivocado hay que volver a imprimirlos desde **Mesas y QR**.

## 7. Cambio a horizontes.com.co

Acta A10: el dominio oficial pasa a `horizontes.com.co`. El código no tiene el dominio fijo: QR y enlaces salen de `BASE_URL`, y `tools/deploy.sh` toma el dominio de producción de `HZ_DOMINIO_PROD` (si no está, sigue `horizontes.estratek.com.co`). Lo hace Paola, en este orden. Hasta el paso 5 nada cambia para quien use el dominio actual.

1. **Comprar el dominio.** Hostinger → **Dominios** → **Obtener nuevo dominio** → busca `horizontes.com.co` → **Comprar**. Titular: Estratek S.A.S. Activa la renovación automática.
2. **DNS.** Hostinger → **Dominios** → `horizontes.com.co` → **DNS / Nameservers** → **Registros DNS**:
   - Borra el registro `A @` que Hostinger crea apuntando a la página de estacionamiento (y el `CNAME www` si existe).
   - Agrega `A` · Nombre `@` · Valor: la IP del VPS · TTL `3600`.
   - Agrega `CNAME` · Nombre `www` · Valor `horizontes.com.co` · TTL `3600`.
   - Verifica desde tu equipo: `nslookup horizontes.com.co` debe devolver la IP del VPS. Puede tardar de minutos a unas horas.
3. **Dominio en Coolify.** Coolify → **Projects** → **Horizontes** → **production** → `horizontes` → **Configuration** → **General** → **Domains**: `https://horizontes.com.co,https://horizontes.estratek.com.co` (los dos, separados por coma, para que los QR ya impresos sigan funcionando) → **Save**.
4. **BASE_URL.** En la misma app → **Environment Variables** → `BASE_URL` = `https://horizontes.com.co` (sin `/` final) → **Save**.
5. **Deploy.** Botón **Deploy** (o **Redeploy**). Coolify pide el certificado del dominio nuevo cuando el DNS ya responde. Comprueba:
   ```sh
   curl -fsS https://horizontes.com.co/api/health
   curl -sI https://horizontes.com.co/admin | head -1   # 200 y candado válido en el navegador
   ```
6. **`deploy/.env.deploy` en tu equipo.** Agrega `HZ_DOMINIO_PROD=horizontes.com.co`. Sin esta línea, el siguiente `tools/deploy.sh produccion` vuelve a fijar el dominio y `BASE_URL` viejos. Con ella, los pasos 3 a 5 también se pueden hacer con un solo `tools/deploy.sh produccion` (deja solo el dominio nuevo; si necesitas los dos, agrega el viejo a mano en el paso 3 después de correrlo).
7. **Reimprimir los QR.** Panel → sala → **Mesas y QR**: el enlace bajo cada QR debe decir `horizontes.com.co/m/...`. Imprime o genera el PDF con `QA-tests/hoja_qr_pdf.cjs` (ver `docs/ENTREGA.md`).
8. **Sesiones del panel.** La cookie del admin es por dominio: cada admin vuelve a iniciar sesión una vez en el dominio nuevo.
9. **Retirar el dominio viejo** (cuando no quede ningún QR viejo impreso): quítalo de **Domains** en Coolify, **Save** y **Redeploy**. No toques los demás registros de `estratek.com.co` (el correo depende de ellos).

Staging puede quedarse en `staging-horizontes.estratek.com.co`; no necesita el dominio nuevo.

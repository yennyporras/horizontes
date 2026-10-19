# Despliegue · Horizontes en Hostinger (Coolify)

Dueño: T4. Fuente: guías del IRMI `C:\Users\ypaol\irmi\docs\operacion\despliegue-staging.md` y `despliegue-produccion.md` (13-oct-2026). Ningún secreto real va en este archivo ni en el repo: los valores se escriben solo en Coolify.

## 1. Cómo se despliega el IRMI (lo que ya existe)

- **Servidor:** VPS de Hostinger con **Coolify v4** (panel web). La IP del VPS está en Hostinger → VPS. El usuario de Coolify lo tiene Paola.
- **Origen:** repo privado en GitHub conectado a Coolify con una GitHub App (`coolify-estratek`). Staging sale de `develop`, producción de `main`.
- **Build:** `Dockerfile` multietapa en la raíz (Node 24 alpine + pnpm): instala, compila la web con Vite hacia `server/public`, compila el servidor y arma una imagen de producción que corre `node dist/index.js` en el puerto `3000`, con usuario sin privilegios y `HEALTHCHECK` a `/api/v1/health`.
- **Base de datos:** recurso PostgreSQL 17 (`postgres:17-alpine`) dentro del mismo ambiente de Coolify, sin acceso público. La app usa la *Postgres URL (internal)* como `DATABASE_URL`.
- **Arranque:** migraciones, semillas y cuentas admin se aplican solas al iniciar el contenedor (idempotentes). Si algo falla, el contenedor no arranca.
- **Dominio y SSL:** registro A en el DNS de Hostinger apuntando a la IP del VPS; Coolify pide el certificado Let's Encrypt solo y fuerza HTTPS.
- **Respaldo:** pestaña *Backups* del recurso Postgres, diario `0 8 * * *` (hora del servidor, UTC = 3:00 a. m. Bogotá).
- **Producción:** se clonó desde staging con *Resource Operations* y se cambiaron secretos y URLs. Auto Deploy apagado: se despliega a mano con **Deploy**.
- **Reversión:** *Deployments* → **Redeploy** del último que funcionaba. La base no se toca.

## 2. Replicarlo para Horizontes

### 2.1 Recursos en Coolify

Proyecto nuevo **Horizontes** con dos ambientes:

| Ambiente | App | Rama | Dominio | BD |
|---|---|---|---|---|
| `staging` | `horizontes-staging` | `main` (Auto Deploy encendido) | `https://staging-horizontes.estratek.com.co` | `horizontes-postgres-staging` o volumen SQLite |
| `production` | `horizontes-prod` | `main` (Auto Deploy apagado; Deploy manual) | `https://horizontes.estratek.com.co` | `horizontes-postgres-prod` o volumen SQLite |

Producción se clona desde staging cuando staging esté verde (igual que el IRMI) y se cambian los secretos.

### 2.2 DNS (Hostinger → Dominios → estratek.com.co → DNS)

| Tipo | Nombre | Valor | TTL |
|---|---|---|---|
| A | `staging-horizontes` | IP del VPS | 3600 |
| A | `horizontes` | IP del VPS | 3600 |

No toques otros registros (el correo de Google Workspace depende de ellos). Verifica con `nslookup horizontes.estratek.com.co`.

### 2.3 Aplicación

- **+ New → Applications → Private Repository (with GitHub App)**, repo de Horizontes.
- **Build Pack:** `Dockerfile`, ubicación `/deploy/Dockerfile`, base `/`. Mismo patrón del IRMI: build de la web (participante, tablero y admin) servida como estáticos por el mismo servidor Fastify, un solo puerto `3000`. Ver `deploy/README.md` y `tools/deploy.sh`.
- **Ports Exposes:** `3000`. Sin *Ports Mappings*.
- **Advanced:** Force HTTPS. Certificado Let's Encrypt automático cuando el DNS responda.
- **Healthcheck:** `GET /api/health` → 200, puerto 3000, intervalo 30 s, timeout 10 s, 3 reintentos, start period 60 s. (T1 publica la ruta; si cambia, se ajusta aquí.)
- **Réplicas:** 1. El polling y los cierres programados asumen un solo proceso.

### 2.4 Base de datos

T1 fijó **SQLite** (`node:sqlite`) en `docs/STACK.md`. Se usa la segunda opción; la de Postgres queda como referencia por si se cambia el stack.

- **Postgres (mismo stack del IRMI, recomendado):** + New → Databases → PostgreSQL, imagen `postgres:17-alpine`, sin acceso público. Copia la *Postgres URL (internal)* a `DATABASE_URL`. Migraciones y semilla `data/seed_foodsume.json` al arrancar.
- **SQLite (vigente):** *Persistent Storage → Volume Mount* `horizontes-datos-<ambiente>` en `/data`. La imagen ya trae `DB_PATH=/data/horizontes.sqlite`. Debe ser volumen, no bind mount. Un volumen distinto por ambiente.

### 2.5 Variables de entorno (todas solo Runtime; secretos con Literal + candado)

El dominio de producción que usa `tools/deploy.sh` (y con él `BASE_URL`) sale de `HZ_DOMINIO_PROD` en `deploy/.env.deploy`; sin ella, `horizontes.estratek.com.co`. Ver §6.


| Variable | Staging | Producción | Notas |
|---|---|---|---|
| `APP_ENV` | `staging` | `production` | |
| `NODE_ENV` | `production` | `production` | |
| `PORT` | `3000` | `3000` | |
| `BASE_URL` | `https://staging-horizontes.estratek.com.co` | `https://horizontes.estratek.com.co` | Sin `/` final. Se usa en las URL y QR de las mesas. |
| `TZ` | `America/Bogota` | `America/Bogota` | Hora del proceso y de los logs. Cada sala usa además la zona de su país (Colombia, Perú o Guatemala), que el admin elige en Configuración. |
| `DB_PATH` | `/data/horizontes.sqlite` (ya en la imagen) | igual, en el volumen de prod | Nunca compartir la base ni el volumen entre ambientes. |
| `SESSION_SECRET` | `openssl rand -hex 32` | otro distinto | Solo si T1 firma la cookie `hz_admin` con secreto (ver `docs/STACK.md`). Si cambia, los admins vuelven a iniciar sesión. |
| `SUPERADMIN_USUARIO` | `paola` | `paola` | Se crea la primera vez que arranca sobre una base vacía. |
| `SUPERADMIN_CLAVE` | ≥ 12 caracteres | otra distinta | Solo cuenta la primera vez. Después, se cambia desde el panel o con el script de restablecer de T1. |
| `POLITICA_PRIVACIDAD_URL` | `https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/` | igual | Ver `docs/CONSENTIMIENTO.md`. |
| `TRUST_PROXY_HOPS` | `1` | `1` | IP real detrás del proxy de Coolify: evidencia del consentimiento y registro interno de cada inscripción y voto (acta A1 y P4). |
| `CIERRES_INTERVALO_MS` | no aplica | no aplica | El servidor usa 15 s fijos (no lee esta variable). |

El `.env` local de la raíz es solo para desarrollo y no se sube (`.gitignore`).

### 2.6 Cierres programados

No hace falta cron del sistema ni *Scheduled Task* de Coolify:
1. **Chequeo perezoso:** antes de responder cualquier petición, el servidor aplica `cierre_programado_ronda_at` y `cierre_programado_sala_at` vencidos (SPEC §5).
2. **Intervalo:** el proceso Node corre un `setInterval` cada 15 s que hace lo mismo, así se cierra aunque nadie esté consultando. Cumple el criterio ± 15 s.
3. Si en algún momento el servidor no pudiera tener un intervalo (PHP), se agrega en Coolify *Scheduled Tasks* un `curl -fsS http://localhost:3000/api/interno/cierres` cada minuto y se acepta ± 60 s (anotar en `DECISIONES.md`).

Por eso la app corre con **1 réplica** y `TZ=America/Bogota`.

### 2.7 Respaldo

- **Postgres:** pestaña *Backups*, diario `0 8 * * *`; en el día del taller, agregar uno manual antes de empezar y otro al cerrar la sala.
- **SQLite:** *Scheduled Tasks* de la app, `0 8 * * *`: copia en caliente con `VACUUM INTO` (comando en `deploy/README.md`, no requiere el binario `sqlite3`) y conservar 7 días.
- Además, el admin descarga los CSV (`inscritos.csv`, `votos.csv`) al cerrar cada sala.
- Restaurar solo con aprobación de Paola.

## 3. Primer despliegue (staging)

1. DNS del paso 2.2 creado y respondiendo.
2. Crear BD (2.4), app (2.3) y variables (2.5). Guardar.
3. **Deploy** (o `tools/deploy.sh staging`, que además fija dominio, healthcheck y variables). Ver el log del build y luego *Logs*: migraciones, semilla Foodsume y superadmin creados.
4. Estado **Running (healthy)**.
5. Comprobaciones desde tu equipo:
   ```sh
   curl -fsS https://staging-horizontes.estratek.com.co/api/health
   curl -sI https://staging-horizontes.estratek.com.co/admin | head -1   # 200 y certificado válido
   ```
6. Entrar a `/admin` con el superadmin, cambiar la clave, crear una sala de prueba con 2 mesas, inscribir desde un celular por QR, votar y cerrar ronda.
7. Correr `/qa-my-app:init` sobre staging (R2-T4).

## 4. Producción

1. Staging verde y `/qa-my-app:run-all` aprobado.
2. *Resource Operations* → clonar app y BD al ambiente `production`.
3. Cambiar en `horizontes-prod`: `APP_ENV`, `BASE_URL`, `DATABASE_URL`/volumen (los de prod), `SESSION_SECRET`, `SUPERADMIN_CLAVE`. Auto Deploy apagado.
4. **Deploy** manual. Mismas comprobaciones del paso 3 con `horizontes.estratek.com.co`.
5. Backups programados activos en la BD de prod.

## 5. Reversión y problemas frecuentes

- Reversión: *Deployments* → **Redeploy** del despliegue anterior. Las migraciones deben ser compatibles hacia atrás. No se restaura la base para revertir la app.
- Contenedor reinicia en bucle: primera línea con `ERROR` en *Logs* (casi siempre `DATABASE_URL` o `SESSION_SECRET`).
- Certificado no sale: el DNS aún no apunta al VPS; esperar y redeploy.
- `EACCES` en `/data`: el volumen se creó como root; `docker exec -u 0 <contenedor> chown -R node:node /data` desde la terminal del VPS.
- Los cierres programados no se aplican a la hora: revisar `TZ`, que haya 1 sola réplica y el log del intervalo.

## 6. Cambio a horizontes.com.co

Acta A10: el dominio oficial pasa a `horizontes.com.co`. El código no tiene el dominio fijo: QR y enlaces salen de `BASE_URL`, y `tools/deploy.sh` toma el dominio de producción de `HZ_DOMINIO_PROD` (si no está, sigue `horizontes.estratek.com.co`). Lo hace Paola, en este orden. Hasta el paso 5 nada cambia para quien use el dominio actual.

1. **Comprar el dominio.** Hostinger → **Dominios** → **Obtener nuevo dominio** → busca `horizontes.com.co` → **Comprar**. Titular: Estratek S.A.S. Activa la renovación automática.
2. **DNS.** Hostinger → **Dominios** → `horizontes.com.co` → **DNS / Nameservers** → **Registros DNS**:
   - Borra el registro `A @` que Hostinger crea apuntando a la página de estacionamiento (y el `CNAME www` si existe).
   - Agrega `A` · Nombre `@` · Valor: la IP del VPS (Hostinger → **VPS** → **Resumen** → Dirección IP) · TTL `3600`.
   - Agrega `CNAME` · Nombre `www` · Valor `horizontes.com.co` · TTL `3600`.
   - Verifica desde tu equipo: `nslookup horizontes.com.co` debe devolver la IP del VPS. Puede tardar de minutos a unas horas.
3. **Dominio en Coolify.** Coolify → **Projects** → **Horizontes** → **production** → `horizontes-prod` → **Configuration** → **General** → **Domains**: `https://horizontes.com.co,https://horizontes.estratek.com.co` (los dos, separados por coma, para que los QR ya impresos sigan funcionando) → **Save**.
4. **BASE_URL.** En la misma app → **Environment Variables** → `BASE_URL` = `https://horizontes.com.co` (sin `/` final) → **Save**. Este valor manda en los QR y en los enlaces del panel.
5. **Deploy.** Botón **Deploy** (o **Redeploy**). Coolify pide el certificado Let's Encrypt del dominio nuevo cuando el DNS ya responde. Comprueba:
   ```sh
   curl -fsS https://horizontes.com.co/api/health
   curl -sI https://horizontes.com.co/admin | head -1   # 200 y candado válido en el navegador
   ```
6. **`deploy/.env.deploy` en tu equipo.** Agrega `HZ_DOMINIO_PROD=horizontes.com.co`. Sin esta línea, el siguiente `tools/deploy.sh produccion` vuelve a fijar el dominio y `BASE_URL` viejos. Con ella, los pasos 3 a 5 también se pueden hacer con un solo `tools/deploy.sh produccion` (deja solo el dominio nuevo; si necesitas los dos, agrega el viejo a mano en el paso 3 después de correrlo).
7. **Reimprimir los QR.** Panel → sala → **Mesas y QR**: el enlace bajo cada QR debe decir `horizontes.com.co/m/...`. Imprime con **Imprimir hoja de QR** o genera el PDF con `QA-tests/hoja_qr_pdf.cjs` (ver `docs/ENTREGA.md`).
8. **Sesiones del panel.** La cookie del admin es por dominio: cada admin vuelve a iniciar sesión una vez en el dominio nuevo.
9. **Retirar el dominio viejo** (cuando no quede ningún QR viejo impreso): quítalo de **Domains** en Coolify, **Save** y **Redeploy**. El registro DNS `horizontes` de `estratek.com.co` se puede borrar después. No toques los demás registros de `estratek.com.co` (el correo depende de ellos).

Staging puede quedarse en `staging-horizontes.estratek.com.co`; no necesita el dominio nuevo.

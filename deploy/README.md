# deploy · Horizontes

Dueña: T4. Guía completa de infraestructura en `docs/DESPLIEGUE.md`; aquí va lo operativo del pipeline.

## Archivos
| Archivo | Para qué |
|---|---|
| `Dockerfile` | Imagen única: build de la SPA (`dist/web`) + servidor Fastify con `tsx`, Node 24 alpine, usuario sin privilegios, `HEALTHCHECK` a `/api/health`, base SQLite en el volumen `/data`. |
| `Dockerfile.dockerignore` | Exclusiones del contexto de build (BuildKit lo toma por estar junto al Dockerfile). |
| `../tools/deploy.sh` | Pipeline idempotente: `verificar`, `local`, `staging`, `produccion`, `revisar`. |
| `desplegar.sh` | Atajo que llama a `tools/deploy.sh` (compatibilidad). |
| `env.deploy.ejemplo` | Plantilla de `deploy/.env.deploy` (credenciales de Coolify, nunca en git). |

## Un comando
```sh
tools/deploy.sh verificar         # construye la imagen, la arranca, revisa /api/health, /admin, /m y /tablero
tools/deploy.sh local             # ensayo tipo staging en http://localhost:3999 con volumen propio (parar: tools/deploy.sh parar-local)
tools/deploy.sh staging           # tools/test.sh + push de main + dominio y variables en Coolify + deploy + DNS, HTTPS y salud
tools/deploy.sh produccion        # solo si staging está sano
tools/deploy.sh revisar staging   # solo comprueba DNS, certificado, /api/health y la SPA
```
`staging` y `produccion` son idempotentes: en cada corrida reescriben con los mismos valores el dominio (`https://<dominio>`, así Coolify emite y renueva el certificado Let's Encrypt), el healthcheck y las variables del servidor (el `.env` de la app en Coolify: `APP_ENV`, `NODE_ENV`, `PORT`, `HOST`, `TZ`, `DB_PATH`, `BASE_URL`, `SUPERADMIN_USUARIO`, `POLITICA_PRIVACIDAD_URL`, `CONSENTIMIENTO_VERSION` y `SUPERADMIN_CLAVE` si viene en `deploy/.env.deploy`) y luego piden el deploy. Opciones: `SIN_PRUEBAS=1`, `SIN_PUSH=1`.

Lo que el script no crea (una sola vez, a mano en Coolify): la app, el volumen `/data` y la tarea de respaldo. Ver abajo.

Cierres programados: no hay cron. El servidor revisa los cierres vencidos en cada petición y con un intervalo propio de 15 s (`docs/DESPLIEGUE.md` §2.6). Por eso 1 réplica y `TZ=America/Bogota`.

## Ensayos y carga
```sh
tools/deploy.sh local
npm run simular -- --url http://localhost:3999 --usuario paola --clave ensayo-local-123      # desde Windows: lo frena el proxy de puertos de Docker Desktop
docker cp tools/simulador.ts horizontes-local:/tmp/sim.mts && docker exec -w /app horizontes-local node_modules/.bin/tsx /tmp/sim.mts --url http://127.0.0.1:3000 --usuario paola --clave ensayo-local-123
npm run simular -- --url https://staging-horizontes.estratek.com.co --usuario paola --clave '...'   # cuando staging exista
PWCORE=... CHROME=... node QA-tests/recorrido_admin.cjs http://localhost:3999 paola ensayo-local-123 <carpeta>   # sala completa desde el panel
```

## Coolify (resumen; detalle en docs/DESPLIEGUE.md §2)
- App `horizontes-staging`: repo de Horizontes en GitHub, rama `main`, Build Pack **Dockerfile**, *Dockerfile Location* `/deploy/Dockerfile`, *Base Directory* `/`, puerto `3000`, 1 réplica.
- *Persistent Storage* → Volume Mount `horizontes-datos-staging` en `/data` (la base es `DB_PATH=/data/horizontes.sqlite`, ya fijada en la imagen).
- Variables (Runtime): `BASE_URL`, `POLITICA_PRIVACIDAD_URL`, `SUPERADMIN_USUARIO`, `SUPERADMIN_CLAVE` y las que T1 agregue (ver `docs/STACK.md`). `PORT`, `HOST`, `TZ` y `DB_PATH` ya vienen en la imagen.
- Dominio `https://staging-horizontes.estratek.com.co`, Force HTTPS.

## Credenciales
Faltan y están en `docs/BLOQUEOS.md`: repo de Horizontes en GitHub conectado a la GitHub App de Coolify, usuario de Coolify, token de API y UUID de las apps, registro DNS `staging-horizontes`. Cuando Paola los tenga, se llena `deploy/.env.deploy` y se corre `tools/deploy.sh staging`.

## Respaldo de SQLite
*Scheduled Task* de la app, diario `0 8 * * *` (3:00 a. m. Bogotá):
```sh
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.env.DB_PATH);d.exec(\"VACUUM INTO '/data/respaldo-\"+new Date().toISOString().slice(0,10)+\".sqlite'\")"
```
`VACUUM INTO` copia la base en caliente sin depender del binario `sqlite3` (Alpine no lo trae).
Para conservar 7 días, en la misma tarea: `find /data -name 'respaldo-*.sqlite' -mtime +7 -delete`.

# deploy · Horizontes

Dueña: T4. Guía completa de infraestructura en `docs/DESPLIEGUE.md`; aquí va lo operativo del pipeline.

## Archivos
| Archivo | Para qué |
|---|---|
| `Dockerfile` | Imagen única: build de la SPA (`dist/web`) + servidor Fastify con `tsx`, Node 24 alpine, usuario sin privilegios, `HEALTHCHECK` a `/api/health`, base SQLite en el volumen `/data`. |
| `Dockerfile.dockerignore` | Exclusiones del contexto de build (BuildKit lo toma por estar junto al Dockerfile). |
| `desplegar.sh` | Pipeline: `verificar` (imagen local + salud), `staging`, `produccion`. |
| `env.deploy.ejemplo` | Plantilla de `deploy/.env.deploy` (credenciales de Coolify, nunca en git). |

## Un comando
```sh
deploy/desplegar.sh verificar     # construye la imagen, la arranca en :3999, revisa /api/health y /admin
deploy/desplegar.sh staging       # tools/test.sh + git push origin main + deploy en Coolify + salud de staging
deploy/desplegar.sh produccion    # solo si staging está sano; deploy manual de producción
```
Con Auto Deploy encendido en la app de staging, basta con que `main` llegue a GitHub: Coolify construye solo. El comando `staging` además espera a que `https://staging-horizontes.estratek.com.co/api/health` responda.

## Coolify (resumen; detalle en docs/DESPLIEGUE.md §2)
- App `horizontes-staging`: repo de Horizontes en GitHub, rama `main`, Build Pack **Dockerfile**, *Dockerfile Location* `/deploy/Dockerfile`, *Base Directory* `/`, puerto `3000`, 1 réplica.
- *Persistent Storage* → Volume Mount `horizontes-datos-staging` en `/data` (la base es `DB_PATH=/data/horizontes.sqlite`, ya fijada en la imagen).
- Variables (Runtime): `BASE_URL`, `POLITICA_PRIVACIDAD_URL`, `SUPERADMIN_USUARIO`, `SUPERADMIN_CLAVE` y las que T1 agregue (ver `docs/STACK.md`). `PORT`, `HOST`, `TZ` y `DB_PATH` ya vienen en la imagen.
- Dominio `https://staging-horizontes.estratek.com.co`, Force HTTPS.

## Credenciales
Faltan y están en `docs/BLOQUEOS.md`: repo de Horizontes en GitHub conectado a la GitHub App de Coolify, usuario de Coolify, token de API y UUID de las apps, registro DNS `staging-horizontes`. Cuando Paola los tenga, se llena `deploy/.env.deploy` y se corre `deploy/desplegar.sh staging`.

## Respaldo de SQLite
*Scheduled Task* de la app, diario `0 8 * * *` (3:00 a. m. Bogotá):
```sh
node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(process.env.DB_PATH);d.exec(\"VACUUM INTO '/data/respaldo-\"+new Date().toISOString().slice(0,10)+\".sqlite'\")"
```
`VACUUM INTO` copia la base en caliente sin depender del binario `sqlite3` (Alpine no lo trae).
Para conservar 7 días, en la misma tarea: `find /data -name 'respaldo-*.sqlite' -mtime +7 -delete`.

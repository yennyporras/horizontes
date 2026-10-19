# Stack

- Repo del IRMI (ruta): `C:\Users\ypaol\irmi` (en Git Bash: `../irmi` desde cada worktree). Monorepo pnpm + turbo, `apps/irmi/server` (Fastify 5 + TS + Drizzle + Postgres 17) y `apps/irmi/web` (React 18 + Vite 6 + react-router 7 + Montserrat). Se despliega con `Dockerfile` en Coolify v4 sobre el VPS (servidor cloud) de Hostinger: `develop` → staging, `main` → producción.
- Backend: **Node 24 + Fastify 5 + TypeScript** (ejecutado con `tsx`, sin paso de compilación). Mismo framework que el IRMI.
- Frontend: **React 18 + Vite 6 + react-router-dom 7 + TypeScript**, fuente `@fontsource-variable/montserrat`. Una sola SPA con 4 rutas raíz: `/` (landing), `/m/:codigo` (participante), `/tablero/:sala` (tablero) y `/admin` (panel).
- Base de datos: **SQLite** con el módulo nativo `node:sqlite` (sin compilación nativa, funciona igual en Windows y Linux). Archivo en `DB_PATH` (por defecto `data/horizontes.sqlite`, ignorado por git). En producción vive en un volumen persistente del contenedor. Ver decisión en `docs/DECISIONES.md`.
- Pruebas: **Vitest 3** (servidor y motor en entorno node; pruebas de React con `// @vitest-environment jsdom` y `@testing-library/react`, ya instalados).
- Hosting: servidor cloud de Hostinger con Coolify, igual que el IRMI (Dockerfile, puerto 3000, healthcheck `GET /api/health`). Dominio `horizontes.estratek.com.co`, staging `staging-horizontes.estratek.com.co`. Guía en `docs/DESPLIEGUE.md` y `deploy/README.md`.
- Componente de consentimiento del IRMI (ruta):
  - UI: `../irmi/apps/irmi/web/src/pages/sala/SalaParticipante.tsx` (bloque "Autorización de tratamiento de datos", región con scroll + casilla obligatoria, líneas ~450-485).
  - Parser del texto legal: `../irmi/apps/irmi/web/src/pages/sala/consentimiento.ts` (`seccionesConsentimiento`, `partesTratamiento`).
  - Validación en servidor: `../irmi/apps/irmi/server/src/registro/consentimiento.ts`.
  - Texto legal del IRMI (NO se usa, es de IRMI): `../irmi/docs/contexto/legal/autorizacion-v1.1.md`. Horizontes usa la Política de Estratek.
- URL de la Política de Tratamiento de Datos de Estratek: variable `POLITICA_PRIVACIDAD_URL` del `.env` (si falta, el servidor usa un valor por defecto y lo anota en el log).

## Comandos
| Acción | Comando |
|---|---|
| Instalar | `npm install` |
| Desarrollo (con mocks) | `npm run dev` (o `tools/dev.sh`) → web en http://localhost:5173, API mock en :8787 |
| Desarrollo (API real) | `npm run dev:api` (o `tools/dev.sh --api`) |
| Solo API | `npm run server` (agrega `-- --mocks` o `USE_MOCKS=1` para mocks) |
| Pruebas | `bash tools/test.sh` (typecheck + vitest; 0 = verde). Las pruebas en navegador necesitan Chromium: `npx playwright-core install chromium-headless-shell` (o `PW_EXE`); `HZ_E2E=0` las omite |
| Semilla | `npm run seed` (superadmin desde `.env`, idempotente) · `npm run seed -- --sala "Taller" --mesas 4` crea sala Foodsume e imprime URLs |
| Simulador de carga | `npm run simular` (API en memoria, 40 personas, 4 mesas, 2 rondas; p95 y verificación de puntos) · `-- --url https://... --usuario U --clave C` contra un servidor |
| Build | `npm run build` (genera `dist/web`; el servidor lo sirve con fallback SPA) |
| Producción local | `npm run build && PORT=3000 HOST=0.0.0.0 npm start` |
| Desplegar staging | `tools/deploy.sh staging` (ver `docs/DESPLIEGUE.md`) |
| Desplegar producción | `tools/deploy.sh produccion` (dominio desde `HZ_DOMINIO_PROD`) |

Puertos configurables: `PORT` (API, 8787 en dev), `WEB_PORT` (Vite, 5173), `API_URL` (destino del proxy de Vite).

## Variables de entorno
`PORT`, `HOST`, `USE_MOCKS`, `DB_PATH`, `BASE_URL`, `POLITICA_PRIVACIDAD_URL`, `SUPERADMIN_USUARIO`, `SUPERADMIN_CLAVE`. El servidor carga `.env` si existe.

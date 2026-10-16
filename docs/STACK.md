# Stack (fijado por R0-T1, 16-oct-2026)

- Repo del IRMI (ruta): `C:\Users\ypaol\irmi` (en Git Bash: `../irmi` desde cada worktree). Monorepo pnpm + turbo, `apps/irmi/server` (Fastify 5 + TS + Drizzle + Postgres 17) y `apps/irmi/web` (React 18 + Vite 6 + react-router 7 + Montserrat). Se despliega con `Dockerfile` en Coolify v4 sobre el VPS (servidor cloud) de Hostinger: `develop` → staging, `main` → producción.
- Backend: **Node 24 + Fastify 5 + TypeScript** (ejecutado con `tsx`, sin paso de compilación). Mismo framework que el IRMI.
- Frontend: **React 18 + Vite 6 + react-router-dom 7 + TypeScript**, fuente `@fontsource-variable/montserrat`. Una sola SPA con 3 rutas raíz: `/m/:codigo` (T2), `/tablero/:sala` (T3), `/admin` (T4).
- Base de datos: **SQLite** con el módulo nativo `node:sqlite` (sin compilación nativa, funciona igual en Windows y Linux). Archivo en `DB_PATH` (por defecto `data/horizontes.sqlite`, ignorado por git). En producción vive en un volumen persistente del contenedor. Ver decisión en `docs/DECISIONES.md`.
- Pruebas: **Vitest 3** (servidor y motor en entorno node; pruebas de React con `// @vitest-environment jsdom` y `@testing-library/react`, ya instalados).
- Hosting: servidor cloud de Hostinger con Coolify, igual que el IRMI (Dockerfile, puerto 3000, healthcheck `GET /api/health`). Dominio `horizontes.estratek.com.co`, staging `staging-horizontes.estratek.com.co`. T4 escribe `deploy/` (Dockerfile y guía) tomando como base `../irmi/Dockerfile` y `../irmi/docs/operacion/despliegue-staging.md`.
- Componente de consentimiento del IRMI (ruta):
  - UI: `../irmi/apps/irmi/web/src/pages/sala/SalaParticipante.tsx` (bloque "Autorización de tratamiento de datos", región con scroll + casilla obligatoria, líneas ~450-485).
  - Parser del texto legal: `../irmi/apps/irmi/web/src/pages/sala/consentimiento.ts` (`seccionesConsentimiento`, `partesTratamiento`).
  - Validación en servidor: `../irmi/apps/irmi/server/src/registro/consentimiento.ts`.
  - Texto legal del IRMI (NO se usa, es de IRMI): `../irmi/docs/contexto/legal/autorizacion-v1.1.md`. Horizontes usa la Política de Estratek.
- URL de la Política de Tratamiento de Datos de Estratek: variable `POLITICA_PRIVACIDAD_URL` del `.env` (si falta, el servidor usa un valor por defecto y lo anota en el log).

## Layout real de carpetas por terminal
| Terminal | Rutas |
|---|---|
| T1 Backend | `server/` (Fastify: `app.ts`, `index.ts`, `config.ts`, `http.ts`, `mocks.ts`, luego `db/`, `rutas/`, `dominio/`), `shared/motor/`, `tools/` (salvo scripts de orquestación), `tests/` (salvo pruebas de UI), `web/shared/api/` (cliente del contrato) |
| T2 Participante | `web/participante/` (entrada: `PaginaMesa.tsx`), `web/shared/ui/` (sistema de diseño) |
| T3 Tablero | `web/tablero/` (entrada: `PaginaTablero.tsx`) |
| T4 Admin + Infra | `web/admin/` (entrada: `PaginaAdmin.tsx`), `deploy/`, `QA-tests/` |
| Compartido (T1) | `web/App.tsx`, `web/main.tsx`, `web/index.html`, `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` |

Pruebas de UI: cada terminal pone las suyas junto a su código (`web/<area>/**/*.test.tsx`); Vitest las recoge solas.
Si una terminal necesita una dependencia npm nueva, la anota en su bitácora y en `docs/DECISIONES.md`; T1 la agrega al `package.json` para evitar conflictos (o la terminal la agrega en un commit que solo toque `package.json` + `package-lock.json`).

## Comandos
| Acción | Comando |
|---|---|
| Instalar | `npm install` |
| Desarrollo (con mocks) | `npm run dev` (o `tools/dev.sh`) → web en http://localhost:5173, API mock en :8787 |
| Desarrollo (API real) | `npm run dev:api` (o `tools/dev.sh --api`) |
| Solo API | `npm run server` (agrega `-- --mocks` o `USE_MOCKS=1` para mocks) |
| Pruebas | `tools/test.sh` (typecheck + vitest; 0 = verde) |
| Build | `npm run build` (genera `dist/web`; el servidor lo sirve con fallback SPA) |
| Producción local | `npm run build && PORT=3000 HOST=0.0.0.0 npm start` |
| Desplegar staging | Coolify: rama `main` del repo Horizontes → app staging (T4 documenta en `deploy/`) |
| Desplegar producción | Coolify: misma imagen, dominio `horizontes.estratek.com.co` (T4 documenta en `deploy/`) |

Puertos configurables: `PORT` (API, 8787 en dev), `WEB_PORT` (Vite, 5173), `API_URL` (destino del proxy de Vite). Con 4 terminales en paralelo, usa puertos distintos (ej. T2 `PORT=8802 WEB_PORT=5182`).

## Variables de entorno
`PORT`, `HOST`, `USE_MOCKS`, `DB_PATH`, `BASE_URL`, `POLITICA_PRIVACIDAD_URL`, `SUPERADMIN_USUARIO`, `SUPERADMIN_CLAVE`. El servidor carga `.env` si existe.

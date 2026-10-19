# Horizontes · Herramienta de priorización de portafolio (Estratek)

Lee este archivo completo antes de tocar código. Es la fuente de verdad operativa del proyecto.
Orden de lectura en cada sesión nueva: `CLAUDE.md` → `README.md` → `docs/SPEC.md` → `docs/CONTRATO_API.md` → `docs/MODELO_DATOS.md` → `docs/DECISIONES.md`. Las decisiones del 16-oct que mandan sobre la SPEC están en `docs/ACTA_2026-10-16.md`.

## Qué es
App web para el taller «Portafolio por Horizontes» de Estratek. Los participantes entran desde la landing (`/`) o el QR de su mesa, leen el caso Foodsume en el celular, reciben una hoja según su perfil y califican 2 proyectos vivos (INSUMEX y NUTRIWHAT) en 6 criterios con escala 1-3-5-7-9, en dos rondas: R1 individual y en silencio, R2 con discusión en la mesa. El motor promedia por criterio, calcula eje X, eje Y y su total, y la matriz de burbujas muestra los 2 vivos moviéndose de R1 a R2 sobre 8 proyectos fijos.

## Stack
Detalle, comandos y variables en `docs/STACK.md`.
- Backend: Node 24 + Fastify 5 + TypeScript (con `tsx`) · Base de datos: SQLite (`node:sqlite`, archivo en volumen) · Frontend: React 18 + Vite 6 + react-router 7 + TypeScript, una sola SPA.
- `npm install` · desarrollo con mocks `npm run dev` · API real `npm run dev:api` · pruebas `bash tools/test.sh` · build `npm run build`.
- Tiempo real = polling cada 2,5 s con `version` (ETag / If-None-Match → 304). Sin websockets.
- Despliegue: Docker + Coolify en el VPS de Hostinger (`docs/DESPLIEGUE.md`, `tools/deploy.sh`). Dominios: `horizontes.estratek.com.co` y `staging-horizontes.estratek.com.co`; `horizontes.com.co` pendiente (`HZ_DOMINIO_PROD`).

## Estructura del código
| Carpeta | Contenido |
|---|---|
| `server/` | API Fastify, máquina de estados de la sala, precierre, cierres programados, auth admin (superadmin y admin), migraciones, semilla |
| `shared/motor/` | Motor de cálculo (solo lo usa el servidor) |
| `web/inicio/` | Landing pública (`/`) |
| `web/participante/` | Inscripción, consentimiento, caso, hoja, votación y resultados del celular (`/m/:codigo`) |
| `web/tablero/` | Matriz, R1→R2, tablas y modo proyector (`/tablero/:sala`) |
| `web/admin/` | Panel del facilitador (`/admin`) |
| `web/shared/ui/` | Sistema de diseño (tokens y componentes) |
| `web/shared/api/` | Tipos del contrato de API |
| `tests/` | Pruebas del servidor, golden del motor, e2e del taller |
| `tools/` | Pruebas (`test.sh`), desarrollo (`dev.sh`), despliegue (`deploy.sh`) y simulador de carga |
| `deploy/` | Dockerfile, guía de Coolify y plan B |
| `data/` | Semilla del caso (solo lectura: textos y pesos aprobados por Sebastian) |

## Flujo de trabajo (desde v1.0.0)
1. Rama desde `main` con prefijo: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`. Nunca se trabaja ni se empuja directo a `main`.
2. Commits pequeños en Conventional Commits, en español: `feat(panel): …`, `fix(servidor): …`.
3. Antes de abrir el PR: `bash tools/test.sh` en verde. Toda funcionalidad nueva llega con pruebas; nunca se debilita una prueba para esconder un error real.
4. Pull request a `main`. La CI (`.github/workflows/ci.yml`) debe quedar en verde. Merge commit.
5. Las versiones siguen SemVer, con tag `vX.Y.Z` y entrada en `CHANGELOG.md`.
6. Producción se despliega a mano desde Coolify (Auto Deploy apagado). Staging puede seguir a `main`.
7. Decisiones de producto o de contrato: `docs/DECISIONES.md` (fecha, decisión y por qué; prefijo `CONTRATO:` si cambia la API).

## Reglas
- El contrato de API (`docs/CONTRATO_API.md`) es ley: agrega, no rompas (campos nuevos opcionales).
- Nada de secretos en el repo. No leas `.env`, `.env.*` ni `deploy/.env.deploy`.
- Nada contra producción sin pedido explícito de Paola.
- Producción es Linux: finales de línea LF (`.gitattributes`), nada específico de Windows en el código.
- Dependencias npm nuevas: commit aparte que solo toque `package.json` y `package-lock.json`, anotado en `docs/DECISIONES.md`.
- Detén servidores de desarrollo y procesos en segundo plano al terminar.

## Motor (no se reinterpreta)
- `t2m = alistamiento_tecnico·0,30 + conocimiento_cliente·0,35 + regulacion·0,35`
- `eje_x = t2m·0,6 + capacidades_organizacionales·0,4`
- `eje_y = alineacion_core·0,7 + inversion_requerida·0,3`
- `total = eje_x + eje_y` (fila «Total» de las tablas, acta del 16-oct).
- Entradas = promedio simple por criterio de las respuestas del alcance (mesa o sala) en esa ronda. Los valores no se invierten. Con menos de 3 votos el alcance no muestra resultados (`MINIMO_VOTOS`).
- Pesos y textos viven en `data/seed_foodsume.json`; cada sala guarda su copia en `contenido_sala`. El motor vive solo en el servidor; el frontend nunca recalcula.
- `tests/golden/motor_golden.json` debe pasar al 100 % antes de cualquier merge que toque el motor.

## Skills útiles
- **voz-y-tono-estratek**: todo texto visible al usuario. Regla dura: cero rayas (—) en textos de la app.
- **frontend-design** / **design-taste-frontend**: antes de crear o rediseñar pantallas.
- **xlsx**: solo si hay que releer las plantillas Excel del plan B.

## Identidad visual
- Ley de diseño: `docs/marca/FAMILIA_ESTRATEK.md` (familia Estratek, aprobada por Paola). Detalle de tokens y contrastes en `docs/DISENO.md`; valores en `web/shared/ui/tokens.css` (fuera de ahí no hay colores en duro).
- Paleta exacta de estratek.com.co: carbón `#141414`, hielo `#DCECFF`, azul Estratek `#3487FF` (acción sobre carbón, texto carbón encima) y azul profundo `#1A66D6` (acción sobre claro, texto blanco encima), degradado violeta → azul → verde agua solo en líneas, bordes y progreso. El azul es el único color de acción. Acento de Horizontes: verde agua `#00CDA1` (glifo, línea y gráficos propios; nunca acción ni estado).
- Temas por contexto: **claro** por defecto (celular y panel) y **carbón** con `data-tema="carbon"` en el elemento raíz de la vista (landing y tablero). Mismos tokens `--hz-*`, distinto valor.
- Rondas por tema, siempre con el texto «R1»/«R2»: R1 verde hueco (`#1B7F3A` claro, `#3FB25A` carbón) y R2 rojo sólido (`#C62828` con texto blanco en claro, `#F36363` con texto carbón en carbón).
- Tipografía: Montserrat autoalojada, titulares en 900. Móvil primero (360 px) y proyector (1920 px). Accesible (AA) y con foco visible.

## Datos personales
Nombre y correo con fines informativos del taller, con consentimiento según el país de la sala (Colombia: Ley 1581 de 2012; Perú: Ley 29733; Guatemala: política de Estratek). Textos en `server/dominio/consentimiento.ts` y `docs/CONSENTIMIENTO.md` §5.1 (deben coincidir; una prueba lo verifica). Se guarda versión del aviso, fecha, IP y user agent. La IP y la identidad solo las ve el admin; ningún resultado público muestra respuestas individuales ni nombres.

## Definición de terminado (por pantalla)
Funciona contra la API real · 360 px y 1920 px sin desborde · estados vacíos y de error con texto útil · pruebas en verde · decisiones anotadas.

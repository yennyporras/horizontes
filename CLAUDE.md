# Horizontes · Herramienta de priorización de portafolio (Estratek)

Lee este archivo completo antes de tocar código. Es la fuente de verdad operativa del proyecto.
Orden de lectura obligatorio en cada sesión nueva: `CLAUDE.md` → `docs/SPEC.md` → `docs/CONTRATO_API.md` → `docs/MODELO_DATOS.md` → `docs/DECISIONES.md` → tu prompt en `prompts/`.

## Qué estamos construyendo
App web para el taller "Portafolio por Horizontes" de Estratek. Los participantes leen el caso Foodsume en su celular, reciben una hoja de información según su perfil, y califican 2 proyectos vivos (INSUMEX y NUTRIWHAT) en 6 criterios con escala 1-3-5-7-9. El motor promedia por criterio, calcula eje X y eje Y, y la matriz de burbujas muestra los 2 vivos moviéndose entre la ronda 1 y la ronda 2 sobre 8 proyectos fijos.

Fecha límite: 2 días. Se trabaja en rondas autónomas de ~4 horas con 4 terminales en paralelo.

## Stack
> Fijado por R0-T1 (16-oct). Detalle, comandos y variables en `docs/STACK.md`.

- Repo plantilla: IRMI en `../irmi` (mismo stack, mismo despliegue con Docker + Coolify en el servidor cloud de Hostinger, mismo componente de página de consentimiento; el texto legal es el de Estratek).
- Backend: Node 24 + Fastify 5 + TypeScript (con `tsx`) · Base de datos: SQLite (`node:sqlite`, archivo en volumen) · Frontend: React 18 + Vite 6 + react-router 7 + TypeScript, una sola SPA.
- Instalar `npm install` · desarrollo con mocks `npm run dev` · API real `npm run dev:api` · pruebas `tools/test.sh` · build `npm run build`.
- Tiempo real = polling cada 2,5 s con `version` (ETag / If-None-Match → 304). Sin websockets.
- Dominio: `horizontes.estratek.com.co` (staging: `staging-horizontes.estratek.com.co`).

## Reglas de autonomía (sesiones de 4 horas)
1. No preguntes. Decide con `docs/SPEC.md`. Si algo no está cubierto, toma la opción más simple que respete el contrato y regístrala en `docs/DECISIONES.md` (fecha, terminal, decisión, por qué).
2. Solo escala (escribe en `docs/BLOQUEOS.md` y sigue con otra tarea) si necesitas: credenciales, acceso al repo del IRMI, panel de Hostinger/DNS, o un cambio al contrato de API que rompa a otra terminal.
3. El contrato de API (`docs/CONTRATO_API.md`) es ley. Si necesitas cambiarlo: agrega, no rompas (campos nuevos opcionales). Anótalo en `docs/DECISIONES.md` con prefijo `CONTRATO:`.
4. Commits pequeños y frecuentes en tu rama (`t1-backend`, `t2-participante`, `t3-tablero`, `t4-admin`). Cada uno con pruebas en verde. Al final de la ronda: pruebas en verde y bitácora completa; la integración a `main` es automática.
5. Bitácora `docs/bitacora/R{n}_T{m}.md`: hecho, en curso, pendiente, bloqueos, decisiones, comandos para probar. Al empezar cada ronda lee las bitácoras de la ronda anterior de las 4 terminales y `docs/bitacora/S_R{n-1}.md` en main.
6. Usa subagentes para trabajo paralelizable dentro de tu área (pruebas, revisión, refactor). No abras áreas de otra terminal.

## Entorno
- Máquina de desarrollo: Windows (PowerShell 5.1). Las rondas las orquestan los scripts `tools/*.ps1`. Tus comandos corren en Git Bash: usa sintaxis bash y rutas con `/`. Producción es Linux en Hostinger: finales de línea LF (ver `.gitattributes`), nada específico de Windows en el código.

## Modo autónomo (rondas sin supervisión)
- Cada ronda la ejecuta `tools/ronda.ps1` (o `tools/ronda.sh` en Mac/Linux) en modo headless: te reanuda con "Continúa" hasta la hora límite. Nadie lee tus preguntas.
- Tu bitácora `docs/bitacora/R{n}_T{m}.md` es tu memoria entre reanudaciones: actualízala tras cada entregable. Al cumplir todo, escribe la línea exacta `RONDA COMPLETA`.
- Nunca hagas checkout de `main`. Para traer lo integrado: `git rebase main` (o `git merge main` si hay conflictos). La integración entre ramas la hace `tools/sync.ps1` al final de cada ronda. No modifiques los scripts de orquestación (`tools/ronda.*`, `lanzar.*`, `sync.*`, `preparar.*`, `estado.*`, `parar.*`).
- Detén servidores de desarrollo y procesos en segundo plano antes de terminar cada respuesta (si quedan vivos, la sesión no termina).
- Pruebas: `tools/test.sh` debe existir y salir con 0 en verde; `tools/sync.ps1` lo corre con Git Bash como compuerta.

## Propiedad por terminal (no edites lo que no es tuyo)
| Terminal | Área | Rutas reales (layout fijado en R0, ver docs/STACK.md) |
|---|---|---|
| T1 Backend | Modelo de datos, motor, API, máquina de estados, precierre, cierres programados, auth admin con roles (superadmin y admin), semilla, simulador de carga | `server/`, `shared/motor/`, `tools/`, `tests/`, `web/shared/api/`, archivos raíz (`package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `web/App.tsx`, `web/main.tsx`, `web/index.html`) |
| T2 Participante | Inscripción + consentimiento, lectura del caso y hoja, votación, voto registrado / en vivo. Dueña del sistema de diseño | `web/participante/` (entrada `PaginaMesa.tsx`), `web/shared/ui/` |
| T3 Tablero | Matriz de burbujas, R1→R2, promedios y dispersión por criterio, progreso, alcance mesa/sala, vista proyector | `web/tablero/` (entrada `PaginaTablero.tsx`) |
| T4 Admin + Infra | Panel admin, QR por mesa, config de visibilidad, rondas, cierres programados, export, despliegue, QA plugin | `web/admin/` (entrada `PaginaAdmin.tsx`), `deploy/`, `QA-tests/` |

Compartido de solo lectura para todos: `data/`, `docs/`, `mocks/`, `web/shared/api/` (cliente generado del contrato, dueño T1). Pruebas de UI: junto al código de cada área (`web/<area>/**/*.test.tsx`). Dependencias npm nuevas: commit aparte que solo toque `package.json` y `package-lock.json`, anotado en `docs/DECISIONES.md`.

## Motor (no se reinterpreta)
- `t2m = alistamiento_tecnico·0,30 + conocimiento_cliente·0,35 + regulacion·0,35`
- `eje_x = t2m·0,6 + capacidades_organizacionales·0,4`
- `eje_y = alineacion_core·0,7 + inversion_requerida·0,3`
- Entradas = promedio simple por criterio de las respuestas del alcance (mesa o sala) en esa ronda. Los valores no se invierten.
- Pesos y textos viven en `data/seed_foodsume.json`. El motor vive solo en el servidor; el frontend nunca recalcula.
- `tests/golden/motor_golden.json` debe pasar al 100 % antes de cualquier merge que toque el motor: fijos y caso Nicolai con tolerancia 1e-9; prueba sintética con tolerancia 0,001 (sus esperados vienen redondeados a 3 decimales; ahí `proyecto` viene en mayúsculas: INSUMEX = `insumex`).

## Skills y plugins instalados (úsalos, no los reinventes)
- **voz-y-tono-estratek**: todo texto visible al usuario (botones, pantallas, aviso de privacidad, correos, guía del facilitador). Regla dura: cero rayas (—) en textos de la app.
- **frontend-design**: T2 lo lee antes de crear el sistema de diseño; T3 y T4 antes de su primera pantalla.
- **qa-my-app** (plugin): `/qa-my-app:init` sobre staging (R2-T4), `/qa-my-app:verify` después de cada cambio de pantalla (todas), `/qa-my-app:run-all` en R3, `/qa-my-app:status` al abrir cada ronda.
- **xlsx**: solo si hay que releer las plantillas Excel.

## Identidad visual (punto de partida, T2 la cierra con frontend-design)
- Azul Estratek `#1C4587`, azul medio `#3F7CC8`, cielo de rúbricas `#00A3FF`, fondos de horizontes en azules claros como el deck.
- Tipografía de marca: Montserrat.
- Lo memorable es la matriz y el movimiento R1→R2. Todo lo demás, sobrio. Móvil primero (360 px). Accesible y con foco visible.

## Datos personales (Ley 1581)
Se pide nombre y correo solo para fines informativos (decisión de Paola, 16-oct). Se reutiliza el componente de consentimiento del IRMI con la Política de Tratamiento de Datos Personales de Estratek (enlace en `POLITICA_PRIVACIDAD_URL`). Sin consentimiento aceptado no hay inscripción. Se guarda versión del aviso, fecha, IP y user agent. Ningún resultado muestra respuestas individuales ni nombres.

## Definición de terminado (por pantalla)
Funciona contra la API real · móvil 360 px y proyector 1920 px · estados vacíos y de error con texto útil · `/qa-my-app:verify` en verde · bitácora escrita.

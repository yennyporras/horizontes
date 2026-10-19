# R4 · Contrato fijado antes de empezar (19-oct)

Lo fija la integración para que T1, T2, T3 y T4 trabajen en paralelo sin esperarse. T1 lo implementa en el servidor, en `web/shared/api/contrato.ts` y en los mocks. T2, T3 y T4 lo consumen desde el primer minuto: si T1 aún no lo publicó, usan sus mocks locales con esta misma forma. Todo campo nuevo es **opcional** (regla del contrato). Base: `docs/ACTA_2026-10-16.md`.

## Campos y reglas
| # | Dónde | Cambio |
|---|---|---|
| C1 | `RondaVivo` | `total?: number \| null` = `eje_x + eje_y`, calculado en el servidor. `null` si no hay votos o el alcance está `bajo_minimo`. El frontend nunca lo calcula. |
| C2 | `proyectos_fijos[]` | `total?: number` = `eje_x + eje_y`. |
| C3 | Servidor | `MINIMO_VOTOS = 3` (`Tablero.minimo_votos` ya existe). Texto de las vistas: «Hace falta al menos 3 votos para mostrar esta mesa» (tablero) y «Hace falta al menos 3 votos para mostrar estos resultados» (celular). |
| C4 | `Config` | `pais?: 'CO' \| 'PE' \| 'GT'` (por defecto `CO`) y `zona_horaria?: 'America/Bogota' \| 'America/Lima' \| 'America/Guatemala'` (por defecto según el país). Editables en `PATCH /api/admin/salas/{id}/config`. Viajan dentro de `config` donde ya viaja `Config` (tablero, `SalaResumen`) y se agregan al `Pick` de la vista del participante. |
| C5 | Valores por defecto de una sala **nueva**, duplicada o reiniciada | `alcance_resultados: 'sala'` y `vista_participante: 'en_vivo'` (acta A2: consolidado de toda la sala visible tras votar). Las salas existentes no cambian. Migración aditiva. |
| C6 | `InfoMesa.consentimiento` | `version: 'hz-1.1'`. `texto_autorizacion` según el país de la sala: CO cita la Ley 1581 de 2012; PE cita la Ley 29733; GT cita la Política de Tratamiento de Datos de Estratek. Agrega `pais?` a `InfoMesa.sala`. |
| C7 | Servidor (BD) | IP real (`TRUST_PROXY_HOPS`) en cada inscripción y en cada voto. Columnas nuevas, migración aditiva. Nunca en respuestas públicas ni en logs. |
| C8 | `ParticipanteAdmin` | `ip?: string \| null` y `pais?: string`. Export interno (`inscritos.csv` y `votos.csv`): columnas `ip` y `pais` **al final**. El export de resumen no cambia. |
| C9 | `tools/deploy.sh` | Dominio de producción desde `HZ_DOMINIO_PROD` (por defecto el actual). `BASE_URL` sigue mandando en QR y enlaces. |

## Colores por ronda (tokens de T2 en `web/shared/ui/`)
- `--hz-r1: #1F7A3A` (verde, ronda 1 individual y en silencio).
- `--hz-r2: #C62828` (rojo, ronda 2 con discusión en la mesa).
- Contraste ≥ 4,5:1 sobre blanco. Siempre acompañados del texto «R1»/«R2» y de forma distinta (R1 hueco, R2 sólido).
- T3 y T4 los usan con respaldo: `var(--hz-r1, #1F7A3A)`.
- Los proyectos fijos no usan verde ni rojo.

## Tabla de resultados (tablero, celular y panel)
Filas: los 6 criterios y una fila final **«Total»** (C1), con 2 decimales. **Se quitan** las filas o columnas T2M (Time to Market), Eje X, Eje Y y Votos. La matriz no cambia.

## Proceso
- Cada terminal trabaja en su worktree y su rama. Commits pequeños por ruta, sin push. Bitácora `docs/bitacora/R4_T{n}.md` que termina en `RONDA COMPLETA`.
- **Pruebas:** durante el trabajo, solo las de tu área con `HZ_E2E=0 npx vitest run <tu carpeta>`. Las pruebas en navegador (Chromium) son pesadas y comparten 8 GB de RAM. Córrelas una sola vez al final, tomando el candado `C:/Users/ypaol/hz-pesado.lock` (créalo con `set -o noclobber; echo "T{n} $(date)" > ...`; si existe, espera en pausas de 30 s hasta 10 min; bórralo al terminar aunque falle). `tools/test.sh` completo lo corre la integración.

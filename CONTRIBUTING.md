# Cómo contribuir a Horizontes

Guía de trabajo del equipo de desarrollo. Antes de tocar código, lee en este orden: `README.md` → `docs/SPEC.md` → `docs/CONTRATO_API.md` → `docs/MODELO_DATOS.md` → `docs/DECISIONES.md`. Las decisiones del 16-oct que mandan sobre la SPEC están en `docs/ACTA_2026-10-16.md`.

## Comandos
Detalle del stack, comandos y variables en `docs/STACK.md`.

```bash
npm install
npm run dev          # web con API simulada (mocks)
npm run dev:api      # web + API real con SQLite local
bash tools/test.sh   # typecheck + todas las pruebas
npm run build        # build de producción
```

## Flujo de trabajo
1. Rama desde `main` con prefijo: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`. Nunca se trabaja ni se empuja directo a `main`.
2. Commits pequeños en [Conventional Commits](https://www.conventionalcommits.org/es/), en español: `feat(panel): …`, `fix(servidor): …`.
3. Antes de abrir el pull request: `bash tools/test.sh` en verde. Toda funcionalidad nueva llega con pruebas; nunca se debilita una prueba para esconder un error real.
4. Pull request a `main`. La CI (`.github/workflows/ci.yml`) debe quedar en verde. Se integra con merge commit.
5. Versiones con [SemVer](https://semver.org/lang/es/): tag `vX.Y.Z` y entrada en `CHANGELOG.md`.
6. Producción se despliega a mano desde Coolify (Auto Deploy apagado). Staging puede seguir a `main`.
7. Decisiones de producto o de contrato: `docs/DECISIONES.md` (fecha, área, decisión y por qué; prefijo `CONTRATO:` si cambia la API).

## Reglas
- El contrato de API (`docs/CONTRATO_API.md`) es ley: se agrega, no se rompe. Todo campo nuevo es opcional.
- Nada de secretos en el repo. Los valores reales viven en Coolify y en archivos `.env` locales que no se suben.
- Nada contra producción sin pedido explícito de la responsable del proyecto (Paola).
- Producción es Linux: finales de línea LF (`.gitattributes`) y nada específico de Windows en el código.
- Dependencias npm nuevas: commit aparte que solo toque `package.json` y `package-lock.json`, anotado en `docs/DECISIONES.md`.
- `data/` es de solo lectura: textos y pesos aprobados por Sebastian.
- Al terminar, detén los servidores de desarrollo y los procesos en segundo plano.

## Motor de cálculo
No se reinterpreta.
- `t2m = alistamiento_tecnico·0,30 + conocimiento_cliente·0,35 + regulacion·0,35`
- `eje_x = t2m·0,6 + capacidades_organizacionales·0,4`
- `eje_y = alineacion_core·0,7 + inversion_requerida·0,3`
- `total = eje_x + eje_y` (acta del 16-oct; desde el 19-oct la API lo entrega pero las vistas no lo muestran).
- Entradas = promedio simple por criterio de las respuestas del alcance (mesa o sala) en esa ronda. Los valores no se invierten. Con menos de 3 votos el alcance no muestra resultados (`MINIMO_VOTOS`).
- Pesos y textos viven en `data/seed_foodsume.json`; cada sala guarda su copia en `contenido_sala`. El motor vive solo en el servidor (`shared/motor/`); el frontend nunca recalcula.
- `tests/golden/motor_golden.json` debe pasar al 100 % antes de cualquier merge que toque el motor.

## Textos
- Todo texto visible sigue la guía de voz y tono de Estratek: tuteo y cero rayas (—) en los textos de la app. Una prueba lo verifica.

## Identidad visual
- Línea gráfica de la familia Estratek: `docs/marca/FAMILIA_ESTRATEK.md` y tokens en `web/shared/ui/tokens.css`. Sistema de diseño en `docs/DISENO.md`.
- Ronda 1 verde `--hz-r1` (forma hueca) y ronda 2 roja `--hz-r2` (forma sólida), siempre con el texto «R1»/«R2».
- Tipografía Montserrat. Móvil primero (360 px) y proyector (1920 px). Accesible (AA) y con foco visible.

## Datos personales
Nombre y correo con fines informativos del taller, con consentimiento según el país de la sala (Colombia: Ley 1581 de 2012; Perú: Ley 29733; Guatemala: política de Estratek). Textos en `server/dominio/consentimiento.ts` y `docs/CONSENTIMIENTO.md` §5.1 (deben coincidir; una prueba lo verifica). Se guarda versión del aviso, fecha, IP y user agent. La IP y la identidad solo las ve el admin; ningún resultado público muestra respuestas individuales ni nombres.

## Definición de terminado (por pantalla)
Funciona contra la API real · 360 px y 1920 px sin desborde · estados vacíos y de error con texto útil · pruebas en verde · decisiones anotadas.

# R0 · T1 Backend · ~1 h · rama `t1-backend` · CAMINO CRÍTICO

Eres T1. Las otras 3 terminales esperan tu esqueleto: prioridad absoluta a los pasos 1-3 (meta: 30 min).

1. Lee `CLAUDE.md` y los docs en el orden indicado. Inspecciona el repo del IRMI (ruta o URL en `docs/STACK.md`; si no está, búscala en `../irmi` o pídela en `docs/BLOQUEOS.md` y usa el fallback del CLAUDE.md).
2. Escribe `docs/STACK.md`: framework backend y frontend, BD, cómo corre en el servidor cloud de Hostinger, comandos (instalar, dev, test, build, deploy), ruta de la página de consentimiento del IRMI y layout real de carpetas. Actualiza la tabla de propiedad del `CLAUDE.md` con las rutas reales y la sección Stack.
3. Crea el esqueleto del repo con ese stack: servidor que arranca, frontend con rutas vacías `/m/:codigo`, `/tablero/:sala`, `/admin`, carpetas por terminal, runner de pruebas funcionando. **Un servidor de mocks** que sirve `mocks/*.json` en las rutas del contrato (flag `USE_MOCKS=1`). Crea `tools/test.sh` (corre todas las pruebas; código de salida 0 = verde) y `tools/dev.sh`. Commit con el mensaje exacto `[T1] ESQUELETO LISTO` y publícalo en main con `git fetch . t1-backend:main` (avance rápido; es la única publicación directa de la ronda). Anota los comandos en tu bitácora.
4. Implementa `shared/motor/` como módulo puro: `promediar(votos)`, `calcular(inputs, pesos) → {t2m, eje_x, eje_y}`, `distribucion(votos)`. Pesos desde `data/seed_foodsume.json`. Pruebas con `tests/golden/motor_golden.json` al 100 %.
5. Genera el cliente del contrato en `web/shared/api/` (tipos + funciones fetch con soporte `If-None-Match`/304).

Aceptación: otro desarrollador clona `main`, corre 2 comandos y ve las 3 rutas vacías y los mocks respondiendo; golden en verde.

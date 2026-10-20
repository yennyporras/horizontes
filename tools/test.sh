#!/usr/bin/env bash
# Corre todas las pruebas (typecheck y vitest). Código de salida 0 = verde. Lo usa la CI.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install --no-audit --no-fund
echo "== typecheck"
npx tsc --noEmit
# Primero todo menos las pruebas en navegador real (en paralelo). Después las de navegador, una a la vez: cada una
# levanta su servidor, un build y Chromium, y juntas se roban la CPU y la memoria en máquinas chicas (la CI o un
# portátil cargado) hasta congelar la página (docs/DECISIONES.md, 20-oct).
echo "== vitest"
npx vitest run --exclude '**/e2e/**'
echo "== vitest en navegador (una a la vez)"
npx vitest run --no-file-parallelism web/participante/e2e web/tablero/e2e

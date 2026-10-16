#!/usr/bin/env bash
# Corre todas las pruebas. Código de salida 0 = verde. Lo usa tools/sync.ps1 como compuerta.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install --no-audit --no-fund
echo "== typecheck"
npx tsc --noEmit
echo "== vitest"
npx vitest run

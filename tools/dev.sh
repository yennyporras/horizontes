#!/usr/bin/env bash
# Desarrollo local. Uso:
#   tools/dev.sh          -> API con mocks (USE_MOCKS=1) + Vite en http://localhost:5173
#   tools/dev.sh --api    -> API real + Vite
# Puertos: PORT (API, 8787) y WEB_PORT (Vite, 5173).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm install --no-audit --no-fund
if [ "${1:-}" = "--api" ]; then exec npm run dev:api; else exec npm run dev; fi

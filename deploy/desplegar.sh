#!/usr/bin/env bash
# Compatibilidad: el pipeline vive en tools/deploy.sh (verificar | local | staging | produccion | revisar).
exec "$(dirname "$0")/../tools/deploy.sh" "$@"

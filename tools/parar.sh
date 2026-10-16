#!/usr/bin/env bash
# Parada controlada de todas las terminales: cada una cierra su sesión, hace commit de seguridad y termina.
COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
touch "$COMMON/STOP_HZ"
echo "STOP activado. Las terminales se detienen en menos de 1 minuto y dejan commit de seguridad."
echo "Para volver a lanzar, tools/lanzar.sh borra el STOP automáticamente."

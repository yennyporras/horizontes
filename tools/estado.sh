#!/usr/bin/env bash
# Tablero de control sin interrumpir a nadie. Uso: tools/estado.sh R1
R="${1:?Indica la ronda, ej. R1}"
ROOT="$(git rev-parse --show-toplevel)"; PADRE="$(dirname "$ROOT")"
COMMON="$(cd "$(git -C "$ROOT" rev-parse --git-common-dir)" && pwd)"
for n in 1 2 3 4; do
  d="$PADRE/hz-t$n"; [ -d "$d" ] || continue
  bit="$d/docs/bitacora/${R}_T$n.md"
  est="en curso"; [ -f "$COMMON/hz_${R}_T$n.done" ] && est="terminada"
  grep -q "RONDA COMPLETA" "$bit" 2>/dev/null && est="$est · COMPLETA"
  echo "== T$n ($est)"
  echo "   último commit: $(git -C "$d" log -1 --format='%cr · %s' 2>/dev/null)"
  echo "   último log:    $(tail -1 "$d/logs/${R}_T$n.log" 2>/dev/null | cut -c1-160)"
done
[ -f "$COMMON/STOP_HZ" ] && echo "!! STOP activo"
for f in "$ROOT"/docs/BLOQUEOS.md "$PADRE"/hz-t*/docs/BLOQUEOS.md; do
  [ -f "$f" ] && grep -E '^- 20' "$f" | tail -3 | sed "s|^|   bloqueo ($(basename "$(dirname "$(dirname "$f")")")): |"
done

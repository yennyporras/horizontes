#!/usr/bin/env bash
# Lanza las 4 terminales autónomas en tmux y, al terminar todas, integra en main (tools/sync.sh).
# Uso: tools/lanzar.sh R0,R1   |   tools/lanzar.sh R2   |   tools/lanzar.sh R3   |   tools/lanzar.sh R4
# Las rondas separadas por coma se encadenan en cada terminal (R0 dura ~1 h, las demás ~4 h).
set -euo pipefail
RONDAS="${1:?Indica rondas, ej. R0,R1}"
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
PADRE="$(dirname "$ROOT")"
SES="hz-${RONDAS//,/-}"
rm -f "$COMMON/STOP_HZ"

tmux has-session -t "$SES" 2>/dev/null && { echo "Ya existe la sesión tmux $SES (tmux attach -t $SES)"; exit 1; }
tmux new-session -d -s "$SES" -n terminales -x 240 -y 60

for n in 1 2 3 4; do
  d="$PADRE/hz-t$n"; cmd=""
  IFS=',' read -ra LISTA <<<"$RONDAS"
  for r in "${LISTA[@]}"; do cmd+="git -C '$d' rebase main >/dev/null 2>&1 || git -C '$d' rebase --abort; bash '$d/tools/ronda.sh' T$n $r; "; done
  [ "$n" -gt 1 ] && tmux split-window -t "$SES:terminales" -c "$d"
  tmux send-keys -t "$SES:terminales.$((n-1))" "cd '$d' && $cmd echo 'T$n terminó $RONDAS'" C-m
  tmux select-layout -t "$SES:terminales" tiled >/dev/null
done

# Ventana de integración: espera a las 4 terminales de la última ronda y corre sync
ULT="${RONDAS##*,}"
tmux new-window -t "$SES" -n integracion -c "$ROOT"
tmux send-keys -t "$SES:integracion" "while [ \$(ls '$COMMON'/hz_${ULT}_T*.done 2>/dev/null | wc -l) -lt 4 ]; do [ -f '$COMMON/STOP_HZ' ] && break; sleep 60; done; bash '$ROOT/tools/sync.sh' $ULT" C-m

echo "Rondas $RONDAS lanzadas en tmux, sesión $SES."
echo "Ver en vivo:  tmux attach -t $SES     (salir sin detener: Ctrl+b y luego d)"
echo "Estado:       bash tools/estado.sh $ULT"
echo "Parar todo:   bash tools/parar.sh"

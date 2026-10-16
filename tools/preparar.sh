#!/usr/bin/env bash
# Preparación única (5 min). Ejecutar en la carpeta principal del repo, con el kit ya commiteado en main.
# Crea los 4 worktrees, enlaza el .env, libera main y prueba Claude Code en modo headless.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
PADRE="$(dirname "$ROOT")"

for c in git claude jq tmux; do command -v "$c" >/dev/null || { echo "Falta '$c'. Instálalo y vuelve a correr."; exit 1; }; done
[ -f .env ] || { echo "Falta .env en $ROOT (ver README_ARRANQUE.md)"; exit 1; }
git show-ref -q refs/heads/main || { echo "No existe la rama main. Haz el commit inicial en main."; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "Hay cambios sin commit en main. Haz commit primero."; exit 1; }

i=0
for b in t1-backend t2-participante t3-tablero t4-admin; do
  i=$((i+1)); d="$PADRE/hz-t$i"
  if [ ! -d "$d" ]; then git worktree add "$d" -b "$b" main; fi
  ln -sf "$ROOT/.env" "$d/.env"
  echo "Terminal T$i lista en $d (rama $b)"
done

# main queda libre para que T1 publique el esqueleto y para tools/sync.sh
git switch --detach -q
echo "main liberada (la carpeta principal queda en HEAD separado: es normal)"

# Prueba del modo de permisos más autónomo disponible
probar() { claude -p "Responde solo: OK" "$@" --output-format json --max-turns 1 2>/dev/null | jq -e '.result' >/dev/null; }
if probar --permission-mode auto --permission-prompts none; then MODO=auto
elif probar --permission-mode acceptEdits; then MODO=acceptEdits
else echo "Claude Code no respondió en modo headless. Revisa 'claude' (sesión iniciada con la cuenta del equipo)."; exit 1; fi
echo "$MODO" >"$COMMON/hz_modo"
echo "Modo de permisos para las rondas: $MODO"
[ -d "$PADRE/irmi" ] && echo "Repo IRMI encontrado en $PADRE/irmi" || echo "AVISO: no encuentro $PADRE/irmi. Clónalo ahí o deja la ruta en docs/STACK.md"
echo "Listo. Siguiente paso: tools/lanzar.sh R0,R1"

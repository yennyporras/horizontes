#!/usr/bin/env bash
# Integra las 4 ramas en main en el orden T1 → T3 → T2 → T4, resuelve conflictos con Claude si hace falta,
# corre las pruebas y deja docs/bitacora/S_<ronda>.md. Uso: tools/sync.sh R1
set -uo pipefail
R="${1:-manual}"
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
MODO="$(cat "$COMMON/hz_modo" 2>/dev/null || echo acceptEdits)"
[ "$MODO" = auto ] && PERM=(--permission-mode auto --permission-prompts none) || PERM=(--permission-mode acceptEdits)
REP="docs/bitacora/S_${R}.md"
git switch -q main || { echo "No pude cambiar a main (¿algún worktree la tiene?)"; exit 1; }
mkdir -p docs/bitacora logs
{ echo "# Integración tras $R · $(date '+%Y-%m-%d %H:%M')"; echo; } >"$REP.tmp"

for b in t1-backend t3-tablero t2-participante t4-admin; do
  if git merge --no-ff --no-edit "$b" >/dev/null 2>&1; then
    echo "- $b: integrada" >>"$REP.tmp"
  else
    echo "Conflicto con $b: lo resuelve Claude"
    claude -p "Estás en la rama main con un merge en curso de '$b' que tiene conflictos. Resuélvelos conservando el trabajo de ambas partes y respetando la propiedad de carpetas del CLAUDE.md (en archivos de una terminal, gana la versión de su dueña). No cambies lógica fuera de los conflictos. Corre las pruebas (comando en docs/STACK.md o tools/test.sh). Luego 'git add' y 'git commit --no-edit'. No hagas push." \
      "${PERM[@]}" --output-format json --max-turns 80 >"logs/.sync_$b.json" 2>&1
    if git diff --name-only --diff-filter=U | grep -q .; then
      git merge --abort; echo "- $b: NO integrada (conflictos sin resolver; queda para la siguiente ronda)" >>"$REP.tmp"
    else
      echo "- $b: integrada con conflictos resueltos por Claude" >>"$REP.tmp"
    fi
  fi
done

if [ -f tools/test.sh ]; then
  if bash tools/test.sh >"logs/.sync_test_$R.log" 2>&1; then echo "- Pruebas: verde" >>"$REP.tmp"
  else echo "- Pruebas: EN ROJO (ver logs/.sync_test_$R.log). Primera tarea de T1 en la siguiente ronda." >>"$REP.tmp"; fi
else
  echo "- Pruebas: tools/test.sh aún no existe" >>"$REP.tmp"
fi
mv "$REP.tmp" "$REP"; git add "$REP"; git commit -qm "[sync] integración tras $R" || true
git remote | grep -q . && git push -q origin main 2>/dev/null && echo "- main publicada en origin" >>"$REP"
git switch --detach -q
cat "$REP"

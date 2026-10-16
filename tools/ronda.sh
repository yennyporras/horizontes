#!/usr/bin/env bash
# Ronda autónoma de una terminal. Uso:  tools/ronda.sh <T1|T2|T3|T4> <R0|R1|R2|R3|R4> [minutos]
# Corre Claude Code en modo headless, lo reanuda hasta que la ronda termina o se acaba el tiempo,
# y siempre deja commit + bitácora. Parada de emergencia de TODAS las terminales: tools/parar.sh
set -uo pipefail

T="${1:?Falta terminal: T1|T2|T3|T4}"; R="${2:?Falta ronda: R0..R4}"
case "$R" in R0) MIN="${3:-60}" ;; *) MIN="${3:-240}" ;; esac

ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$ROOT"
COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
PROMPT="$(ls prompts/${R}_${T}_*.md 2>/dev/null | head -1)"
[ -n "$PROMPT" ] || { echo "No existe prompts/${R}_${T}_*.md"; exit 1; }
command -v claude >/dev/null || { echo "Falta el CLI claude"; exit 1; }
command -v jq >/dev/null || { echo "Falta jq (brew install jq / apt install jq)"; exit 1; }

mkdir -p logs docs/bitacora
BIT="docs/bitacora/${R}_${T}.md"
LOG="logs/${R}_${T}.log"
SIDF="logs/${R}_${T}.session"
OUT="logs/.ultimo_${R}_${T}.json"
DONE="$COMMON/hz_${R}_${T}.done"
rm -f "$DONE"

INICIO=$(date +%s); FIN=$((INICIO + MIN * 60))
MAX_TURNS="${HZ_MAX_TURNS:-200}"
MODO="${HZ_MODO:-$(cat "$COMMON/hz_modo" 2>/dev/null || echo auto)}"   # auto | acceptEdits | bypass (lo fija tools/preparar.sh)
case "$MODO" in
  bypass) PERM=(--dangerously-skip-permissions) ;;
  acceptEdits) PERM=(--permission-mode acceptEdits) ;;
  *) PERM=(--permission-mode auto --permission-prompts none) ;;
esac

hora() { date -d "@$1" +%H:%M 2>/dev/null || date -r "$1" +%H:%M; }
log() { echo "[$(date +%H:%M:%S)] [$T $R] $*" | tee -a "$LOG"; }
completa() { [ -f "$BIT" ] && grep -q "RONDA COMPLETA" "$BIT"; }
parar() { [ -f "$COMMON/STOP_HZ" ]; }
quedan() { echo $(( (FIN - $(date +%s)) / 60 )); }

# 1) Sincronizar con main antes de empezar
NOTA=""
if git show-ref -q refs/heads/main; then
  if ! git rebase main >>"$LOG" 2>&1; then
    git rebase --abort >>"$LOG" 2>&1
    NOTA="IMPORTANTE: el rebase automático sobre main falló. Tu primera tarea es 'git merge main' y resolver los conflictos respetando la propiedad de carpetas del CLAUDE.md."
  fi
fi

REGLAS="Reglas de esta ronda autónoma (nadie va a responder preguntas):
- Hora límite: $(hora "$FIN") (hora local). Trabaja por entregables completos y en orden.
- Tu bitácora $BIT es tu memoria: actualízala después de CADA entregable (hecho, en curso, siguiente, decisiones). Si la sesión se reinicia, de ahí continúas.
- Commit después de cada entregable con mensaje '[$T] ...'. Nunca hagas checkout de main ni push forzado.
- Antes de terminar cada respuesta, detén cualquier servidor de desarrollo o proceso en segundo plano que hayas iniciado.
- No hagas preguntas. Decide con docs/SPEC.md y registra en docs/DECISIONES.md. Bloqueos reales → docs/BLOQUEOS.md y sigue con otra tarea.
- Cuando completes TODOS los entregables y criterios de aceptación de tu prompt, escribe al final de la bitácora la línea exacta: RONDA COMPLETA"

correr() {   # $1 = prompt
  local args=(-p "$1" "${PERM[@]}" --output-format json --max-turns "$MAX_TURNS")
  [ -s "$SIDF" ] && args+=(--resume "$(cat "$SIDF")")
  claude "${args[@]}" >"$OUT" 2>>"$LOG" &
  local pid=$! rc
  while kill -0 "$pid" 2>/dev/null; do
    sleep 20
    if parar || [ "$(date +%s)" -gt $((FIN + 900)) ]; then
      log "Corte: STOP o tiempo excedido; cerrando la sesión"
      kill -INT "$pid" 2>/dev/null; sleep 15; kill -TERM "$pid" 2>/dev/null
    fi
  done
  wait "$pid"; rc=$?
  local sid; sid="$(jq -r '.session_id // empty' "$OUT" 2>/dev/null)"
  if [ -n "$sid" ]; then echo "$sid" >"$SIDF"; else rm -f "$SIDF"; fi
  jq -r '"  resultado: " + ((.result // "sin resultado") | tostring | .[0:400] | gsub("\n";" ")) + "  | turnos: " + ((.num_turns // 0)|tostring)' "$OUT" >>"$LOG" 2>/dev/null
  return $rc
}

log "Inicio ronda $R ($PROMPT). Fin previsto $(hora "$FIN"). Modo de permisos: $MODO"
correr "Eres $T en la ronda $R del proyecto Horizontes. Lee CLAUDE.md y los documentos en el orden que indica, luego lee y ejecuta $PROMPT de principio a fin en modo autónomo. $NOTA

$REGLAS" || true

ERR=0
while ! completa && ! parar; do
  Q=$(quedan)
  [ "$Q" -le 0 ] && break
  if [ "$Q" -le 25 ]; then
    log "Quedan $Q min: cierre de ronda"
    correr "Quedan $Q minutos de la ronda $R. CIERRA YA: termina o revierte lo que esté a medias, deja las pruebas en verde, commit, actualiza $BIT con hecho / pendiente / riesgos / cómo probar, y escribe la línea RONDA COMPLETA aunque queden pendientes (quedan listados para la siguiente ronda).

$REGLAS" || true
    break
  fi
  if correr "Continúa como $T en la ronda $R. Son las $(date +%H:%M) y quedan $Q minutos. Relee $BIT y 'git log --oneline -15' para ubicarte y sigue con el siguiente entregable pendiente de $PROMPT. Si ya cumpliste todo, verifica los criterios de aceptación uno por uno y escribe RONDA COMPLETA; si sobra tiempo después de eso, toma tareas de docs/BACKLOG_EXTRA.md de tu área.

$REGLAS"; then
    ERR=0
  else
    ERR=$((ERR + 1)); ESPERA=$(( ERR < 4 ? 120 : 600 ))
    log "La llamada falló (intento $ERR). Posible límite de uso o red. Reintento en $((ESPERA / 60)) min"
    sleep "$ESPERA"
  fi
done

# 2) Red de seguridad: nada se pierde
if [ -n "$(git status --porcelain)" ]; then
  git add -A && git commit -qm "[$T] cierre automático de $R (cambios sin commit al terminar)" && log "Commit de seguridad hecho"
fi
completa && log "RONDA COMPLETA" || log "Ronda terminada por tiempo o STOP sin marca de completa (ver $BIT)"
date +%s >"$DONE"

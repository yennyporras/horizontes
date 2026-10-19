#!/usr/bin/env bash
# Despliegue de Horizontes en Coolify (VPS de Hostinger). Idempotente: se puede correr las veces que haga falta.
# Guía: docs/DESPLIEGUE.md y deploy/README.md.
#
#   tools/deploy.sh verificar     build de la imagen + arranque local + /api/health y /admin (no publica nada)
#   tools/deploy.sh local         imagen en http://localhost:3999 con volumen propio (ensayo tipo staging; parar: tools/deploy.sh parar-local)
#   tools/deploy.sh staging       pruebas + push de main + dominio y variables en Coolify + deploy + HTTPS y salud
#   tools/deploy.sh produccion    igual, solo si staging está sano (Auto Deploy apagado en prod)
#   tools/deploy.sh revisar <staging|produccion>   solo comprueba DNS, HTTPS, /api/health y /admin
#   tools/deploy.sh diagnostico [staging|produccion]  lista qué falta para desplegar (no cambia nada). Empieza por aquí.
#
# Credenciales en deploy/.env.deploy (ignorado por git; plantilla en deploy/env.deploy.ejemplo) o en el entorno:
#   COOLIFY_URL, COOLIFY_TOKEN, COOLIFY_APP_STAGING, COOLIFY_APP_PROD
#   SUPERADMIN_CLAVE_STAGING, SUPERADMIN_CLAVE_PROD   (opcionales: si faltan, no se tocan en Coolify)
# Opciones: SIN_PRUEBAS=1 salta tools/test.sh · SIN_PUSH=1 no empuja main · RAMA=main rama que construye Coolify · FORZAR=1 produccion sin igualar staging.
#   HZ_DOMINIO_PROD=horizontes.com.co cambia el dominio de producción (por defecto horizontes.estratek.com.co).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f deploy/.env.deploy ] && set -a && . deploy/.env.deploy && set +a

IMAGEN="horizontes:local"
RAMA="${RAMA:-main}"
PUERTO_LOCAL="${PUERTO_LOCAL:-3999}"
CONTENEDOR_LOCAL="horizontes-local"
# Dominio de producción (acta A10: horizontes.com.co cuando tenga DNS). BASE_URL en Coolify sale de aquí.
DOMINIO_PROD="${HZ_DOMINIO_PROD:-horizontes.estratek.com.co}"

info() { printf '== %s\n' "$*"; }
falla() { printf '!! %s\n' "$1" >&2; exit "${2:-1}"; }
falta() { falla "Falta $1. Ver deploy/README.md (Credenciales) y docs/BLOQUEOS.md." 2; }

dominio_de() { case "$1" in staging) echo staging-horizontes.estratek.com.co ;; produccion) echo "$DOMINIO_PROD" ;; *) falla "Ambiente desconocido: $1" ;; esac; }
uuid_de() { case "$1" in staging) echo "${COOLIFY_APP_STAGING:-}" ;; produccion) echo "${COOLIFY_APP_PROD:-}" ;; esac; }
clave_de() { case "$1" in staging) echo "${SUPERADMIN_CLAVE_STAGING:-}" ;; produccion) echo "${SUPERADMIN_CLAVE_PROD:-}" ;; esac; }

esperar_salud() {
  local url="$1" intentos="${2:-40}"
  info "esperando $url/api/health"
  for _ in $(seq 1 "$intentos"); do
    if curl -fsS --max-time 10 "$url/api/health" >/dev/null 2>&1; then
      curl -fsS "$url/api/health"; echo
      return 0
    fi
    sleep 5
  done
  return 1
}

# --- Imagen local ---------------------------------------------------------------------
construir() {
  command -v docker >/dev/null || falla "Necesitas Docker para construir la imagen." 2
  info "build de la imagen ($IMAGEN)"
  docker build -f deploy/Dockerfile --build-arg SOURCE_COMMIT="$(git rev-parse --short HEAD)" -t "$IMAGEN" .
}

verificar() {
  construir
  local nombre="horizontes-verificar-$$" puerto="${PUERTO_VERIFICAR:-3998}"
  docker run -d --rm --name "$nombre" -p "$puerto:3000" \
    -e BASE_URL="http://localhost:$puerto" -e SUPERADMIN_USUARIO=verificar -e SUPERADMIN_CLAVE=verificar-local-123 \
    "$IMAGEN" >/dev/null
  trap 'docker stop "$nombre" >/dev/null 2>&1 || true' EXIT
  esperar_salud "http://localhost:$puerto" 24 || falla "La imagen no respondió /api/health."
  comprobar_spa "http://localhost:$puerto"
  info "OK: la imagen arranca, responde y sirve la SPA"
}

comprobar_spa() {
  local url="$1" ruta codigo
  for ruta in /admin /admin/salas /m/PRUEBA /tablero/x; do
    codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url$ruta")
    [ "$codigo" = "200" ] || falla "$url$ruta respondió $codigo (se esperaba 200 con la SPA)"
  done
  info "la SPA responde en /admin, /m y /tablero"
}

# Ensayo tipo staging en esta máquina: mismo contenedor, volumen propio, superadmin local.
local_arriba() {
  construir
  docker rm -f "$CONTENEDOR_LOCAL" >/dev/null 2>&1 || true
  docker volume create horizontes-datos-local >/dev/null
  docker run -d --name "$CONTENEDOR_LOCAL" -p "$PUERTO_LOCAL:3000" -v horizontes-datos-local:/data \
    -e APP_ENV=local -e BASE_URL="http://localhost:$PUERTO_LOCAL" \
    -e SUPERADMIN_USUARIO="${SUPERADMIN_USUARIO:-paola}" -e SUPERADMIN_CLAVE="${SUPERADMIN_CLAVE_LOCAL:-ensayo-local-123}" \
    -e POLITICA_PRIVACIDAD_URL="https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/" \
    "$IMAGEN" >/dev/null
  esperar_salud "http://localhost:$PUERTO_LOCAL" 24 || falla "El contenedor local no respondió."
  comprobar_spa "http://localhost:$PUERTO_LOCAL"
  info "arriba en http://localhost:$PUERTO_LOCAL/admin (usuario ${SUPERADMIN_USUARIO:-paola}). Parar: tools/deploy.sh parar-local"
}

# --- Coolify ---------------------------------------------------------------------------
coolify() {
  local metodo="$1" ruta="$2" cuerpo="${3:-}"
  local args=(-fsS --max-time 30 -X "$metodo" -H "Authorization: Bearer $COOLIFY_TOKEN" -H 'Accept: application/json')
  [ -n "$cuerpo" ] && args+=(-H 'Content-Type: application/json' --data "$cuerpo")
  curl "${args[@]}" "${COOLIFY_URL%/}/api/v1$ruta"
}

json_escapar() { node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$1"; }

# Variables del servidor (el ".env" de la app en Coolify). Se reescriben con los mismos valores en cada corrida.
variables() {
  local amb="$1" dominio app_env clave
  dominio=$(dominio_de "$amb")
  app_env=$([ "$amb" = produccion ] && echo production || echo staging)
  clave=$(clave_de "$amb")
  local pares=(
    "APP_ENV=$app_env"
    "NODE_ENV=production"
    "PORT=3000"
    "HOST=0.0.0.0"
    "TZ=America/Bogota"
    "DB_PATH=/data/horizontes.sqlite"
    "BASE_URL=https://$dominio"
    "SUPERADMIN_USUARIO=${SUPERADMIN_USUARIO:-paola}"
    "POLITICA_PRIVACIDAD_URL=https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/"
  )
  [ -n "$clave" ] && pares+=("SUPERADMIN_CLAVE=$clave")
  local datos="" p
  for p in "${pares[@]}"; do
    datos+="${datos:+,}{\"key\":$(json_escapar "${p%%=*}"),\"value\":$(json_escapar "${p#*=}"),\"is_preview\":false,\"is_literal\":true}"
  done
  printf '{"data":[%s]}' "$datos"
}

configurar_coolify() {
  local amb="$1" uuid dominio
  uuid=$(uuid_de "$amb")
  dominio=$(dominio_de "$amb")
  info "app $uuid: dominio https://$dominio (Coolify pide el certificado Let's Encrypt)"
  coolify PATCH "/applications/$uuid" "{\"domains\":\"https://$dominio\",\"ports_exposes\":\"3000\",\"health_check_enabled\":true,\"health_check_path\":\"/api/health\",\"health_check_port\":\"3000\"}" >/dev/null
  info "variables de entorno del servidor ($amb)"
  coolify PATCH "/applications/$uuid/envs/bulk" "$(variables "$amb")" >/dev/null
  [ -n "$(clave_de "$amb")" ] || info "SUPERADMIN_CLAVE no viene en deploy/.env.deploy: se deja la que ya tenga Coolify."
}

revisar() {
  local amb="$1" dominio url
  dominio=$(dominio_de "$amb")
  url="https://$dominio"
  info "DNS de $dominio"
  node -e "require('node:dns').promises.lookup(process.argv[1]).then(r=>console.log('   '+r.address)).catch(()=>{console.error('   no resuelve todavía');process.exit(1)})" "$dominio" \
    || falla "El DNS de $dominio no resuelve. Crea el registro A en Hostinger (docs/DESPLIEGUE.md §2.2)."
  esperar_salud "$url" "${INTENTOS_SALUD:-60}" || falla "$url no respondió con HTTPS válido. Revisa Logs en Coolify."
  comprobar_spa "$url"
  local http
  http=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 "http://$dominio/api/health" || true)
  info "http:// responde '$http' (se espera redirección a https)"
  info "OK: $url arriba con certificado válido"
}

# Credenciales y app antes de correr pruebas o empujar: si algo falta, se sabe en segundos.
requisitos() {
  local amb="$1" uuid
  [ -n "${COOLIFY_URL:-}" ] || falta COOLIFY_URL
  [ -n "${COOLIFY_TOKEN:-}" ] || falta COOLIFY_TOKEN
  uuid=$(uuid_de "$amb")
  [ -n "$uuid" ] || falta "el UUID de la app de $amb (COOLIFY_APP_STAGING o COOLIFY_APP_PROD)"
  coolify GET "/applications/$uuid" >/dev/null || falla "Coolify no reconoce la app $uuid o el token no tiene permiso."
  # Sin SUPERADMIN_CLAVE el servidor arranca sin nadie que pueda entrar al panel: se exige en el primer deploy.
  if [ -z "$(clave_de "$amb")" ] && ! coolify GET "/applications/$uuid/envs" 2>/dev/null | grep -q '"key":"SUPERADMIN_CLAVE"'; then
    falta "SUPERADMIN_CLAVE_$([ "$amb" = produccion ] && echo PROD || echo STAGING) en deploy/.env.deploy (primer deploy: Coolify aún no la tiene)"
  fi
}

desplegar() {
  local amb="$1"
  requisitos "$amb"
  configurar_coolify "$amb"
  info "pidiendo deploy a Coolify"
  coolify GET "/deploy?uuid=$uuid&force=false"; echo
  sleep 20
  revisar "$amb"
}

# Lista de chequeo sin efectos: qué está listo y qué falta para desplegar el ambiente.
diagnostico() {
  local amb="${1:-staging}" ok=0 uuid dominio
  dominio=$(dominio_de "$amb"); uuid=$(uuid_de "$amb")
  si() { printf '  [ok]    %s
' "$1"; }
  no() { printf '  [falta] %s
' "$1"; ok=1; }
  info "diagnóstico de $amb ($dominio)"
  command -v docker >/dev/null && si "Docker (para tools/deploy.sh verificar y local)" || no "Docker instalado (solo para ensayos locales)"
  if git remote get-url origin >/dev/null 2>&1; then
    si "remoto origin: $(git remote get-url origin)"
    git ls-remote --exit-code origin "refs/heads/$RAMA" >/dev/null 2>&1 && si "la rama $RAMA existe en origin" || no "la rama $RAMA en origin (o acceso a GitHub): se crea con el primer tools/deploy.sh staging"
  else
    no "remoto origin (repo de GitHub conectado a la GitHub App de Coolify)"
  fi
  [ -f deploy/.env.deploy ] && si "deploy/.env.deploy" || no "deploy/.env.deploy (copia deploy/env.deploy.ejemplo y llénalo)"
  [ -n "${COOLIFY_URL:-}" ] && si "COOLIFY_URL" || no "COOLIFY_URL"
  [ -n "${COOLIFY_TOKEN:-}" ] && si "COOLIFY_TOKEN" || no "COOLIFY_TOKEN (Coolify → Keys & Tokens → API tokens)"
  [ -n "$uuid" ] && si "UUID de la app de $amb" || no "UUID de la app de $amb (COOLIFY_APP_$([ "$amb" = produccion ] && echo PROD || echo STAGING))"
  if [ -n "${COOLIFY_URL:-}" ] && [ -n "${COOLIFY_TOKEN:-}" ] && [ -n "$uuid" ]; then
    if coolify GET "/applications/$uuid" >/dev/null 2>&1; then
      si "Coolify responde y reconoce la app"
      if [ -n "$(clave_de "$amb")" ] || coolify GET "/applications/$uuid/envs" 2>/dev/null | grep -q '"key":"SUPERADMIN_CLAVE"'; then si "clave del superadmin"; else no "SUPERADMIN_CLAVE_$([ "$amb" = produccion ] && echo PROD || echo STAGING) (primer deploy)"; fi
    else
      no "acceso a Coolify con ese token y esa app"
    fi
  fi
  node -e "require('node:dns').promises.lookup(process.argv[1]).then(r=>console.log('  [ok]    DNS '+process.argv[1]+' -> '+r.address)).catch(()=>{console.log('  [falta] registro A '+process.argv[1]+' -> IP del VPS (Hostinger)');process.exit(1)})" "$dominio" || ok=1
  [ "$ok" = 0 ] && info "listo: tools/deploy.sh $amb" || info "completa lo que falta y vuelve a correr tools/deploy.sh diagnostico $amb"
  return "$ok"
}

empujar() {
  [ "${SIN_PUSH:-0}" = 1 ] && { info "SIN_PUSH=1: no se empuja $RAMA"; return; }
  git remote get-url origin >/dev/null 2>&1 || falta "el remoto origin (repo de GitHub conectado a la GitHub App de Coolify)"
  info "push de $RAMA a origin (sin forzar)"
  git push origin "$RAMA"
}

case "${1:-}" in
  verificar) verificar ;;
  local) local_arriba ;;
  parar-local) docker rm -f "$CONTENEDOR_LOCAL" >/dev/null 2>&1 && info "contenedor local detenido (el volumen horizontes-datos-local se conserva)" || info "no había contenedor local" ;;
  diagnostico) diagnostico "${2:-staging}" ;;
  staging)
    requisitos staging
    [ "${SIN_PRUEBAS:-0}" = 1 ] || tools/test.sh
    empujar
    desplegar staging
    ;;
  produccion)
    requisitos produccion
    INTENTOS_SALUD=1 revisar staging >/dev/null 2>&1 || falla "Staging no está sano; no se despliega producción."
    v_staging=$(curl -fsS --max-time 10 "https://$(dominio_de staging)/api/health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).version||""))}catch{}})')
    v_main=$(git rev-parse "$RAMA")
    case "$v_main" in
      "$v_staging"*) [ -n "$v_staging" ] && info "staging corre $v_staging = $RAMA" ;;
      *) [ "${FORZAR:-0}" = 1 ] || falla "Staging corre '${v_staging:-?}' y $RAMA está en ${v_main:0:7}: despliega y prueba staging primero (o FORZAR=1)." ;;
    esac
    desplegar produccion
    ;;
  revisar) revisar "${2:-staging}" ;;
  *)
    sed -n '2,16p' "$0"
    exit 1
    ;;
esac

#!/usr/bin/env bash
# Pipeline de build y despliegue de Horizontes (Coolify sobre el VPS de Hostinger). Ver deploy/README.md.
#
#   deploy/desplegar.sh verificar      build de la imagen + arranque local + healthcheck (no publica nada)
#   deploy/desplegar.sh staging        pruebas + push de main + deploy en Coolify + healthcheck de staging
#   deploy/desplegar.sh produccion     deploy manual en Coolify (Auto Deploy apagado) + healthcheck
#
# Variables (en deploy/.env.deploy, ignorado por git, o en el entorno):
#   COOLIFY_URL            https://coolify.<dominio-del-vps>   (panel de Coolify)
#   COOLIFY_TOKEN          token de API de Coolify (Keys & Tokens → API tokens, permiso deploy)
#   COOLIFY_APP_STAGING    UUID de la app horizontes-staging
#   COOLIFY_APP_PROD       UUID de la app horizontes-prod
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f deploy/.env.deploy ] && set -a && . deploy/.env.deploy && set +a

STAGING_URL="${STAGING_URL:-https://staging-horizontes.estratek.com.co}"
PROD_URL="${PROD_URL:-https://horizontes.estratek.com.co}"
IMAGEN="horizontes:local"

falta() { echo "Falta $1. Revisa deploy/README.md (sección Credenciales)." >&2; exit 2; }

esperar_salud() {
  local url="$1" intentos="${2:-40}"
  echo "== esperando $url/api/health"
  for _ in $(seq 1 "$intentos"); do
    if curl -fsS "$url/api/health" >/dev/null 2>&1; then
      curl -fsS "$url/api/health"; echo
      echo "== OK: $url responde"
      return 0
    fi
    sleep 5
  done
  echo "== $url no respondió a tiempo. Revisa Logs en Coolify." >&2
  return 1
}

verificar() {
  command -v docker >/dev/null || { echo "Necesitas Docker para verificar la imagen." >&2; exit 2; }
  echo "== build de la imagen"
  docker build -f deploy/Dockerfile --build-arg SOURCE_COMMIT="$(git rev-parse --short HEAD)" -t "$IMAGEN" .
  local nombre="horizontes-verificar-$$" puerto="${PUERTO_VERIFICAR:-3999}"
  docker run -d --rm --name "$nombre" -p "$puerto:3000" \
    -e BASE_URL="http://localhost:$puerto" -e SUPERADMIN_USUARIO=verificar -e SUPERADMIN_CLAVE=verificar-local-123 \
    "$IMAGEN" >/dev/null
  trap 'docker stop "$nombre" >/dev/null 2>&1 || true' EXIT
  esperar_salud "http://localhost:$puerto" 24
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$puerto/admin")
  [ "$codigo" = "200" ] || { echo "== /admin respondió $codigo (se esperaba 200 con la SPA)" >&2; exit 1; }
  echo "== /admin sirve la SPA (200)"
}

desplegar() {
  local uuid="$1" url="$2"
  [ -n "${COOLIFY_URL:-}" ] || falta COOLIFY_URL
  [ -n "${COOLIFY_TOKEN:-}" ] || falta COOLIFY_TOKEN
  [ -n "$uuid" ] || falta "el UUID de la app (COOLIFY_APP_STAGING o COOLIFY_APP_PROD)"
  echo "== pidiendo deploy a Coolify"
  curl -fsS -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_URL/api/v1/deploy?uuid=$uuid&force=false"; echo
  esperar_salud "$url" 60
}

case "${1:-}" in
  verificar) verificar ;;
  staging)
    tools/test.sh
    git remote get-url origin >/dev/null 2>&1 || falta "el remoto origin (repo de GitHub conectado a Coolify)"
    git push origin main
    desplegar "${COOLIFY_APP_STAGING:-}" "$STAGING_URL"
    ;;
  produccion)
    esperar_salud "$STAGING_URL" 1 || { echo "Staging no está sano; no se despliega producción." >&2; exit 1; }
    desplegar "${COOLIFY_APP_PROD:-}" "$PROD_URL"
    ;;
  *)
    sed -n '2,13p' "$0"
    exit 1
    ;;
esac

#!/usr/bin/env bash
# Publica o último commit enviado ao GitHub no Render e espera ficar no ar.
# Uso: scripts/deploy.sh
# A chave do Render é injetada pelo proxy do ambiente de nuvem (RENDER_API_KEY é opcional fora dele).
set -euo pipefail
SERVICO="srv-dc1r1nss728c73d6rn6g"
SITE="https://maya-souza-nails.onrender.com"
CHAVE="${RENDER_API_KEY:-proxy-injected}"
API="https://api.render.com/v1/services/$SERVICO/deploys"

id=$(curl -sf -X POST -H "Authorization: Bearer $CHAVE" -H 'Content-Type: application/json' \
  -d '{"clearCache":"do_not_clear"}' "$API" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "Deploy iniciado: $id"
for _ in $(seq 1 60); do
  status=$(curl -sf -H "Authorization: Bearer $CHAVE" "$API/$id" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  case "$status" in
    live) echo "✅ No ar: $SITE"; break ;;
    *failed|canceled|deactivated) echo "❌ Deploy terminou com status: $status"; exit 1 ;;
  esac
  sleep 15
done
curl -s -o /dev/null -w "Site respondeu: HTTP %{http_code}\n" --max-time 90 "$SITE/healthz"

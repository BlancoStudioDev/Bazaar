#!/usr/bin/env bash
# Da lanciare SUL TUO MAC (non sul server): fa uscire da casa tua le richieste Facebook del server.
#
#   1. avvia fb-egress-proxy.py (solo facebook.com / fbcdn.net, solo su 127.0.0.1 del Mac);
#   2. apre un tunnel SSH INVERSO: sul server la porta 127.0.0.1:18081 (solo loopback) arriva a quel proxy.
#
# Il server usa FB_PROXY=http://127.0.0.1:18081 con FB_GUEST=1 (nessun cookie, nessun account).
# Se il Mac è spento o offline, Facebook sul server risponde con un errore chiaro e gli altri marketplace continuano.
#
# Uso:  ./deploy/fb-tunnel.sh        (resta in primo piano; Ctrl+C per fermarlo)
# Automatico al login:  vedi deploy/README.md ("Facebook sul server") e deploy/it.blancostudio.bazaar-fb.plist
set -euo pipefail

PORT="${FB_PROXY_PORT:-18081}"
DEPLOY_HOST="${DEPLOY_HOST:-blancostudio.dev}"
DEPLOY_USER="${DEPLOY_USER:-blanco05}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$HERE/fb-egress-proxy.py" --port "$PORT" &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null || true' EXIT INT TERM
sleep 1
kill -0 "$PROXY_PID" 2>/dev/null || { echo "Il proxy non è partito (porta $PORT occupata?)" >&2; exit 1; }

echo "[fb-tunnel] tunnel verso ${DEPLOY_USER}@${DEPLOY_HOST} (server 127.0.0.1:${PORT} -> proxy locale)"
while true; do
  ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
      -o ConnectionAttempts=3 -R "127.0.0.1:${PORT}:127.0.0.1:${PORT}" "${DEPLOY_USER}@${DEPLOY_HOST}" || true
  echo "[fb-tunnel] tunnel chiuso, riprovo tra 10 s…" >&2
  sleep 10
done

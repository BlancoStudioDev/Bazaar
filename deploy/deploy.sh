#!/usr/bin/env bash
# Deploy di Bazaar sul server, da lanciare DAL TUO MAC.
# Nessuna password nello script: usa chiave SSH / ssh-agent (se serve, ssh la chiede da solo).
#
# Uso:
#   DEPLOY_HOST=blancostudio.dev DEPLOY_USER=blanco05 APP_DOMAIN=bazaar.blancostudio.dev \
#     ./deploy/deploy.sh [--dry-run] [--install-unit] [--skip-mcp] [--skip-build]
#
# Variabili:
#   DEPLOY_HOST   (obbligatoria) host SSH
#   DEPLOY_USER   (default: blanco05)
#   DEPLOY_PATH   (default: /home/$DEPLOY_USER/bazaar)  -> app/, mcp/, data/, .env.production
#   APP_DOMAIN    (obbligatoria con --install-unit)
#   MCP_SRC       (default: ~/.config/opencode/mcp) sorgente locale dei server MCP
#   SSH_OPTS      opzioni extra per ssh (es. "-i ~/.ssh/id_ed25519_bazaar -p 22")
#   PYTHON_BIN    (default: python3) interprete sul server per creare i venv (>= 3.10)
#
# Opzioni:
#   --dry-run       stampa soltanto cosa farebbe (rsync -n, nessuna esecuzione via ssh)
#   --install-unit  installa/aggiorna anche unit systemd e vhost nginx (richiede sudo sul server)
#   --skip-mcp      non sincronizza né installa i server MCP
#   --skip-build    salta npm ci / build (solo sync + restart)
set -euo pipefail

DRY_RUN=0; INSTALL_UNIT=0; SKIP_MCP=0; SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --install-unit) INSTALL_UNIT=1 ;;
    --skip-mcp) SKIP_MCP=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) echo "Opzione sconosciuta: $arg" >&2; exit 2 ;;
  esac
done

: "${DEPLOY_HOST:?Imposta DEPLOY_HOST (es. blancostudio.dev)}"
DEPLOY_USER="${DEPLOY_USER:-blanco05}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/${DEPLOY_USER}/bazaar}"
MCP_SRC="${MCP_SRC:-$HOME/.config/opencode/mcp}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
SSH_OPTS="${SSH_OPTS:-}"
APP_DOMAIN="${APP_DOMAIN:-}"
if [ "$INSTALL_UNIT" = 1 ]; then : "${APP_DOMAIN:?--install-unit richiede APP_DOMAIN}"; fi

case "$DEPLOY_PATH" in /?*) ;; *) echo "DEPLOY_PATH deve essere un percorso assoluto non radice" >&2; exit 2 ;; esac
case "$DEPLOY_PATH" in *[[:space:]\"\'\$\`\\]*) echo "DEPLOY_PATH contiene caratteri non ammessi" >&2; exit 2 ;; esac

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
# shellcheck disable=SC2206
SSH_CMD=(ssh -o ServerAliveInterval=30 $SSH_OPTS)
RSYNC_SSH="ssh -o ServerAliveInterval=30 $SSH_OPTS"

RSYNC_FLAGS=(-az --delete --human-readable --itemize-changes -e "$RSYNC_SSH")

say() { printf '\n==> %s\n' "$*"; }

# rs: rsync reale, oppure (dry-run) solo stampa del comando, senza alcuna connessione.
rs() {
  if [ "$DRY_RUN" = 1 ]; then printf '[dry-run] rsync'; printf ' %q' "$@"; echo
  else rsync "$@"; fi
}

# run_ssh [-t]: legge lo script da stdin e lo esegue sul server (in dry-run lo stampa soltanto).
run_ssh() {
  local tty=()
  if [ "${1:-}" = "-t" ]; then tty=(-t); shift; fi
  if [ "$DRY_RUN" = 1 ]; then
    echo "[dry-run] ssh $REMOTE bash -s <<'script'"; cat; echo "script"
  elif [ ${#tty[@]} -gt 0 ]; then
    # con -t lo script non puo' arrivare da stdin: lo passo come argomento
    local body; body="$(cat)"
    "${SSH_CMD[@]}" -t "$REMOTE" "bash -c $(printf '%q' "$body")"
  else
    "${SSH_CMD[@]}" "$REMOTE" bash -s
  fi
}

command -v rsync >/dev/null || { echo "rsync non trovato" >&2; exit 1; }
[ -f "$ROOT/package-lock.json" ] || { echo "package-lock.json mancante (serve per npm ci)" >&2; exit 1; }

say "Target: $REMOTE:$DEPLOY_PATH  (dry-run=$DRY_RUN)"

say "Creo le directory sul server (app, mcp, data)"
run_ssh <<SCRIPT
set -euo pipefail
mkdir -p "$DEPLOY_PATH/app" "$DEPLOY_PATH/mcp" "$DEPLOY_PATH/data"
chmod 700 "$DEPLOY_PATH/data"
SCRIPT

say "rsync dell'app (esclusi node_modules, .next, .env*, data/, .git)"
# --delete agisce solo sotto app/; data/ e .env.production vivono fuori da app/.
rs "${RSYNC_FLAGS[@]}" \
  --exclude '.git/' --exclude 'node_modules/' --exclude '.next/' \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'data/' --exclude '*.db' --exclude '*.db-*' --exclude '*.sqlite*' \
  --exclude '.DS_Store' --exclude '*.log' --exclude 'deploy/' \
  --exclude 'coverage/' --exclude 'out/' --exclude '*.tsbuildinfo' --exclude 'next-env.d.ts' \
  --exclude '*.pem' \
  "$ROOT/" "$REMOTE:$DEPLOY_PATH/app/"

if [ "$SKIP_MCP" = 0 ]; then
  [ -d "$MCP_SRC" ] || { echo "MCP_SRC non trovato: $MCP_SRC" >&2; exit 1; }
  say "rsync dei 5 server MCP (whitelist: solo sorgenti .py, requirements.txt, README.md)"
  # Solo amazon, aliexpress, vinted, subito-search, facebook-marketplace (non calendario, mail, ecc.).
  # File sensibili/inutili presenti nelle cartelle e quindi esclusi:
  #   facebook-marketplace/cookies_cache.json  cookie Facebook decifrati (!)
  #   facebook-marketplace/state.json, monitors.json, cookies.txt  stato/sessione
  #   subito-search/*_scan*.json, sweep_*.json, deepscan_results.json, alt_scan_out.txt  dump di test
  #   .venv/ (non portabile da macOS arm64 a Linux), __pycache__/
  # La whitelist (--include ... --exclude '*') li lascia fuori comunque; gli exclude espliciti sono una cintura in piu'.
  for d in amazon aliexpress vinted subito-search facebook-marketplace; do
    [ -d "$MCP_SRC/$d" ] || { echo "Manca $MCP_SRC/$d" >&2; exit 1; }
    rs "${RSYNC_FLAGS[@]}" \
      --exclude '.venv/' --exclude '__pycache__/' --exclude '*.pyc' \
      --exclude 'cookies*' --exclude '*cookie*' --exclude 'state.json' --exclude 'monitors.json' \
      --exclude '*token*' --exclude '*secret*' --exclude '.env*' --exclude '*.log' \
      --exclude '*_scan*.json' --exclude 'sweep*' --exclude 'deepscan*' --exclude 'alt_scan*' \
      --exclude '*.tmp' --exclude '.DS_Store' \
      --include '*.py' --include 'requirements.txt' --include 'README.md' \
      --exclude '*' \
      "$MCP_SRC/$d/" "$REMOTE:$DEPLOY_PATH/mcp/$d/"
  done
fi

if [ "$INSTALL_UNIT" = 1 ]; then
  say "Installo unit systemd e vhost nginx (sudo sul server)"
  TMP_UNIT="$(mktemp)"; TMP_NGINX="$(mktemp)"; trap 'rm -f "$TMP_UNIT" "$TMP_NGINX"' EXIT
  sed -e "s#@DEPLOY_PATH@#${DEPLOY_PATH}#g" -e "s#@DEPLOY_USER@#${DEPLOY_USER}#g" "$HERE/bazaar.service" > "$TMP_UNIT"
  sed -e "s#@APP_DOMAIN@#${APP_DOMAIN}#g" "$HERE/nginx.conf" > "$TMP_NGINX"
  if [ "$DRY_RUN" = 1 ]; then
    echo "[dry-run] scp unit -> /tmp/bazaar.service ; vhost -> /tmp/bazaar.nginx.conf"
  else
    # shellcheck disable=SC2086
    scp $SSH_OPTS "$TMP_UNIT" "$REMOTE:/tmp/bazaar.service"
    # shellcheck disable=SC2086
    scp $SSH_OPTS "$TMP_NGINX" "$REMOTE:/tmp/bazaar.nginx.conf"
  fi
  run_ssh -t <<SCRIPT
set -euo pipefail
sudo install -m 644 /tmp/bazaar.service /etc/systemd/system/bazaar.service
sudo install -m 644 /tmp/bazaar.nginx.conf /etc/nginx/sites-available/${APP_DOMAIN}
sudo ln -sf /etc/nginx/sites-available/${APP_DOMAIN} /etc/nginx/sites-enabled/${APP_DOMAIN}
rm -f /tmp/bazaar.service /tmp/bazaar.nginx.conf
sudo systemctl daemon-reload
sudo systemctl enable bazaar
echo "Unit installata. Il vhost nginx NON e' ricaricato qui: segui deploy/README.md (certbot prima del reload)."
SCRIPT
fi

say "Dipendenze, build, venv MCP, migrazione e restart (via ssh)"
run_ssh -t <<SCRIPT
set -euo pipefail
APP="$DEPLOY_PATH/app"; MCP="$DEPLOY_PATH/mcp"; ENVF="$DEPLOY_PATH/.env.production"

if [ ! -f "\$ENVF" ]; then
  echo "ERRORE: manca \$ENVF. Crealo da deploy/env.production.example (chmod 600) e rilancia." >&2
  exit 1
fi
chmod 600 "\$ENVF"

# Variabili di produzione per build e migrazione (non vengono stampate).
set -a; . "\$ENVF"; set +a

cd "\$APP"
if [ "$SKIP_BUILD" = 0 ]; then
  echo "--> npm ci"
  npm ci --no-audit --no-fund
  echo "--> npm run build"
  npm run build
fi

if [ "$SKIP_MCP" = 0 ]; then
  PY="$PYTHON_BIN"
  "\$PY" -c 'import sys; assert sys.version_info >= (3,10), "serve Python >= 3.10"'
  mkvenv() { # mkvenv <venv_dir> <requirements...>
    local venv="\$1"; shift
    [ -x "\$venv/bin/python" ] || "\$PY" -m venv "\$venv"
    "\$venv/bin/python" -m pip install --quiet --upgrade pip
    local args=(); for r in "\$@"; do args+=(-r "\$r"); done
    "\$venv/bin/python" -m pip install --quiet "\${args[@]}"
  }
  echo "--> venv condiviso (amazon, aliexpress, vinted)"
  mkvenv "\$MCP/.venv" "\$MCP/amazon/requirements.txt" "\$MCP/aliexpress/requirements.txt" "\$MCP/vinted/requirements.txt"
  echo "--> venv subito-search"
  mkvenv "\$MCP/subito-search/.venv" "\$MCP/subito-search/requirements.txt"
  case ",\${MCP_DISABLED:-}," in
    *,facebook-marketplace,*) echo "--> facebook-marketplace disabilitato (MCP_DISABLED): salto il venv" ;;
    *) echo "--> venv facebook-marketplace"
       mkvenv "\$MCP/facebook-marketplace/.venv" "\$MCP/facebook-marketplace/requirements.txt" ;;
  esac
fi

if node -e 'process.exit(require("./package.json").scripts?.["auth:migrate"] ? 0 : 1)'; then
  echo "--> npm run auth:migrate"
  npm run auth:migrate
else
  echo "--> auth:migrate non presente in package.json: salto"
fi

if systemctl cat bazaar >/dev/null 2>&1; then
  echo "--> restart bazaar.service"
  sudo systemctl restart bazaar
  sleep 2
  sudo systemctl --no-pager --lines=5 status bazaar || true
else
  echo "ATTENZIONE: bazaar.service non installata. Rilancia con --install-unit o segui deploy/README.md."
fi
SCRIPT

say "Fatto${APP_DOMAIN:+. Verifica: https://$APP_DOMAIN}"
[ "$DRY_RUN" = 1 ] && echo "(dry-run: non e' stato modificato nulla)"
exit 0

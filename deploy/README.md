# Deploy di Bazaar su server Linux

Layout sul server (`DEPLOY_PATH`, default `/home/blanco05/bazaar`):

```
bazaar/
├── app/             codice Next.js (sincronizzato da deploy.sh)
├── mcp/             5 server MCP Python + venv creati sul server
├── data/            SQLite dell'auth (persistente, NON sovrascritta dal deploy)
└── .env.production  segreti (chmod 600, creato a mano, mai sincronizzato)
```

## 1. Sicurezza dell'accesso (prima di tutto)

- Usa una **chiave SSH**, non la password: `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_bazaar`, poi `ssh-copy-id -i ~/.ssh/id_ed25519_bazaar.pub blanco05@blancostudio.dev`. Poi usa `SSH_OPTS="-i ~/.ssh/id_ed25519_bazaar"` con `deploy.sh`.
- **Non riusare né condividere la password dell'account.** Se è stata condivisa in chiaro (chat, email, ticket), **cambiala subito** (`passwd`) e, dopo aver verificato la chiave, disabilita il login con password (`PasswordAuthentication no` in `/etc/ssh/sshd_config`, poi `sudo systemctl reload ssh`).
- L'app gira con l'utente non-root `blanco05` (o uno dedicato, es. `bazaar`: cambia `DEPLOY_USER`).

## 2. Prerequisiti sul server

Debian/Ubuntu, con sudo per l'utente:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx python3 python3-venv python3-pip build-essential rsync
# Node 20+ (verifica con node -v). Esempio NodeSource:
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
```

`build-essential` serve se il pacchetto SQLite scelto per l'auth compila moduli nativi. Python deve essere >= 3.10 (richiesto da `mcp>=2.3`).

## 3. DNS

Crea un record `A` (e `AAAA` se hai IPv6) per `bazaar.blancostudio.dev` verso l'IP del server. Verifica: `dig +short bazaar.blancostudio.dev`.

## 4. Client OIDC su onionrings

Su <https://auth.onionrings.dev/admin/> crea un client con questi valori esatti:

| Campo | Valore |
|---|---|
| Name | `Bazaar (produzione)` |
| Application type | Web |
| Authentication | Confidential |
| Callback | `https://<APP_DOMAIN>/api/auth/callback/onionrings` |
| Browser origins | (vuoto) |
| Post-logout | (vuoto) |

Copia **client id** e **client secret** e mettili **solo** in `.env.production` sul server (`ONIONRINGS_CLIENT_ID`, `ONIONRINGS_CLIENT_SECRET`). Non vanno in chat, nel repo o in `.env.example`.

## 5. Segreti sul server

```bash
ssh blanco05@blancostudio.dev
mkdir -p ~/bazaar/data && chmod 700 ~/bazaar/data
nano ~/bazaar/.env.production      # incolla il contenuto di deploy/env.production.example e compila
chmod 600 ~/bazaar/.env.production
openssl rand -base64 32            # valore per BETTER_AUTH_SECRET
```

Imposta `BETTER_AUTH_URL=https://<APP_DOMAIN>`, `ALLOWED_EMAILS`, `OPENROUTER_API_KEY` (o un altro provider), e verifica i percorsi `MCP_*` / `AUTH_DB_PATH` rispetto a `DEPLOY_PATH`.

## 6. Primo deploy

Dal Mac, nella radice del progetto:

```bash
export DEPLOY_HOST=blancostudio.dev DEPLOY_USER=blanco05 APP_DOMAIN=bazaar.blancostudio.dev
export SSH_OPTS="-i ~/.ssh/id_ed25519_bazaar"      # opzionale
./deploy/deploy.sh --dry-run                       # stampa soltanto
./deploy/deploy.sh --install-unit                  # primo giro: installa anche unit systemd e vhost
```

Lo script sincronizza app e MCP, esegue `npm ci`, `npm run build`, crea i venv Python, lancia `npm run auth:migrate` (se presente) e riavvia `bazaar.service`. È ripetibile: i deploy successivi si lanciano senza `--install-unit`. Opzioni: `--skip-mcp`, `--skip-build`.

> `--install-unit` copia unit e vhost ma **non** ricarica nginx (il vhost 443 richiede i certificati). Se `sudo` chiede la password lo fa ssh in modo interattivo.

## 7. nginx e TLS (una volta)

Sul server, il file è in `/etc/nginx/sites-available/<APP_DOMAIN>` e già collegato in `sites-enabled`. Il certificato ancora non esiste:

```bash
sudo certbot certonly --nginx -d bazaar.blancostudio.dev     # oppure --webroot -w /var/www/html
sudo nginx -t && sudo systemctl reload nginx
```

(Se `nginx -t` fallisce perché il certificato manca, commenta temporaneamente il blocco `server` su 443, esegui certbot, poi ripristinalo.) Il rinnovo è automatico (`systemctl list-timers | grep certbot`).

Il vhost proxya su `127.0.0.1:3000`; per `/api/chat` disattiva il buffering (`proxy_buffering off`, `proxy_read_timeout 300s`) così gli eventi SSE arrivano in tempo reale.

## 8. Servizio systemd

```bash
sudo systemctl enable --now bazaar
journalctl -u bazaar -f
```

La unit usa `EnvironmentFile=$DEPLOY_PATH/.env.production`, `Restart=on-failure`, `NoNewPrivileges`, `ProtectSystem=strict` e scrive solo in `data/`, `mcp/` e `app/.next`. Se Node è installato con nvm, sostituisci `/usr/bin/node` in `ExecStart` con il percorso reale.

## 9. Verifica post-deploy

Non esiste un endpoint `/api/health` dedicato; usa:

```bash
curl -sI https://bazaar.blancostudio.dev | head -5           # 200/302 verso login, header di sicurezza presenti
curl -s -o /dev/null -w '%{http_code}\n' https://bazaar.blancostudio.dev/api/status   # 401 senza sessione = auth attiva
sudo systemctl status bazaar --no-pager
```

Poi apri il sito nel browser, fai login con onionrings e controlla `/api/status` da loggato (stato dei server MCP e della chiave LLM). Verifica SSE: nella chat la risposta deve comparire a token, non tutta insieme.

## 10. Rollback

- App: il deploy non conserva release precedenti. Prima di un aggiornamento rischioso: `ssh … 'cp -a ~/bazaar/app ~/bazaar/app.prev'`. Per tornare indietro: `sudo systemctl stop bazaar && rm -rf ~/bazaar/app && mv ~/bazaar/app.prev ~/bazaar/app && sudo systemctl start bazaar`. In alternativa, ridistribuisci dal Mac una versione precedente del codice.
- Dati: fai backup di `data/auth.db` (`sqlite3 data/auth.db ".backup 'auth.bak'"`); il deploy non la tocca.
- Fermare tutto: `sudo systemctl disable --now bazaar`.

## Server MCP: cosa viene copiato

Solo `amazon`, `aliexpress`, `vinted`, `subito-search`, `facebook-marketplace` (non calendario, mail, telegram, whatsapp, ecc.) e solo `*.py`, `requirements.txt`, `README.md`. Esclusi:

| Escluso | Motivo |
|---|---|
| `facebook-marketplace/cookies_cache.json` | cookie Facebook decifrati: sensibile |
| `facebook-marketplace/state.json`, `monitors.json`, `cookies.txt` | stato/sessione locale |
| `subito-search/*_scan*.json`, `sweep_*.json`, `deepscan_results.json`, `alt_scan_out.txt` | dump di test, centinaia di KB inutili |
| `.venv/`, `__pycache__/` | non portabili da macOS arm64 a Linux |
| `*.log`, `.env*`, `*token*`, `*secret*`, `*cookie*` | per sicurezza |

Dipendenze (da `requirements.txt` di ciascun server): `mcp>=2.3,<3`, `curl_cffi>=0.13`, `beautifulsoup4>=4.12` (amazon, vinted, subito), più `cryptography>=45` per Facebook. Il deploy crea sul server: `mcp/.venv` (amazon+aliexpress+vinted), `mcp/subito-search/.venv`, e `mcp/facebook-marketplace/.venv` solo se Facebook non è in `MCP_DISABLED`. Se un `requirements.txt` mancasse, ricavalo localmente con `.venv/bin/pip freeze` (solo come suggerimento, da rivedere a mano).

### Facebook Marketplace sul server

Sul server non c'è Chrome: la lettura cookie da Chrome macOS non funziona, quindi `MCP_DISABLED=facebook-marketplace`. Esiste però un modo supportato per fornire i cookie a mano (`fb.py`, `load_cookies`): variabile `FB_COOKIE_HEADER` (o `FACEBOOK_COOKIES`) con l'header `Cookie`, oppure un file `cookies.txt` (header, JSON o formato Netscape; percorso alternativo con `FB_COOKIE_FILE`) in `mcp/facebook-marketplace/`. Servono almeno `c_user` e `xs`. È un'opzione sconsigliata: i cookie sono una sessione personale completa del tuo account Facebook, scadono, e usarli da un IP datacenter può far scattare controlli o il blocco dell'account. Se la attivi: file `chmod 600`, fuori da git, rimuovi `facebook-marketplace` da `MCP_DISABLED`, rilancia il deploy.

#!/usr/bin/env bash
# Da eseguire SUL SERVER, una volta sola, come utente con sudo:  bash ~/bazaar/apache-setup.sh
# Aggiunge /bazaar al vhost 443 di blancostudio.dev, con backup e ripristino automatico se configtest fallisce.
set -euo pipefail

CONF=/etc/apache2/sites-available/blancostudio.dev-le-ssl.conf
SNIPPET=/home/blanco05/bazaar/apache-bazaar.conf
BACKUP="$CONF.bak-bazaar"
LINE="    Include $SNIPPET"

[ -f "$SNIPPET" ] || { echo "Manca $SNIPPET" >&2; exit 1; }
[ -f "$CONF" ] || { echo "Manca $CONF" >&2; exit 1; }

if sudo grep -qF "$SNIPPET" "$CONF"; then
  echo "== /bazaar è già configurato in $CONF: salto la modifica"
else
  echo "== Backup in $BACKUP"
  sudo cp -n "$CONF" "$BACKUP"
  echo "== Aggiungo l'Include nel vhost"
  sudo sed -i "0,/ProxyPreserveHost On/s##ProxyPreserveHost On\n$LINE#" "$CONF"
  echo "== configtest"
  if ! sudo apache2ctl configtest; then
    echo "!! configtest fallito: ripristino il backup, Apache NON è stato ricaricato" >&2
    sudo cp "$BACKUP" "$CONF"
    exit 1
  fi
  echo "== Ricarico Apache"
  sudo systemctl reload apache2
fi

echo "== Linger (il servizio utente resta acceso dopo il logout)"
sudo loginctl enable-linger blanco05

echo "== Verifica"
curl -s -o /dev/null -w "https://blancostudio.dev/bazaar/login -> %{http_code}\n" https://blancostudio.dev/bazaar/login
echo "Fatto."

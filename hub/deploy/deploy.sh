#!/bin/bash
# Build en local, copie sur le serveur macOS, installe/redémarre le LaunchAgent et le `tailscale serve`.
# Usage : DEPLOY_HOST=moi@mon-serveur deploy/deploy.sh   (DEPLOY_DIR, DEPLOY_LABEL, DEPLOY_HTTPS_PORT pour surcharger)
set -euo pipefail

HOST="${DEPLOY_HOST:?DEPLOY_HOST manquant, par exemple moi@mon-serveur}"
DIR="${DEPLOY_DIR:-Apps/ezbrain-hub}" # relatif au home distant
LABEL="${DEPLOY_LABEL:-local.ezbrain-hub}"
HTTPS_PORT="${DEPLOY_HTTPS_PORT:-8446}"

cd "$(dirname "$0")/.."
npm run build

ssh "$HOST" "mkdir -p ~/$DIR/logs"
rsync -az --delete dist/ "$HOST:$DIR/dist/"
rsync -az package.json package-lock.json config.example.yaml deploy "$HOST:$DIR/"

ssh "$HOST" DIR="$DIR" LABEL="$LABEL" HTTPS_PORT="$HTTPS_PORT" bash -s <<'REMOTE'
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH
cd ~/"$DIR"
if [ ! -f config.yaml ]; then
  cp config.example.yaml config.yaml
  echo "config.yaml créé depuis config.example.yaml"
fi
npm ci --omit=dev --no-audit --no-fund --loglevel=error

PLIST=~/Library/LaunchAgents/$LABEL.plist
TARGET=gui/$(id -u)/$LABEL
sed "s#__LABEL__#$LABEL#g; s#__DIR__#$HOME/$DIR#g; s#__NODE__#$(command -v node)#g" deploy/local.ezbrain-hub.plist > /tmp/$LABEL.plist
if ! cmp -s /tmp/$LABEL.plist "$PLIST" || ! launchctl print "$TARGET" >/dev/null 2>&1; then
  mv /tmp/$LABEL.plist "$PLIST"
  launchctl bootout "$TARGET" 2>/dev/null && sleep 1 || true
  launchctl bootstrap gui/$(id -u) "$PLIST"
  echo "LaunchAgent installé"
else
  rm /tmp/$LABEL.plist
  launchctl kickstart -k "$TARGET"
  echo "Hub redémarré"
fi

if ! tailscale serve status 2>/dev/null | grep -q ":$HTTPS_PORT "; then
  tailscale serve --bg --https="$HTTPS_PORT" http://127.0.0.1:8792
  echo "tailscale serve configuré sur le port HTTPS $HTTPS_PORT"
fi
REMOTE

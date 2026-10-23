#!/bin/sh
# Il banco visivo della finestra: compila il banco, lo serve, lo misura.
# Playwright e Chromium NON stanno nel progetto: la prima volta
#   mkdir -p "$PLAYWRIGHT_DIR" && cd "$PLAYWRIGHT_DIR" && npm init -y && npm i playwright@1.47.0 && npx playwright install chromium
set -e
cd "$(dirname "$0")/../.."
: "${PLAYWRIGHT_DIR:?Serve PLAYWRIGHT_DIR (cartella con node_modules/playwright)}"
OUT="${OUT:-/tmp/banco-finestra}"
VITE_SUPABASE_URL=https://finto.supabase.co VITE_SUPABASE_ANON_KEY=sb_publishable_finto \
  npx vite build --config prove/banco/vite.harness.config.js --outDir "$OUT" >/dev/null 2>&1
( cd "$OUT" && python3 -m http.server 4173 >/dev/null 2>&1 ) & SERVER=$!
sleep 1
set +e
PLAYWRIGHT_DIR="$PLAYWRIGHT_DIR" node prove/banco/finestra.mjs http://localhost:4173/prove/banco/finestra.html "${FOTO:-$OUT/finestra.png}"; ESITO=$?
kill $SERVER 2>/dev/null
exit $ESITO

#!/bin/sh
# Il controllo che manca alle edge function.
#
# `supabase functions deploy` impacchetta e basta: non guarda i tipi e non
# si accorge di una variabile che non esiste. Il 18/10/2026 e' finita in
# produzione una funzione con dentro `dataIso is not defined`, e l'ha
# scoperta il titolare premendo il tasto per emettere una fattura vera.
#
# Si lancia prima di pubblicare:  sh controlla-funzioni.sh
# oppure su una sola:             sh controlla-funzioni.sh pos-emetti-fattura
DENO="${DENO:-$HOME/.deno/bin/deno}"
[ -x "$DENO" ] || { echo "Deno non c'e': curl -fsSL https://deno.land/install.sh | sh"; exit 1; }

# DOVE GIRA IL CONTROLLO, e perche' non qui dentro.
#
# Due funzioni importano pacchetti npm (`web-push`, il client Supabase da
# JSR). Su Supabase quelli li risolve la pubblicazione; in locale no, e
# `deno check` si fermava con "could not find a matching package" — che
# non e' un difetto del codice ma sembrava tale, e teneva lo strumento
# rosso su due funzioni sane.
#
# La cura e' lasciare che Deno se li scarichi. Ma il suo `node_modules`
# non deve finire in quello del progetto, che lo gestisce npm per Vite:
# due gestori nella stessa cartella e' un guaio che si paga dopo. Quindi
# gira in una cartella sua, esclusa da git, dove la roba scaricata resta
# fra una volta e l'altra.
BANCO="${BANCO:-.controllo-deno}"
mkdir -p "$BANCO"
[ -f "$BANCO/deno.json" ] || echo '{"nodeModulesDir":"auto"}' > "$BANCO/deno.json"
RADICE=$(pwd)
if [ -n "$1" ]; then ELENCO="supabase/functions/$1/index.ts"; else
  ELENCO=$(ls -d supabase/functions/*/ | grep -v "_shared" | sed 's:/$:/index.ts:')
fi
guai=0
for f in $ELENCO; do
  [ -f "$f" ] || continue
  nome=$(basename "$(dirname "$f")")
  if out=$(cd "$BANCO" && "$DENO" check "$RADICE/$f" 2>&1); then
    printf "ok      %s\n" "$nome"
  else
    printf "GUASTO  %s\n" "$nome"
    echo "$out" | grep -E "TS[0-9]+|error:" | head -3 | sed 's/^/        /'
    guai=$((guai + 1))
  fi
done
[ "$guai" -eq 0 ] && echo "\nTutte a posto." || echo "\n$guai da sistemare."
exit "$guai"

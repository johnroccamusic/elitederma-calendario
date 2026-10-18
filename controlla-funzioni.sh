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
if [ -n "$1" ]; then ELENCO="supabase/functions/$1/index.ts"; else
  ELENCO=$(ls -d supabase/functions/*/ | grep -v "_shared" | sed 's:/$:/index.ts:')
fi
guai=0
for f in $ELENCO; do
  [ -f "$f" ] || continue
  nome=$(basename "$(dirname "$f")")
  if out=$("$DENO" check "$f" 2>&1); then
    printf "ok      %s\n" "$nome"
  else
    printf "GUASTO  %s\n" "$nome"
    echo "$out" | grep -E "TS[0-9]+|error:" | head -3 | sed 's/^/        /'
    guai=$((guai + 1))
  fi
done
[ "$guai" -eq 0 ] && echo "\nTutte a posto." || echo "\n$guai da sistemare."
exit "$guai"

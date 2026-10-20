-- Lo sgabello si butta appena finito di salire: la tavola dei codici
-- catastali serviva al backfill e a nient'altro, e una tabella che non
-- legge nessuno e' peggio di una tabella che non c'e' — sembra viva.
drop table if exists public._luoghi_catastali_20261020;

-- Lo stesso vale per la funzione della lettera di controllo: l'algoritmo
-- vive in src/iscrizione/codice-fiscale.js, ed e' provato li'. Due copie
-- prima o poi si contraddicono, e quella in SQL non ha prove.
drop function if exists public._cf_lettera(text);

-- La fotografia del prima, invece, resta: e' l'unico modo di disfare il
-- backfill. Ma contiene nome, codice fiscale e data di nascita di 242
-- allieve, e una tabella nuova nasce SENZA RLS — cioe' in lettura e
-- scrittura a chiunque abbia la chiave del bundle, che e' pubblica.
-- RLS acceso e nessuna policy: la tocca solo `service_role`.
alter table public._backup_nascita_20261020 enable row level security;

comment on table public._backup_nascita_20261020 is
  'Com''erano sesso/data/luogo di nascita prima del backfill del 20/10/2026 (tutti vuoti). Da esportare e cancellare.';

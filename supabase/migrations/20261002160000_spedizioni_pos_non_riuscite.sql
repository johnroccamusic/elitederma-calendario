-- I tentativi di spedizione del POS che non sono andati a buon fine.
--
-- Al banco la vendita e l'ordine di spedizione sono due scritture in
-- sequenza, su due tabelle. La prima passa quasi sempre; se la seconda
-- fallisce, finora restava solo un avviso a schermo — e l'indirizzo
-- appena digitato moriva col modulo. Chi chiudeva l'avviso non aveva piu'
-- niente: ne' l'ordine da spedire ne' il dato per rifarlo.
--
-- E' successo davvero, e per sei giorni: dal 26/09 al 02/10/2026 nessuna
-- spedizione POS e' stata creata, per una colonna che mancava su
-- spedizioni_pos. Nessuno se n'e' accorto finche' un cliente non ha
-- chiesto il pacco.
--
-- Qui si conserva il modulo INTERO (`dati`), non un riassunto: riprovare
-- deve essere un clic, non una telefonata al cliente.
create table if not exists spedizioni_pos_non_riuscite (
  id            uuid primary key default gen_random_uuid(),
  vendita_id    uuid references vendite_shop(id) on delete cascade,
  numero_ordine text,
  dati          jsonb not null,
  errore        text,
  operatore     text,
  tentato_il    timestamptz not null default now(),
  risolto_il    timestamptz,
  spedizione_id uuid references spedizioni_pos(id) on delete set null
);

create index if not exists spedizioni_pos_non_riuscite_aperte_idx
  on spedizioni_pos_non_riuscite(tentato_il desc) where risolto_il is null;

alter table spedizioni_pos_non_riuscite enable row level security;

drop policy if exists spedizioni_pos_non_riuscite_tutti on spedizioni_pos_non_riuscite;
create policy spedizioni_pos_non_riuscite_tutti on spedizioni_pos_non_riuscite
  for all to anon, authenticated using (true) with check (true);

comment on table spedizioni_pos_non_riuscite is
  'Ordini di spedizione del POS che non sono stati creati. Conserva il modulo intero per poter riprovare con un clic (02/10/2026).';

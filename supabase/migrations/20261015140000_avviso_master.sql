-- L'AVVISO CHE LE MASTER LEGGONO ENTRANDO.
--
-- Un messaggio scritto da chi amministra, che compare a chi entra con
-- un'utenza master e sparisce quando preme "Ho letto".
--
-- CHI L'HA LETTO STA IN UNA TABELLA, non nel browser. Su localStorage
-- la stessa master lo rivedrebbe dal tablet e dal telefono come se non
-- l'avesse mai aperto, e chi scrive l'avviso non avrebbe modo di sapere
-- se e' arrivato. Qui invece si sa, e si sa quando.
--
-- `versione` e' la data di modifica dell'avviso: cambiando il testo
-- cambia la versione, le righe vecchie restano come storia e l'avviso
-- torna a comparire a tutte. Un avviso corretto e' un avviso nuovo.
create table if not exists avvisi_master_letti (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references master(id) on delete cascade,
  versione text not null,
  letto_il timestamptz not null default now(),
  unique (master_id, versione)
);

alter table avvisi_master_letti enable row level security;

-- Come le altre tabelle interne: chi usa il gestionale scrive la propria
-- riga. Non c'e' niente di personale qui dentro oltre al fatto di aver
-- letto un messaggio.
create policy "accesso interno avvisi_master_letti" on avvisi_master_letti
  for all to anon, authenticated using (true) with check (true);

create index if not exists avvisi_master_letti_master on avvisi_master_letti (master_id);

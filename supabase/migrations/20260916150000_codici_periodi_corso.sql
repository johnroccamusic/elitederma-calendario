-- Analisi codici sconto: l'abbinamento confermato a mano fra un periodo
-- d'uso di un codice (dal primo all'ultimo ordine) e il corso a cui
-- appartengono quelle vendite. Il periodo si riconosce da codice e data
-- del primo ordine. Applicata via MCP il 16/09/2026.
create table if not exists codici_periodi_corso (
  id uuid primary key default gen_random_uuid(),
  codice text not null,
  dal date not null,
  al date not null,
  corsi_date_id uuid not null references corsi_date(id) on delete cascade,
  confermato_il timestamptz not null default now(),
  note text,
  unique (codice, dal)
);
alter table codici_periodi_corso enable row level security;
drop policy if exists "accesso interno codici_periodi_corso" on codici_periodi_corso;
create policy "accesso interno codici_periodi_corso" on codici_periodi_corso
  for all to anon, authenticated using (true) with check (true);

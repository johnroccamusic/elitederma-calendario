-- Il listino di una sede per giorni della settimana.
--
-- Una sede costa diverso infrasettimanale e nel fine settimana: il
-- Centro Fregleo a Napoli fa un prezzo dal lunedi' al venerdi' e un
-- altro sabato e domenica. Finora la sede aveva una tariffa sola
-- (location.costo_giornaliero_cash / _bonifico), moltiplicata per i
-- giorni del corso.
--
-- E' lo stesso meccanismo gia' in piedi sugli hotel (hotel_prezzi.giorni),
-- ma senza i periodi dell'anno: qui contano solo i giorni della
-- settimana. Come li' ogni fascia porta i suoi due prezzi, cash e
-- bonifico, perche' la sede fa due cifre diverse a seconda di come la
-- si paga.
--
-- `giorni` nasce vuoto di proposito: accendere tutti e sette vorrebbe
-- dire coprire di colpo una settimana che le altre fasce si stanno
-- ancora dividendo.
create table if not exists location_prezzi (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references location(id) on delete cascade,
  nome text,
  giorni smallint[] not null default '{}'::smallint[],
  prezzo_cash numeric,
  prezzo_bonifico numeric,
  ordine smallint not null default 1,
  aggiornato_il timestamptz not null default now()
);

create index if not exists location_prezzi_location on location_prezzi (location_id, ordine);

alter table location_prezzi enable row level security;
drop policy if exists location_prezzi_tutti on location_prezzi;
create policy location_prezzi_tutti on location_prezzi for all to anon, authenticated using (true) with check (true);

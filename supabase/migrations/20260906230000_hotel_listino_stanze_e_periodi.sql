-- Listino degli hotel per tipo di stanza, con i periodi speciali.
--
-- Prima l'hotel aveva due soli prezzi — costo_notte_cash e
-- costo_notte_fattura — senza distinguere singola, doppia e tripla, e senza
-- modo di dire che ad agosto costa un'altra cifra. L'unico rimedio era
-- riscrivere a mano il "pattuito a notte" su ogni prenotazione, e nessuno
-- sapeva più perché quel numero fosse diverso dal listino.
--
-- La forma è la stessa già usata per i punti master: una regola base più
-- dei periodi speciali che, nelle loro date, la sostituiscono. Un periodo
-- può esistere senza prezzi (creato e non ancora compilato) e in quel caso
-- non sostituisce niente.
create table if not exists public.hotel_periodi_speciali (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel (id) on delete cascade,
  nome text,
  data_inizio date,
  data_fine date,
  creato_il timestamptz not null default now()
);

create index if not exists hotel_periodi_speciali_hotel_idx
  on public.hotel_periodi_speciali (hotel_id, data_inizio);

-- periodo_id nullo = listino base dell'hotel. Una riga per tipo di stanza,
-- il vincolo unico impedisce che ne nascano due per lo stesso tipo.
create table if not exists public.hotel_prezzi (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel (id) on delete cascade,
  periodo_id uuid references public.hotel_periodi_speciali (id) on delete cascade,
  tipo_stanza text not null check (tipo_stanza in ('singola', 'doppia', 'tripla')),
  prezzo_cash numeric,
  prezzo_fattura numeric,
  aggiornato_il timestamptz not null default now()
);

create unique index if not exists hotel_prezzi_unico
  on public.hotel_prezzi (hotel_id, coalesce(periodo_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo_stanza);

-- Sulla prenotazione: quale stanza e da quando.
alter table public.corsi_date_docenti
  add column if not exists tipo_stanza text,
  add column if not exists data_check_in date;

alter table public.corsi_date
  add column if not exists tipo_stanza text,
  add column if not exists data_check_in date;

alter table public.hotel_periodi_speciali enable row level security;
alter table public.hotel_prezzi enable row level security;

drop policy if exists "accesso interno hotel_periodi_speciali" on public.hotel_periodi_speciali;
create policy "accesso interno hotel_periodi_speciali"
  on public.hotel_periodi_speciali for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "accesso interno hotel_prezzi" on public.hotel_prezzi;
create policy "accesso interno hotel_prezzi"
  on public.hotel_prezzi for all to anon, authenticated
  using (true) with check (true);

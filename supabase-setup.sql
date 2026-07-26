-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Setup database Supabase
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

-- Corsi (nome, colore univoco per il calendario, posti massimi di default)
create table public.corsi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  colore text not null unique,
  posti_max int not null default 10,
  ts timestamptz not null default now()
);

-- Location (città in cui si tengono i corsi)
create table public.location (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ts timestamptz not null default now()
);

-- Date dei corsi: un corso può avere più edizioni in città e giorni diversi
create table public.corsi_date (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  location_id uuid not null references public.location(id) on delete cascade,
  data date not null,
  posti_max int,
  ts timestamptz not null default now()
);

-- Iscritti a una specifica edizione (data) di un corso
create table public.iscritti (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  nome text not null,
  cognome text not null,
  note text,
  ts timestamptz not null default now()
);

-- Sicurezza: questa è un'app ad uso interno (staff), protetta da un
-- codice d'accesso lato app. Le policy sotto permettono lettura e
-- scrittura a chiunque abbia la chiave "anon" del progetto: NON
-- esporre questa chiave pubblicamente al di fuori dell'app.
alter table public.corsi enable row level security;
alter table public.location enable row level security;
alter table public.corsi_date enable row level security;
alter table public.iscritti enable row level security;

create policy "accesso interno corsi" on public.corsi for all to anon using (true) with check (true);
create policy "accesso interno location" on public.location for all to anon using (true) with check (true);
create policy "accesso interno corsi_date" on public.corsi_date for all to anon using (true) with check (true);
create policy "accesso interno iscritti" on public.iscritti for all to anon using (true) with check (true);

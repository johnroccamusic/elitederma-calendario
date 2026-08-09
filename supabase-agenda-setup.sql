-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Agenda (tasto home "Agenda")
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Ogni agenda creata dal Programmatore: il nome compare anche come
-- colonna-checkbox in Gestione utenti/Password Master ("agenda_<id>" tra
-- i permessi). Chi ha una sola agenda tra i suoi permessi la trova già
-- aperta cliccando "Agenda" in home, senza scegliere nulla; chi ne ha più
-- di una vede un elenco di tasti tra cui scegliere.
create table if not exists public.agende (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.agende enable row level security;
drop policy if exists "agende_all" on public.agende;
create policy "agende_all" on public.agende for all to anon using (true) with check (true);

-- Voci (appuntamenti) di ciascuna agenda: data, titolo, nota libera.
create table if not exists public.agenda_voci (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agende(id) on delete cascade,
  data date,
  titolo text not null,
  nota text,
  ts timestamptz not null default now()
);
alter table public.agenda_voci enable row level security;
drop policy if exists "agenda_voci_all" on public.agenda_voci;
create policy "agenda_voci_all" on public.agenda_voci for all to anon using (true) with check (true);

-- Anche una master può avere una o più agende abbinate (stesso schema di
-- assegnazione degli utenti nominali in Gestione utenti/Password Master).
alter table public.master add column if not exists permessi jsonb not null default '[]';

notify pgrst, 'reload schema';

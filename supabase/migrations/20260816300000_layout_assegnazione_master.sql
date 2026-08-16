-- ---------------------------------------------------------
-- "Fissa vista su tutti i terminali" in Assegnazione Master: chi
-- programma può salvare la distribuzione delle larghezze colonna che
-- ha regolato come punto di partenza condiviso — chi apre la pagina
-- per la prima volta su un dato browser (senza ancora una propria
-- regolazione salvata in localStorage) parte da questa invece che dal
-- default hardcoded. Ogni utente può poi regolarsi liberamente, e la
-- propria regolazione resta salvata in quel browser.
--
-- "versione_colonne" è la stessa chiave di localStorage
-- (assegnazioneMaster_larghezzeColonne_vN, bumpata ogni volta che le
-- colonne cambiano di numero): se non combacia con quella attuale, la
-- vista fissata è per un set di colonne diverso e viene ignorata,
-- tornando al default hardcoded finché non viene rifissata.
-- ---------------------------------------------------------
create table if not exists public.impostazioni_layout_assegnazione_master (
  id uuid primary key default gen_random_uuid(),
  larghezze_colonne jsonb,
  versione_colonne text,
  ts timestamptz not null default now()
);
alter table public.impostazioni_layout_assegnazione_master enable row level security;
drop policy if exists "accesso interno impostazioni_layout_assegnazione_master" on public.impostazioni_layout_assegnazione_master;
create policy "accesso interno impostazioni_layout_assegnazione_master" on public.impostazioni_layout_assegnazione_master for all to anon using (true) with check (true);

insert into public.impostazioni_layout_assegnazione_master (id)
values ('00000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

notify pgrst, 'reload schema';

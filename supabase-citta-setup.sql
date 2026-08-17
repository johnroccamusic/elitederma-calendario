-- ---------------------------------------------------------
-- Elenco "Città" (Impostazioni → Location, subito dopo "Associa il
-- gruppo a una categoria di spesa"): l'unica lista da cui si sceglie la
-- città di una sede, per evitare doppioni ed errori di battitura nel
-- nome della città (es. "Milano" vs "MIlano"). Seminata subito con le
-- città già in uso in "location", così le sedi esistenti risultano già
-- associate correttamente senza bisogno di ritoccarle a mano.
-- ---------------------------------------------------------
create table if not exists public.citta (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ts timestamptz not null default now()
);
alter table public.citta enable row level security;
drop policy if exists "accesso interno citta" on public.citta;
create policy "accesso interno citta" on public.citta for all to anon using (true) with check (true);

insert into public.citta (nome)
select distinct nome from public.location
on conflict (nome) do nothing;

notify pgrst, 'reload schema';

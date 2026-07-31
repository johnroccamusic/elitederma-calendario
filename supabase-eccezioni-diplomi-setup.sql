-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Eccezioni diplomi
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Da eseguire UNA SOLA VOLTA (e' comunque scritto per essere sicuro
-- da rieseguire: se lo lanci per errore una seconda volta non succede
-- nulla di male).
-- =========================================================

-- diplomi alternativi caricati una volta per tutte in "Setting diplomi",
-- poi assegnabili al singolo iscritto (da Contabilita' classe) al posto
-- del template normale del corso
create table if not exists public.diploma_eccezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  file_path text not null,
  ts timestamptz not null default now()
);
alter table public.diploma_eccezioni enable row level security;
drop policy if exists "accesso interno diploma_eccezioni" on public.diploma_eccezioni;
create policy "accesso interno diploma_eccezioni" on public.diploma_eccezioni for all to anon using (true) with check (true);

-- su ogni iscritto: quale eccezione usare (se nessuna, resta il
-- template normale del corso) e quale data mostrare al posto di quella
-- del corso (se vuota, resta quella del corso)
alter table public.iscritti add column if not exists diploma_eccezione_id uuid references public.diploma_eccezioni(id) on delete set null;
alter table public.iscritti add column if not exists diploma_eccezione_data date;

notify pgrst, 'reload schema';

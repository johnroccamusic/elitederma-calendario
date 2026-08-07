-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Venditori" (tutor)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- elenco gestibile dei venditori/tutor, selezionabile in fase di
-- iscrizione invece di scrivere il nome a mano
create table if not exists public.venditori (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.venditori enable row level security;
drop policy if exists "accesso interno venditori" on public.venditori;
create policy "accesso interno venditori" on public.venditori for all to anon using (true) with check (true);

notify pgrst, 'reload schema';

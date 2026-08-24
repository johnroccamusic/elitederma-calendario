-- storico_allievi era stata creata con policy "to authenticated" seguendo
-- CLAUDE.md, ma il resto del database è stato riportato su "to anon" da
-- 20260815120001_rollback_rls_anon.sql (il fix "to authenticated" rendeva
-- l'app inutilizzabile: non esiste ancora una sessione Supabase Auth reale,
-- src/Accesso.jsx non è collegato in src/main.jsx). Restare l'unica tabella
-- su "authenticated" la rendeva vuota lato app. Allineata al resto.
drop policy if exists "storico_allievi_staff" on public.storico_allievi;

create policy "storico_allievi_staff" on public.storico_allievi
  for all to anon using (true) with check (true);

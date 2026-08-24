-- La nuova pipeline fic-sync (20260824090000_fic_sync.sql) ha lasciato
-- fic_documenti con RLS attiva e nessuna policy, corretto per
-- fic_connessioni (contiene i token OAuth) ma troppo restrittivo per
-- fic_documenti: non contiene segreti, ed è la tabella che la sezione
-- "Note di credito" di Contabilità deve leggere dal client.
--
-- Solo SELECT per anon (l'app non ha login Supabase Auth reale, vedi
-- CLAUDE.md §4 e le altre tabelle del progetto): scrivere resta compito
-- esclusivo della edge function fic-sync, con la service role key.
-- fic_connessioni, fic_documenti_pending e fic_sync_log restano senza
-- alcuna policy, come da istruzioni originali.

create policy "fic_documenti_select_anon" on fic_documenti
  for select
  to anon
  using (true);

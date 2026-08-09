-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Tipo di offerta (scheda iscrizione)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Campo libero accanto a "Pacchetto/Kit" nella scheda di iscrizione.
alter table public.iscritti add column if not exists tipo_offerta text;

notify pgrst, 'reload schema';

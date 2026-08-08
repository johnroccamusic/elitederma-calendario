-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Cellulare venditori (integrazione WhatsApp)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

alter table public.venditori add column if not exists telefono text;

notify pgrst, 'reload schema';

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Categoria" sui corsi-tipo
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- etichetta libera (es. "PMU", "Microblading", "Extension") mostrata
-- sulla card del corso in "Definisci corsi"
alter table public.corsi add column if not exists categoria text;

notify pgrst, 'reload schema';

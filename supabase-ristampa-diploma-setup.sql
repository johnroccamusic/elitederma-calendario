-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Ristampa solo questo" (diplomi)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- se flaggato su uno o piu' iscritti di una classe, "Stampa diplomi"
-- genera il PDF solo per loro invece che per tutta la classe
alter table public.iscritti add column if not exists ristampa_diploma boolean not null default false;

notify pgrst, 'reload schema';

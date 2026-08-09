-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Dashboard master (Password Master)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Password di ciascuna master (Password menù > Password Master): a
-- differenza dei venditori, la master non sceglie il proprio nome da una
-- tendina — la sua password stessa la identifica, e cliccando
-- "Dashboard master" trova già aperta la propria scheda.
alter table public.master add column if not exists password text;

notify pgrst, 'reload schema';

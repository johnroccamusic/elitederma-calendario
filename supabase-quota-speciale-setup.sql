-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Aggiunta "quota speciale" iscritto
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

alter table public.iscritti add column if not exists quota_speciale numeric;

notify pgrst, 'reload schema';

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Residenza allievo (dal modulo di iscrizione)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Città, indirizzo e CAP di residenza letti dalla pagina 6 del modulo di
-- iscrizione (PDF). Usati dal CRM/Allievi per mostrare "Città di res." e per
-- calcolare la "Regione di res." dalla città. Il modulo può non contenerli
-- (allievi vecchi): restano NULL finché non si rilegge il PDF.
alter table public.iscritti add column if not exists citta_residenza text;
alter table public.iscritti add column if not exists indirizzo_residenza text;
alter table public.iscritti add column if not exists cap_residenza text;
alter table public.iscritti add column if not exists email text;

notify pgrst, 'reload schema';

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Diploma gia' firmato" per master
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- se attivo, la stampa diplomi lascia vuoto il campo firma per quella
-- master (firmera' a mano), invece di applicare la firma automatica
alter table public.master add column if not exists diploma_gia_firmato boolean not null default false;

notify pgrst, 'reload schema';

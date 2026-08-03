-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Viaggio ass." in Assegnazione Master
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- affianca "viaggio_prenotato"/"viaggio_file" (ora "Viaggio master") con
-- un secondo set di campi per il viaggio dell'assistente
alter table public.corsi_date add column if not exists viaggio_assistente_prenotato boolean not null default false;
alter table public.corsi_date add column if not exists viaggio_assistente_file text[];

notify pgrst, 'reload schema';

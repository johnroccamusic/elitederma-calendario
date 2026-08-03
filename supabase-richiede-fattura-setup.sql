-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Richiede fattura"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- se flaggato nella scheda iscritto, mostra i campi per i dati di
-- fatturazione (ditta, indirizzo, città, P.IVA, codice destinatario, PEC),
-- visualizzati poi in Contabilità classe
alter table public.iscritti add column if not exists richiede_fattura boolean not null default false;
alter table public.iscritti add column if not exists fattura_ditta text;
alter table public.iscritti add column if not exists fattura_indirizzo text;
alter table public.iscritti add column if not exists fattura_civico text;
alter table public.iscritti add column if not exists fattura_citta text;
alter table public.iscritti add column if not exists fattura_prov text;
alter table public.iscritti add column if not exists fattura_cap text;
alter table public.iscritti add column if not exists fattura_piva text;
alter table public.iscritti add column if not exists fattura_cod_dest text;
alter table public.iscritti add column if not exists fattura_pec text;

notify pgrst, 'reload schema';

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Riepilogo amministrativo" (costi classe)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- costi fissi della classe, impostabili dall'amministratore nel pannello
-- "Riepilogo amministrativo" dentro Contabilità classe; sottratti dal
-- totale incassato (contanti + pos) per ottenere il "Risultato classe"
alter table public.corsi_date add column if not exists costo_accademia numeric;
alter table public.corsi_date add column if not exists costo_master numeric;
alter table public.corsi_date add column if not exists costo_assistenti numeric;
alter table public.corsi_date add column if not exists costo_pranzi numeric;
alter table public.corsi_date add column if not exists costo_hotel numeric;

-- voci di costo aggiuntive create liberamente con il tasto "+" (titolo + importo)
alter table public.corsi_date add column if not exists costi_extra jsonb not null default '[]';

notify pgrst, 'reload schema';

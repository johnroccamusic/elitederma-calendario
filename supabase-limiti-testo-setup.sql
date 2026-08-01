-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Linee di limite testo (diploma + segnaposti)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- diploma: due linee (sinistra/destra) che limitano solo la larghezza
-- del nome allievo, non citta'/data ne' firma
alter table public.font_diplomi add column if not exists nome_limite_sx numeric not null default 20;
alter table public.font_diplomi add column if not exists nome_limite_dx numeric not null default 80;

-- segnaposti: due linee (sinistra/destra), uguali per tutti i 7 posti,
-- al posto della vecchia singola linea "limite_pos_x" (che resta nella
-- tabella ma non viene piu' usata)
alter table public.segnaposti_config add column if not exists limite_sx_pos_x numeric not null default 30;
alter table public.segnaposti_config add column if not exists limite_dx_pos_x numeric not null default 70;

notify pgrst, 'reload schema';

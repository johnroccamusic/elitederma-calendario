-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Vecchia iscrizione"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- se flaggato, l'iscrizione (inserita ora ma relativa a un corso già
-- passato) non conta nelle statistiche/iscrizioni "di oggi": finisce
-- nell'elenco a parte "Mesi precedenti" in Statistiche > Ultime iscrizioni
alter table public.iscritti add column if not exists vecchia_iscrizione boolean not null default false;

notify pgrst, 'reload schema';

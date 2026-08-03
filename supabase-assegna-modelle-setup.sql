-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Assegna modelle"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- un elemento per ogni modella richiesta: { tipo, mattina, pomeriggio }.
-- "tipo" si sceglie nella scheda iscritto (Microblading, Labbra, ecc.),
-- "mattina"/"pomeriggio" si flaggano da Contabilità classe > Assegna modelle
alter table public.iscritti add column if not exists tipi_modelle jsonb not null default '[]';

notify pgrst, 'reload schema';

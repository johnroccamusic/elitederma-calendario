-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Ristrutturazione categorie "Costi operativi"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- La categoria "Logistica" (ora "Corrieri e spedizioni") perde la
-- sotto-voce "Lavori edili", spostata sotto la nuova categoria "Spese
-- Accademia centrale" > "Lavori": le eventuali voci già inserite con la
-- vecchia categoria/sotto-voce vengono spostate sulla nuova, così
-- restano visibili nel posto giusto invece di sparire dal totale
update public.costi_operativi_voci
set categoria = 'accademia_centrale', sottovoce = 'lavori'
where categoria = 'logistica' and sottovoce = 'lavori_edili';

notify pgrst, 'reload schema';

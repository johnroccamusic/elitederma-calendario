-- ---------------------------------------------------------
-- Ripristina categoria_spesa_id su location: era stata aggiunta il
-- 16/08, poi tolta lo stesso giorno quando la categoria di spesa era
-- diventata una sola impostazione condivisa (categorie_gruppi). Da
-- quando ogni sede ha di nuovo la propria categoria (vedi
-- calcolaVociScadenziario in App.jsx), il codice si aspetta questa
-- colonna ma nessuna migrazione l'aveva mai ricreata sul database —
-- per questo "Salva" su una sede falliva in silenzio.
-- ---------------------------------------------------------
alter table public.location add column if not exists categoria_spesa_id text references public.costi_sottocategorie(id) on delete set null;

notify pgrst, 'reload schema';

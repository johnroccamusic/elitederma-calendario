-- ---------------------------------------------------------
-- Anagrafiche: categoria/sottocategoria di default sul fornitore.
-- Quando si registra una spesa e si sceglie il fornitore, categoria e
-- sottocategoria si propongono da qui — restano comunque modificabili
-- a mano sulla singola spesa se il prodotto/servizio di quella fattura
-- è di un'altra categoria (la spesa non viene mai bloccata su questo).
--
-- Stesse FK con ON DELETE SET NULL già in uso su spese.categoria_id/
-- sottocategoria_id, per coerenza. Additivo puro, nessuna riga toccata.
-- ---------------------------------------------------------

alter table public.fornitori
  add column if not exists categoria_id text references public.costi_categorie(id) on delete set null,
  add column if not exists sottocategoria_id text references public.costi_sottocategorie(id) on delete set null;

notify pgrst, 'reload schema';

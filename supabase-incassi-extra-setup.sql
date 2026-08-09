-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Altri incassi al corso (Riepilogo amministrativo)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- Prodotti venduti in più durante il corso (oltre alle quote di
-- iscrizione), scelti dal magazzino: {prodotto_id, quantita, valore, metodo}.
alter table public.corsi_date add column if not exists incassi_extra jsonb not null default '[]';

notify pgrst, 'reload schema';

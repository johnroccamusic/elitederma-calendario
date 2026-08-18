-- ---------------------------------------------------------
-- Riconciliazione fatture (spec §7.4 "Scarta — con motivazione
-- obbligatoria"): documento_fornitore non aveva un campo dove
-- registrare il motivo. Additivo puro, nullable.
-- ---------------------------------------------------------

alter table public.documento_fornitore add column if not exists note text;

notify pgrst, 'reload schema';

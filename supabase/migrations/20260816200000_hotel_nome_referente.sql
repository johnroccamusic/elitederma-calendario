-- ---------------------------------------------------------
-- Gestione Hotel: il campo "Nome" nel form era ridondante col titolo
-- della scheda (già il nome dell'hotel) — sostituito da "Persona di
-- riferimento" (referente da contattare per quell'hotel).
-- ---------------------------------------------------------
alter table public.hotel add column if not exists nome_referente text;

notify pgrst, 'reload schema';

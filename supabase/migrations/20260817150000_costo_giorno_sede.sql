-- ---------------------------------------------------------
-- "Gestisci sede" in Assegnazione Master: costo a giorno per quella
-- specifica edizione, Cash e Bonifico, precompilato dalle condizioni
-- generali della location (Impostazioni → Location) ma modificabile per
-- singolo corso — stesso meccanismo già usato per "Gestisci alloggio".
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists costo_giorno_sede_cash numeric;
alter table public.corsi_date add column if not exists costo_giorno_sede_bonifico numeric;

notify pgrst, 'reload schema';

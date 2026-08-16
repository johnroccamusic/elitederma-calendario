-- ---------------------------------------------------------
-- Riepilogo amministrativo: "Quota venditore" diventa una riga della
-- tabella spese come le altre (Compenso Master, Costo location, Quota
-- assistenti), con lo stesso split libero Bonifico/Cash.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists quota_venditore_bonifico numeric;
alter table public.corsi_date add column if not exists quota_venditore_cash numeric;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Gestione Hotel: percentuale IVA da scorporare dal "Costo a notte —
-- Fattura" (0/4/10/22%).
-- ---------------------------------------------------------
alter table public.hotel add column if not exists iva_percentuale_notte_fattura numeric;

notify pgrst, 'reload schema';

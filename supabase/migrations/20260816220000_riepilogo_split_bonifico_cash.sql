-- ---------------------------------------------------------
-- Riepilogo amministrativo: split libero Bonifico/Cash per ogni voce
-- (compenso master, costo location), non più un flag/tendina
-- tutto-o-niente in Assegnazione Master. Le colonne superate vengono
-- tolte: lo split ora si imposta solo nel Riepilogo, non in due posti.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists quota_bonifico numeric;
alter table public.corsi_date add column if not exists quota_cash numeric;
alter table public.corsi_date_docenti add column if not exists quota_bonifico numeric;
alter table public.corsi_date_docenti add column if not exists quota_cash numeric;

alter table public.corsi_date add column if not exists location_bonifico numeric;
alter table public.corsi_date add column if not exists location_cash numeric;

alter table public.corsi_date drop column if exists paga_cash;
alter table public.corsi_date drop column if exists tipo_pagamento_location;
alter table public.corsi_date_docenti drop column if exists paga_cash;

notify pgrst, 'reload schema';

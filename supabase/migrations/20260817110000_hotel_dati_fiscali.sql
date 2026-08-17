-- ---------------------------------------------------------
-- Dati fiscali sulla scheda hotel (Gestione Hotel), subito dopo Città
-- ---------------------------------------------------------
alter table public.hotel add column if not exists partita_iva text;
alter table public.hotel add column if not exists codice_destinatario text;
alter table public.hotel add column if not exists pec text;
alter table public.hotel add column if not exists iban text;

notify pgrst, 'reload schema';

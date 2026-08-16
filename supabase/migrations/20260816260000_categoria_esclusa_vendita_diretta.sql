-- ---------------------------------------------------------
-- Gestione categorie prodotti: una categoria può essere esclusa dalla
-- vendita diretta (POS/online) — i suoi prodotti restano nel
-- magazzino/nella gestione shop ma non compaiono più tra quelli
-- vendibili al banco.
-- ---------------------------------------------------------
alter table public.categorie_prodotti add column if not exists escludi_vendita_diretta boolean not null default false;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- POS Vendita diretta: le vendite al banco finiscono nella stessa
-- tabella "vendite_shop" già usata dagli ordini WooCommerce, così
-- compaiono automaticamente nei totali di "Vendite shop" e "Analisi
-- Magazzino" insieme alle vendite online — nessuna tabella nuova,
-- nessuna modifica alle pagine che già le leggono.
--
-- woo_order_id diventa nullable (una vendita POS non ha un ordine
-- WooCommerce); "origine" distingue le due provenienze; metodo_pagamento
-- e note sono propri della vendita al banco.
-- ---------------------------------------------------------
alter table public.vendite_shop alter column woo_order_id drop not null;
alter table public.vendite_shop add column if not exists origine text not null default 'woocommerce';
alter table public.vendite_shop add column if not exists metodo_pagamento text;
alter table public.vendite_shop add column if not exists note text;

notify pgrst, 'reload schema';

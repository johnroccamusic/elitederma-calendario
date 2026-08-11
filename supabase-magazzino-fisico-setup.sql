-- ---------------------------------------------------------
-- "Gestione magazzino" diventa gestione TOTALE del magazzino fisico, non
-- più solo dello shop online: ogni prodotto ha ora due giacenze separate,
-- "in magazzino" (fisica, in sede, mai toccata da WooCommerce) e "shop
-- online" (giacenza esistente, resta sincronizzata su WooCommerce come
-- prima). Lo stock totale è la somma delle due.
--
-- woo_product_id diventa nullable: un prodotto può ora esistere SOLO
-- localmente (materiali di consumo, arredi, altro che non va venduto
-- online, magari senza nemmeno un prezzo) — woo-sync-catalogo non lo
-- tocca mai (il filtro "woo_product_id not in (...)" della
-- disattivazione automatica ignora le righe con woo_product_id nullo,
-- come da semantica SQL standard di NOT IN con NULL).
-- ---------------------------------------------------------
alter table public.prodotti_shop alter column woo_product_id drop not null;
alter table public.prodotti_shop add column if not exists giacenza_magazzino integer not null default 0;

notify pgrst, 'reload schema';

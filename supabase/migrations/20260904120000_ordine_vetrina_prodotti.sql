-- ---------------------------------------------------------
-- L'ordine con cui i prodotti compaiono dentro una categoria dello shop.
--
-- WooCommerce lo tiene nel campo "menu_order" di ogni prodotto, e lo usa
-- quando il negozio e' impostato su "ordinamento personalizzato". L'app
-- non l'ha mai ne' letto ne' scritto: ogni prodotto creato da qui nasceva
-- con menu_order 0, tutti pari, e il sito ripiegava sull'ordine
-- alfabetico del titolo. Da qui la colonna che lo rispecchia.
--
-- E' UNA posizione per prodotto, non una per categoria: e' cosi' che
-- funziona WooCommerce, e un prodotto che compare in piu' categorie ha la
-- stessa posizione in tutte. Al 04/09/2026 sono 33 prodotti su 158.
--
-- Si riempie da woo-sync-catalogo (che rilegge menu_order dal sito) e si
-- riscrive da woo-ordina-prodotti, che rimanda l'ordine nuovo a Woo.
-- ---------------------------------------------------------

alter table prodotti_shop add column if not exists ordine_vetrina integer;

comment on column prodotti_shop.ordine_vetrina is
  'Posizione del prodotto dentro la categoria sullo shop: rispecchia menu_order di WooCommerce. Vale in tutte le categorie in cui il prodotto compare.';

notify pgrst, 'reload schema';

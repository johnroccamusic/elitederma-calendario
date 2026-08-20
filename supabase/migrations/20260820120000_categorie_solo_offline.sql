-- Sezione 133: categorie prodotto "solo offline" (mai su WooCommerce)
-- ---------------------------------------------------------
-- Una categoria locale (creata da Gestisci categorie in Gestione
-- magazzino, mai sincronizzata con Woo) può ora essere marcata "solo
-- offline": i prodotti creati in quella categoria restano sempre e
-- solo nel magazzino fisico, anche se hanno un prezzo di vendita —
-- prima un prezzo mandava sempre il prodotto su WooCommerce, a
-- prescindere dalla categoria scelta. Additiva pura.

alter table public.categorie_prodotti
  add column if not exists solo_offline boolean not null default false;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Le vendite online non trovavano più il prodotto da scaricare.
--
-- Fino ad oggi il webhook riconosceva il prodotto venduto SOLO dal nome
-- della riga d'ordine. Ma il nome è la cosa più fragile che ci sia:
--   - sul sito cambia senza che l'app lo sappia ("Ago 1RLMT - 0,30" qui,
--     "Ago 1RL MT - 0,30" in anagrafica);
--   - per le taglie WooCommerce manda il nome della VARIAZIONE
--     ("T-Shirt EliteDerma - XXL"), che non è il nome del prodotto in
--     anagrafica ("T-Shirt Elitederma Tg. XXL").
-- Quando il nome non corrispondeva, lo scarico non avveniva — in
-- silenzio. Al 28/08/2026: 323 righe d'ordine su 1.482 degli ultimi sei
-- mesi, distribuite su 208 ordini.
--
-- Questa colonna è il collegamento che mancava per le varianti: l'id
-- della variazione WooCommerce (le taglie di un prodotto variabile), che
-- non è un id prodotto e quindi non poteva stare in woo_product_id.
-- Da riempire una volta per ogni taglia; il webhook la usa per prima,
-- prima di SKU, codice prodotto e nome.
-- ---------------------------------------------------------

alter table public.prodotti_shop add column if not exists woo_variation_id integer;

create unique index if not exists idx_prodotti_shop_woo_variation_id
  on public.prodotti_shop(woo_variation_id) where woo_variation_id is not null;

comment on column public.prodotti_shop.woo_variation_id is
  'Id della variazione WooCommerce (taglia/colore dentro un prodotto variabile). Serve al webhook per scaricare il magazzino sulla riga giusta.';

notify pgrst, 'reload schema';

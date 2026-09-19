-- "Sfuso": il pezzo singolo che nasce aprendo una confezione e finisce
-- dentro un kit. Vive come un componente — giacenza propria, non si vende
-- da solo — ma tenerlo distinto dice quali pezzi esistono soltanto perche'
-- qualcuno ha rotto un pacco.
--
-- Il vincolo elencava i cinque valori storici, quindi la voce nuova si
-- vedeva nella tendina e poi il salvataggio veniva rifiutato dal database.
alter table public.prodotti_shop
  drop constraint if exists prodotti_shop_tipo_prodotto_check;

alter table public.prodotti_shop
  add constraint prodotti_shop_tipo_prodotto_check
  check (tipo_prodotto = any (array['semplice','bundle','componente','sfuso','vetrina','variante']));

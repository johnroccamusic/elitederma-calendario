-- Aggiunge "vetrina" all'enum tipo_prodotto: il prodotto padre mostrato
-- sullo shop online che non si vende né si conta mai da solo, perché
-- vendita e giacenza stanno sulle sue varianti (es. taglie). Nessuna nuova
-- colonna: riusa conta_incassi/conta_magazzino/giacenza_propria/prezzo_vendita
-- già esistenti (vedi 20260826150000_natura_prodotti_bundle.sql).
alter table prodotti_shop drop constraint prodotti_shop_tipo_prodotto_check;
alter table prodotti_shop add constraint prodotti_shop_tipo_prodotto_check
  check (tipo_prodotto = any (array['semplice', 'bundle', 'componente', 'vetrina', 'variante']));

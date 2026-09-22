-- Back order: un prodotto puo' restare ordinabile anche a scorte zero.
--
-- Fino a oggi zero pezzi voleva dire zero vendite, sul POS e sullo shop.
-- Per la merce che il fornitore rimanda in pochi giorni e' una perdita
-- secca: il cliente c'e', il pezzo arriva, e l'ordine non si prende.
--
-- Il messaggio prende il posto della disponibilita' quando i pezzi sono
-- zero: il cliente non deve leggere "0 pezzi" e poi un invito a ordinare.
-- Vuoto vuol dire "usa il testo predefinito", che sta nell'app: cosi' se
-- un giorno i giorni lavorativi diventano tre, si cambia in un punto solo
-- e non su duecento righe.
alter table prodotti_shop
  add column if not exists backorder_attivo boolean not null default false,
  add column if not exists backorder_messaggio text;

comment on column prodotti_shop.backorder_attivo is
  'Il prodotto resta ordinabile (POS e WooCommerce) anche con giacenza zero.';
comment on column prodotti_shop.backorder_messaggio is
  'Testo mostrato al posto della disponibilita'' quando i pezzi sono zero. Vuoto = testo predefinito dell''app.';

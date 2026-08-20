-- Unità di misura (pz, conf., ml…) per prodotto: libera, mostrata nella
-- nuova tabella "Consumabili" di Magazzini esterni e modificabile da
-- Gestione magazzino (Dettaglio prodotti).

alter table prodotti_shop
  add column if not exists unita_misura text;

-- La percentuale che si lascia a un negoziante quando compra per
-- rivendere. Si scrive a mano riga per riga in Dettaglio prodotti, e si
-- scala dal residuo cedibile: quel che resta e' lo spazio del venditore.
--
-- Vuota (null) = a quel prodotto non si lascia niente, e il residuo
-- resta tutto al venditore. Zero e' un'altra cosa: e' una scelta
-- esplicita di non lasciare nulla. Le due si distinguono a vista nella
-- cella, che resta vuota nel primo caso.
alter table prodotti_shop
  add column if not exists quota_negoziante_pct numeric;

comment on column prodotti_shop.quota_negoziante_pct is
  'Percentuale del prezzo netto lasciata al negoziante che rivende. Si scala dal residuo cedibile; quel che resta e'' del venditore.';

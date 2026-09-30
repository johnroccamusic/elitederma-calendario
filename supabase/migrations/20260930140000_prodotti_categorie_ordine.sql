-- Quale categoria e' la PRINCIPALE di un prodotto.
--
-- Finora non si salvava: la tabella aveva solo prodotto e categoria, e
-- l'app indovinava — "la prima che sia una sottocategoria, altrimenti la
-- prima dell'elenco". Ma l'elenco arrivava da un select senza ordine,
-- che il database puo' restituire come gli pare. Cosi' scegliendo una
-- principale e una secondaria le due si scambiavano da sole.
--
-- Con questa colonna la principale e' semplicemente quella con ordine 0:
-- una decisione scritta, non dedotta.
alter table prodotti_categorie
  add column if not exists ordine smallint not null default 0;

comment on column prodotti_categorie.ordine is
  'Posizione scelta: 0 = categoria principale. Prima non esisteva e la principale veniva indovinata, con l''effetto di vedersela scambiare con la secondaria.';

create index if not exists prodotti_categorie_ordine
  on prodotti_categorie (prodotto_id, ordine);

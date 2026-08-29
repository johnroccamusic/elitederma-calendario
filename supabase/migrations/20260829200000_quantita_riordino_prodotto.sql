-- ---------------------------------------------------------
-- Quanti pezzi si ordinano di solito, per prodotto.
--
-- Il lotto minimo d'ordine dice qual è la quantità sotto la quale il
-- fornitore non scende: è un vincolo suo. Quella che serve per preparare
-- una bozza d'ordine è un'altra cosa — quanti pezzi si prendono di
-- abitudine quando si riordina quel prodotto — e non coincide quasi mai
-- con il minimo.
--
-- Resta vuota finché non la si compila: l'Advisor, quando proporrà gli
-- ordini, userà questa se c'è, altrimenti il fabbisogno calcolato.
-- ---------------------------------------------------------

alter table public.prodotti_shop
  add column if not exists quantita_riordino integer;

comment on column public.prodotti_shop.quantita_riordino is
  'Pezzi che si ordinano di solito quando si riordina questo prodotto. Diverso da lotto_minimo_ordine, che è il minimo imposto dal fornitore.';

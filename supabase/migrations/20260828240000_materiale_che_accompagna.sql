-- ---------------------------------------------------------
-- Prodotti che si portano dietro del materiale.
--
-- Il Dermografo Tekna era registrato come "bundle", ma un bundle è un
-- insieme che NON esiste per conto suo: si vende come pezzo unico e la
-- sua disponibilità si calcola dai componenti. Il dermografo invece è un
-- oggetto vero, con i suoi pezzi in magazzino, che quando esce porta con
-- sé il manuale. Sono due cose diverse, e chiamarle allo stesso modo
-- faceva sì che lo scarico togliesse un manuale invece di un dermografo.
--
-- Da qui la distinzione: il prodotto ha la SUA giacenza (giacenza_propria)
-- e la distinta base elenca ciò che lo ACCOMPAGNA, non ciò di cui è fatto.
-- Il flag serve perché la sola presenza di una distinta non basta a
-- distinguere i due casi: "Anellino porta ink 1 Pz" ha in distinta "Box
-- Anellini 30 Pz" con quantità 30 — una riga rovesciata che, applicata in
-- automatico, toglierebbe 30 box a ogni anellino venduto.
-- ---------------------------------------------------------

alter table public.prodotti_shop
  add column if not exists componenti_accompagnano boolean not null default false;

comment on column public.prodotti_shop.componenti_accompagnano is
  'Il prodotto ha una giacenza sua e la distinta elenca il materiale che esce INSIEME a lui (es. il manuale del dermografo), non i pezzi di cui è composto.';

-- il Dermografo Tekna torna a essere quello che è: un prodotto con i suoi
-- pezzi, accompagnato dal manuale
update public.prodotti_shop
   set tipo_prodotto = 'semplice',
       componenti_accompagnano = true,
       giacenza_propria = true,
       conta_magazzino = true,
       bundle_con_giacenza_fisica = false
 where nome ilike 'dermografo tekna%';

notify pgrst, 'reload schema';

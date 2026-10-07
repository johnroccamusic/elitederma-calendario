-- L'ordine della vetrina diventa di ogni COPPIA prodotto-categoria.
--
-- Finora stava su prodotti_shop: un numero solo per prodotto. Ma su 195
-- prodotti online 95 stanno in piu' di una categoria, quindi riordinare
-- Laminazione spostava gli stessi prodotti anche dentro HENNE, e
-- riordinare HENNE rimandava all'aria Laminazione. Non era un difetto di
-- una categoria: era di tutte, e si notava solo dove le sovrapposizioni
-- sono tante.
--
-- La colonna vecchia resta dov'e'. La legge ancora la pagina generica
-- dello shop, che una categoria non ce l'ha, e serve da rete se un
-- prodotto non ha ancora una posizione sua qui dentro.
alter table prodotti_categorie
  add column if not exists ordine_vetrina integer;

comment on column prodotti_categorie.ordine_vetrina is
  'Posizione del prodotto DENTRO questa categoria sulla vetrina. Vuoto = non ancora deciso: vale prodotti_shop.ordine_vetrina.';

-- Si parte da quello che c'e' oggi, cosi' il primo giorno nessuna
-- vetrina cambia aspetto: da domani ogni categoria va per conto suo.
update prodotti_categorie pc
set ordine_vetrina = p.ordine_vetrina
from prodotti_shop p
where p.id = pc.prodotto_id
  and pc.ordine_vetrina is null
  and p.ordine_vetrina is not null;

-- Leggere "i prodotti di questa categoria, nel loro ordine" e' la query
-- piu' frequente della pagina: senza indice sono 401 righe scandite ogni
-- volta che si cambia categoria.
create index if not exists prodotti_categorie_vetrina_idx
  on prodotti_categorie (categoria_id, ordine_vetrina);

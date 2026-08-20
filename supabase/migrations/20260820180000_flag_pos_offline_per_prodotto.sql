-- "Non sul POS" e "Solo offline" passano dalla categoria al singolo
-- prodotto: prima un prodotto ereditava questi flag da TUTTE le categorie
-- a cui apparteneva, ora ogni prodotto ha i suoi due flag indipendenti,
-- impostabili da "Gestione magazzino" (tabella Dettaglio prodotti).
--
-- Backfill: un prodotto che oggi è in una categoria con uno dei due flag
-- attivi eredita quel flag prima che la colonna sparisca dalla categoria
-- (verificato: 3 prodotti coinvolti — Lettino, Dischetti struccanti
-- cotone, Olio Johnson/Olio Minerale — tutti e due i flag).

alter table prodotti_shop
  add column if not exists escludi_vendita_diretta boolean not null default false,
  add column if not exists solo_offline boolean not null default false;

update prodotti_shop ps
set escludi_vendita_diretta = true
where exists (
  select 1 from prodotti_categorie pc
  join categorie_prodotti cp on cp.id = pc.categoria_id
  where pc.prodotto_id = ps.id and cp.escludi_vendita_diretta = true
);

update prodotti_shop ps
set solo_offline = true
where exists (
  select 1 from prodotti_categorie pc
  join categorie_prodotti cp on cp.id = pc.categoria_id
  where pc.prodotto_id = ps.id and cp.solo_offline = true
);

alter table categorie_prodotti drop column if exists escludi_vendita_diretta;
alter table categorie_prodotti drop column if exists solo_offline;

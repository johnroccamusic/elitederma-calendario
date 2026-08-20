-- Ripensamento rispetto alla migrazione precedente (20260820180000): i
-- due flag NON si spostano dalla categoria al prodotto, restano su
-- ENTRAMBI i livelli. Il flag sulla categoria è un interruttore che
-- flagga automaticamente tutti i prodotti che ci appartengono (effetto a
-- cascata, letto nell'app come "OR" fra categoria e prodotto); quando la
-- categoria non ha il flag attivo, il flag del singolo prodotto (aggiunto
-- dalla migrazione precedente) resta liberamente impostabile.
--
-- Si ripristinano qui le colonne e gli stessi valori che avevano prima di
-- essere eliminate (verificati con una query subito prima del drop):
--   Allestimento Banchi         escludi_vendita_diretta=true  solo_offline=true
--   Consulenze                 escludi_vendita_diretta=false solo_offline=true
--   Postazioni Pratica/Arredi   escludi_vendita_diretta=true  solo_offline=true
--   Tavolo pratica / consumabili escludi_vendita_diretta=true solo_offline=true

alter table categorie_prodotti
  add column if not exists escludi_vendita_diretta boolean not null default false,
  add column if not exists solo_offline boolean not null default false;

update categorie_prodotti set escludi_vendita_diretta = true, solo_offline = true where nome = 'Allestimento Banchi';
update categorie_prodotti set solo_offline = true where nome = 'Consulenze';
update categorie_prodotti set escludi_vendita_diretta = true, solo_offline = true where nome = 'Postazioni Pratica/Arredi';
update categorie_prodotti set escludi_vendita_diretta = true, solo_offline = true where nome = 'Tavolo pratica / consumabili';

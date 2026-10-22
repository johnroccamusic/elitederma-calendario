-- UNA MASTER CHE VENDE E' UN FLAG SULLA MASTER, NON UNA SECONDA RIGA.
--
-- Fino a oggi una master che faceva anche il venditore stava in due
-- liste, con due password e due elenchi di permessi, e un pezzo di
-- codice ricopiava la password dall'una all'altra per tenerle uguali.
-- Dieci persone cosi'. Non si tocca nessuna di quelle righe: i
-- venditori restano venditori, e chi e' gia' in tutte e due le liste ci
-- resta finche' non si decide altrimenti.
--
-- Da oggi la strada nuova e' questa: in Gestione master si accende
-- «e' anche venditore». Da li' la master entra nell'elenco che l'app usa
-- per i venditori — tendina tutor, Dashboard venditori, commissioni —
-- con la SUA password e i SUOI permessi, senza una riga in `venditori`
-- e senza comparire in Gestione venditori.
alter table master
  add column if not exists e_venditore boolean not null default false;

comment on column master.e_venditore is
  'La master fa anche il venditore: compare fra i venditori (tutor, dashboard, commissioni) con la sua password e i suoi permessi, senza una riga in venditori.';

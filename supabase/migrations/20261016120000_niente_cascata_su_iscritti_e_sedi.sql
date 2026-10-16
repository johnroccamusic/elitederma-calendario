-- LA CANCELLAZIONE A CASCATA, TOLTA DOVE FA DANNO.
--
-- Com'era: `corsi_date.location_id` -> `location` era ON DELETE CASCADE,
-- e `iscritti.corso_data_id` -> `corsi_date` pure. Messe in fila, voleva
-- dire che cancellare UNA CITTA' dall'elenco delle sedi cancellava ogni
-- corso tenuto li' e, con ognuno, ogni allieva iscritta: acconti, saldi,
-- coupon, docenti, logistica dei kit. In un colpo, senza chiedere altro.
--
-- E senza lasciare traccia. Una cascata non produce righe orfane, quindi
-- nessun controllo d'integrita' se ne accorge: il database resta
-- perfettamente coerente su una storia da cui mancano delle persone.
--
-- La schermata chiedeva "Sei sicuro di voler cancellare questa sede?
-- Rimuove anche le date collegate a quella citta'". Le date. Non diceva
-- che si portava via gli iscritti, ne' quanti erano.
--
-- Adesso i due vincoli sono RESTRICT: il database RIFIUTA di cancellare
-- una sede che ha corsi e una classe che ha iscritti. Non e' un avviso
-- che si puo' chiudere distrattamente — e' un no, e vale anche per chi
-- scrive SQL a mano, per uno script, per un errore di programmazione.
--
-- Resta una sola strada per cancellare delle allieve, ed e' esplicita:
-- "elimina data archiviata" in App.jsx, che le cancella di suo dopo aver
-- chiesto due volte, la seconda facendo scrivere CANCELLA.
alter table public.iscritti drop constraint iscritti_corso_data_id_fkey;
alter table public.iscritti
  add constraint iscritti_corso_data_id_fkey
  foreign key (corso_data_id) references public.corsi_date(id) on delete restrict;

alter table public.corsi_date drop constraint corsi_date_location_id_fkey;
alter table public.corsi_date
  add constraint corsi_date_location_id_fkey
  foreign key (location_id) references public.location(id) on delete restrict;

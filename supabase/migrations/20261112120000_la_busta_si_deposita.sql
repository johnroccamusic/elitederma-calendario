-- LA BUSTA SI DEPOSITA IN CASSA, ED E' UN GESTO A PARTE (12/11/2026)
--
-- Il titolare: «il tasto "ricevuta e in cassa" diventa solo "ricevuta", e
-- sblocca un nuovo tasto che si chiama "Deposita in cassa" che si trova
-- sulla destra. Quando si preme "spedisci busta", "deposita in cassa" si
-- disattiva fintanto che non e' su "ricevuta". Mentre se Stefano e' gia' a
-- Roma e non ha bisogno di spedire la busta, preme direttamente "Deposita
-- in cassa", che disattiva il tasto "spedisci busta".»
--
-- Fin qui «ricevuta» e «in cassa» erano lo stesso istante: chi dichiarava
-- l'arrivo faceva entrare il contante nella cassa contanti. Sono due cose
-- diverse — la busta arriva in amministrazione, e i soldi finiscono nel
-- cassetto quando qualcuno li mette nel cassetto — e in mezzo possono
-- passare delle ore o un giorno.
--
-- E apre la seconda strada: una busta che non viaggia. Se chi incassa e
-- chi tiene la cassa sono nello stesso posto, non c'e' niente da
-- spedire: il contante va dritto in cassa, e la contabilita' della classe
-- si chiude ugualmente (e' questo che conta per le vendite che arrivano
-- dopo). Quella busta resta scritta come NON partita e NON ricevuta,
-- perche' e' quello che e' successo.
--
-- DA ORA LA CASSA CONTANTI LEGGE busta_depositata_il, non piu'
-- busta_rientrata_il. Il backfill qui sotto e' quello che impedisce alle
-- 41 buste storiche di uscire dal saldo.

-- 1) la quarta data sulla prima busta della classe
alter table corsi_date add column if not exists busta_depositata_il date;

-- le 41 buste in archivio avevano «rientrata» col significato di «in
-- cassa»: quella data diventa la data del deposito. Senza questa riga il
-- saldo della cassa contanti perderebbe 41 buste.
update corsi_date
   set busta_depositata_il = busta_rientrata_il
 where busta_rientrata_il is not null
   and busta_depositata_il is null;

-- 2) la stessa data su ogni appendice (buste 2, 3...)
alter table corsi_date_buste add column if not exists depositata_il date;

update corsi_date_buste
   set depositata_il = rientrata_il
 where rientrata_il is not null
   and depositata_il is null;

-- 3) un'appendice puo' nascere SENZA essere partita: e' la riga che
-- scrive il deposito diretto. Finora la riga nasceva solo alla spedizione
-- e spedita_il era obbligatoria.
alter table corsi_date_buste alter column spedita_il drop not null;

-- ...ma una riga che non e' ne' partita ne' depositata non vuol dire
-- niente: e' una busta chiusa senza che nessuno l'abbia chiusa.
alter table corsi_date_buste
  drop constraint if exists corsi_date_buste_partita_o_depositata;
alter table corsi_date_buste
  add constraint corsi_date_buste_partita_o_depositata
  check (spedita_il is not null or depositata_il is not null);

-- Resta valido il vincolo di ieri su corsi_date
-- (corsi_date_busta_arrivata_solo_se_partita): una busta RICEVUTA e' per
-- forza partita. Un deposito diretto non scrive «ricevuta», quindi non lo
-- tocca — ed e' giusto che non lo tocchi: quella busta non e' arrivata da
-- nessun posto, era gia' qui.

comment on column corsi_date.busta_depositata_il is
  'Giorno in cui il contante della prima busta e'' entrato nella cassa contanti. E'' QUESTA la data che legge la cassa contanti, non busta_rientrata_il. Vuota con la busta ancora per strada o arrivata ma non ancora depositata. Puo'' essere piena con spedita_il e rientrata_il VUOTE: e'' la busta che non e'' mai partita perche'' chi incassa e chi tiene la cassa erano nello stesso posto.';
comment on column corsi_date_buste.depositata_il is
  'Come corsi_date.busta_depositata_il, per le buste dopo la prima.';
comment on column corsi_date_buste.spedita_il is
  'Giorno della spedizione. Vuota se questa appendice non e'' mai partita: e'' stata depositata in cassa direttamente (depositata_il).';

-- ROLLBACK (da eseguire a mano, in quest'ordine):
--   alter table corsi_date_buste drop constraint if exists corsi_date_buste_partita_o_depositata;
--   update corsi_date_buste set spedita_il = coalesce(spedita_il, depositata_il) where spedita_il is null;
--   alter table corsi_date_buste alter column spedita_il set not null;
--   -- rimette «ricevuta» dove c'era solo il deposito, o la cassa contanti
--   -- della versione precedente perderebbe quelle buste:
--   update corsi_date set busta_rientrata_il = coalesce(busta_rientrata_il, busta_depositata_il),
--                         busta_spedita_il = coalesce(busta_spedita_il, busta_depositata_il)
--    where busta_depositata_il is not null;
--   update corsi_date_buste set rientrata_il = coalesce(rientrata_il, depositata_il) where depositata_il is not null;
--   alter table corsi_date drop column busta_depositata_il;
--   alter table corsi_date_buste drop column depositata_il;

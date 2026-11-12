-- IL TASTO DELLA MASTER E' UN PROMEMORIA, NON UNA SCRITTURA CONTABILE
-- (12/11/2026, correzione del titolare lo stesso giorno).
--
-- Stamattina il tasto «Depositato» della dashboard master chiamava
-- `chiudiContabilitaClasse`: scriveva `busta_spedita_il`, congelava
-- `busta_importo`, marcava col numero 1 tutte le vendite della classe e
-- scriveva `busta_spedita_da_master_id`. Cioe' CHIUDEVA la contabilita'
-- della classe dalla dashboard di una master.
--
-- Il titolare: «il tasto della master non fa operazioni contabili, e'
-- solo una funzione di promemoria con cui la master segnala di aver
-- lasciato i soldi e l'amministrazione conferma di averli ricevuti», e
-- «i soldi non vanno a sommare in cassa, funge da deposito».
--
-- Quindi la stretta di mano ha due date SUE e non tocca niente di
-- contabile. Chi chiude la contabilita' resta l'amministrazione, con i
-- suoi due tasti; la cassa contanti continua a leggere soltanto
-- `busta_depositata_il`, che scrive «Deposita in cassa».
--
-- Perche' due colonne nuove invece di riusare quelle della busta: le
-- date della busta hanno degli effetti — `busta_spedita_il` chiude la
-- contabilita' e fa nascere la busta 2, `busta_depositata_il` fa entrare
-- il contante nella cassa contanti. Appoggiare un promemoria su una di
-- loro vuol dire che un promemoria muove una cassa, che e' esattamente
-- la cosa da cui questa correzione viene.

alter table corsi_date
  add column if not exists deposito_master_il date,
  add column if not exists deposito_master_da_id uuid references master(id),
  add column if not exists deposito_master_importo numeric(12,2),
  add column if not exists deposito_master_ricevuto_il date;

comment on column corsi_date.deposito_master_il is
  'Promemoria: il giorno in cui la master ha dichiarato di aver lasciato all''amministrazione il contante incassato a questo corso. NON chiude la contabilita'' e non muove nessuna cassa.';
comment on column corsi_date.deposito_master_da_id is
  'Quale master ha dichiarato il deposito: serve a scrivere il suo nome sul tasto dell''amministrazione, perche'' chi conferma deve sapere di chi sono quei soldi.';
comment on column corsi_date.deposito_master_importo is
  'Quanto la master ha dichiarato di aver lasciato, congelato al momento della dichiarazione. E'' la sua parola, non un importo contabile: l''importo della busta resta busta_importo.';
comment on column corsi_date.deposito_master_ricevuto_il is
  'Il giorno in cui l''amministrazione ha confermato di aver ricevuto quel contante. E'' la «conferma di ricevuta» che la master legge nella sua dashboard. Nessun effetto contabile.';

-- una conferma non puo' esistere senza la dichiarazione che conferma
alter table corsi_date drop constraint if exists corsi_date_deposito_master_confermato_dopo;
alter table corsi_date add constraint corsi_date_deposito_master_confermato_dopo
  check (deposito_master_ricevuto_il is null or deposito_master_il is not null);

-- E VIA LA COLONNA DI STAMATTINA. `busta_spedita_da_master_id` esisteva
-- solo per dire «questa busta l'ha chiusa una master»: da adesso nessuna
-- master chiude nessuna busta, quindi non la scrive nessuno. Misurato
-- prima di toglierla: zero righe su 116 la avevano valorizzata. Una
-- colonna che sembra viva e non lo e' e' peggio di una colonna che
-- manca, perche' chi apre la tabella ci ragiona sopra.
alter table corsi_date drop column if exists busta_spedita_da_master_id;

-- ROLLBACK
--
-- alter table corsi_date
--   add column if not exists busta_spedita_da_master_id uuid references master(id);
-- alter table corsi_date drop constraint if exists corsi_date_deposito_master_confermato_dopo;
-- alter table corsi_date
--   drop column if exists deposito_master_il,
--   drop column if exists deposito_master_da_id,
--   drop column if exists deposito_master_importo,
--   drop column if exists deposito_master_ricevuto_il;
--
-- Attenzione tornando indietro: la versione precedente leggeva il
-- deposito della master DALLE date della busta, quindi una classe in cui
-- la master ha dichiarato il deposito e l'amministrazione non ha ancora
-- chiuso la busta tornerebbe a mostrare «Devi depositare». Il
-- promemoria si perde; i soldi no, perche' il promemoria non ne ha mai
-- mosso nessuno.

-- Un kit si può spegnere: resta per la logistica e per chi l'ha già
-- comprato, sparisce dalla tendina di chi iscrive.
--
-- Chiesto dal titolare il 14/11/2026: «metti sulla barra di ogni kit un
-- selettore che spegne il kit e non lo renda più selezionabile quando
-- iscrivi gli allievi. Il kit continua ad esistere per la logistica e
-- gli allievi già iscritti mentre non si vedrà più per gli allievi
-- futuri dal momento che il selettore sarà spento.»
--
-- Perché una colonna e non la cancellazione: cancellare un pacchetto
-- lascia sulle iscrizioni il solo nome, marcato «non più in elenco», e
-- da lì quegli allievi non portano più nessun prodotto in preparazione.
-- Spegnere invece non tocca niente di tutto questo: il pacchetto c'è,
-- la sua distinta c'è, la logistica prepara come prima. Cambia una cosa
-- sola, chi lo può ancora scegliere.
--
-- Nasce acceso su tutte le righe: un pacchetto che esiste oggi è un
-- pacchetto che si vende oggi.
--
-- Rollback:
--   alter table public.kit_definizioni drop column if exists attivo;
-- Cosa si perde tornando indietro: quali pacchetti erano stati spenti.
-- Tornerebbero tutti selezionabili, e nessuno se ne accorgerebbe
-- guardando la pagina — si rivede solo aprendo la tendina di
-- un'iscrizione nuova.

alter table public.kit_definizioni
  add column if not exists attivo boolean not null default true;

comment on column public.kit_definizioni.attivo is
  'Spento (false) = il pacchetto non si può più scegliere su un''iscrizione nuova. Resta per la logistica, per il costo della classe e per gli allievi che l''hanno già: la sua distinta continua a valere. Si spegne dal selettore sulla barra del pacchetto in «Gestisci kit».';

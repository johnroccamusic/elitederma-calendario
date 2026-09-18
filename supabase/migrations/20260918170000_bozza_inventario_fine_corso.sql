-- La scheda di fine corso si salva mentre la compili.
--
-- Prima i conteggi vivevano solo nel telefono della master finche' non
-- premeva "Chiudi l'inventario": trenta righe contate in piedi, e una
-- pagina ricaricata li portava via tutti.
--
-- Da qui le righe si scrivono su rientro_righe man mano, con il rientro
-- ancora in stato "aperto". Non serve una tabella nuova ne' uno stato
-- nuovo: tutto cio' che legge un rientro — la lista di rientro, il
-- ripristino dello stock, le anomalie, l'analisi dei consumi — gia'
-- pretende stato = 'chiuso' e quindi una bozza non la vede nessuno.
-- Restano solo due cose da tenere da parte.

-- quando la bozza e' arrivata davvero sul server: e' quello che la
-- scheda mostra alla master ("salvato alle 14:32"), ed e' l'unico modo
-- che ha un secondo dispositivo per sapere se sta guardando roba fresca
alter table rientri add column if not exists bozza_ts timestamptz;

-- quali allieve hanno gia' ricevuto il kit. Nelle righe ne finisce solo
-- il CONTEGGIO, e un conteggio non dice QUALI: senza questo, riaprendo
-- la scheda si leggerebbe "5 consegnati su 6" con tutti e sei i nomi
-- segnati verdi. Forma: { "<iscritto_id>": false } — si scrivono solo
-- le eccezioni, chi il kit non l'ha avuto
alter table rientri add column if not exists bozza_consegne jsonb;

-- Via le sette tabelle della vecchia chiusura corso.
--
-- Il codice che le usava e' stato demolito nel commit precedente: il
-- modulo "Rientro materiali corso" non e' un rifacimento di quel sistema,
-- e' un concetto diverso — li' la master a fine corso dichiarava i
-- consumi su un foglio che nasceva vuoto, qui ogni pezzo lascia una
-- traccia nel momento in cui esce da un kit, e la scheda di fine corso
-- nasce gia' compilata.
--
-- Tenerle ancora un po' non serviva a niente: erano gia' orfane.
--
-- Nessun movimento di magazzino ha mai avuto origine 'chiusura_corso'
-- (verificato: zero righe), quindi cancellarle non lascia nessuna
-- giacenza sbagliata da riconciliare.
--
-- ------------------------------------------------------------------
-- ARCHIVIO DEI 38 RECORD CANCELLATI — 17 settembre 2026
-- ------------------------------------------------------------------
-- Restano qui, in git, per chiunque un domani si chieda cosa c'era.
-- Sono pochi e quasi tutti vuoti di contenuto: nessuna delle cinque
-- chiusure e' mai stata confermata (tutte in stato 'aperta'), nessuna
-- riga di bolla e' mai stata emessa, nessun dermografo censito.
--
-- chiusura_corso (5, tutte stato='aperta', mai confermate ne' ricevute):
--   dc92ea7a-5d9d-48af-b9b8-e5d4ff8a0627  corso_data 5690922a-db6e-41ff-afc1-532ec3dba97e  08/09/2026  master null
--   cdbfb4f7-5842-44af-8952-a79a6b0c8d30  corso_data 497706c4-b5cf-4fcc-b429-4ebf81c5d182  09/09/2026  master null
--   e2b1ca0a-9203-4f29-b8b7-cef0f6ee81fb  corso_data 0ef0d265-c17c-4af2-8b4e-9ee7bd81281f  11/09/2026  master 972ebefc-6678-412c-8e48-13c91c4335b8
--   df9eadf7-1082-4ac7-9f25-e80055e4227a  corso_data 10ad9f36-9407-4145-8b0b-87ee206b263d  13/09/2026  master d161612e-d1b7-44c0-8a09-cd2752b0ba94
--   53162add-c872-4d0d-8630-a72fc7ec31f2  corso_data a60b1c1b-2148-4bd9-bc52-fd876a0087fd  17/09/2026  master null
--
-- chiusura_corso_consegne (30 — tutte kit_consegnato=true, dermografo null),
-- elencate come chiusura -> iscritti:
--   dc92ea7a: 6260ad39-4609-45dd-90f1-07f835b2f216, b2bb4777-5385-4f86-9e70-f4f3409faee7,
--             6ab2a905-81f5-42ad-93e3-d70f45f92fa9, ee2d856f-f083-43d5-b0ec-8d4983d401ca,
--             1c735e71-b832-4da1-9d3f-c7fb78632f6e, 2d2f0087-5e04-4f27-b250-9a2e44512b2b
--   cdbfb4f7: d63f1e4f-cb6b-4455-bbdd-18874ba104c8, 01ec224e-f589-4347-8228-963daf88b865,
--             8954605a-810d-4223-9bc9-f38779364567, 193a9af5-a3ba-4dbf-bd7d-ae2c7464115e,
--             c029ae97-8c05-4cd2-b349-d779edadceb3, b3c97f36-f475-49f1-91d8-4d0faaf8543e,
--             886327da-5648-4c63-9d5c-0969e51a286e
--   e2b1ca0a: dd0eef9c-0e06-445d-8f1f-50d57ea9b1e5, c8eaa76b-21f7-4a87-9031-6748f1d224e4,
--             11424f77-3c03-4fd9-85de-10354583df53, 98013473-f221-4886-bb12-afdafd8baa19,
--             572892d6-070e-4855-a53c-eb6cf12a422d, 8c53572e-5c2a-4407-981b-29c9819a5b50,
--             49f16a24-37e7-42b0-bbe5-9731e5536c9b
--   df9eadf7: 3e8c69ae-4301-40e7-9d2d-588bf65f7df6, 02d8e0db-34fd-4aef-8f42-9fbd5f5564f6
--   53162add: 3398e807-aaf2-4caf-b2a0-5fb4f5a3ff92, 032be4b4-756f-4a25-965e-bd4acff9e27a,
--             10782ff3-14c2-4ddd-8194-daec2807b59b, 65d177e8-1145-4113-a1be-0f9425d02e29,
--             5258126e-8fb3-4158-93f9-f8284b6c0b28, aa70e3b8-9fcb-4d26-bbe7-ea39884f9e67,
--             3b92efaf-ddd3-41a6-85bd-e5ec78678dc1, d002dbe9-c889-4ae6-a2bb-cc74156cc3ca
--
-- chiusura_corso_prelievi (1):
--   385ca056  chiusura dc92ea7a  prodotto 39515e93-c51e-4b3b-8fcf-9347a7f65099
--             quantita 1  guasto_riconsegnato=true  dichiarato da "John"  08/09/2026
--
-- chiusura_corso_kit_riserva (1):
--   c5227fce  chiusura cdbfb4f7  kit 7df040a9-c606-4534-9d6f-70710e9042f1  indice 1  stato 'aperto'
--
-- chiusura_corso_kit_componenti (1):
--   57ed85d4  chiusura cdbfb4f7  kit 7df040a9  prodotto 05892050-f46a-405f-b30a-599cfcb97654
--             quantita 1  destinazione 'venduto'
--
-- chiusura_corso_righe: vuota.  chiusura_corso_dermografi: vuota.
-- ------------------------------------------------------------------

drop table if exists chiusura_corso_righe;
drop table if exists chiusura_corso_consegne;
drop table if exists chiusura_corso_dermografi;
drop table if exists chiusura_corso_prelievi;
drop table if exists chiusura_corso_kit_componenti;
drop table if exists chiusura_corso_kit_riserva;
drop table if exists chiusura_corso;

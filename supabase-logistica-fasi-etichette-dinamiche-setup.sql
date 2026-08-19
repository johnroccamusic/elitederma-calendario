-- ---------------------------------------------------------
-- Logistica prodotti: le fasi di spedizione passano da 5 a 4 (unite
-- "Da preparare" e "Kit pronto" in una sola, "Pacco da preparare" →
-- "Pacco preparato"), ciascuna con etichetta diversa a seconda che sia
-- ancora da raggiungere o già superata. Introdotto anche un valore
-- sentinella "completato" (non una fase reale, solo per far risultare
-- verde anche l'ultima pillola dopo che viene cliccata) — vedi
-- FASE_LOGISTICA_COMPLETATA in App.jsx.
--
-- Migrazione dati: i corsi già arrivati a "consegna_verificata" sotto
-- il vecchio schema erano già del tutto spediti — passano a
-- "completato" per risultare correttamente tutti verdi e sbloccare
-- subito "Gestione rientro", coerentemente col loro stato reale.
-- Nessun'altra fase (da_preparare/bolla_stampata/ritirato_corriere)
-- aveva righe in produzione al momento di questa migrazione: nessun
-- altro dato da correggere.
-- ---------------------------------------------------------

update public.logistica_kit_edizioni set fase = 'completato' where fase = 'consegna_verificata';

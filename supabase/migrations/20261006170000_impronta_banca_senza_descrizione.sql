-- Applicata via MCP il 06/10/2026.
--
-- L'impronta di un movimento di banca, quando la banca non da' un suo
-- identificativo, si calcolava mettendo in fila conto, giorno, importo,
-- DESCRIZIONE e progressivo. La descrizione pero' cambia a seconda di
-- dove si legge lo stesso movimento: il CSV scrive "Competenze
-- complessive al 30/09/2026", l'OFX ci incolla davanti la causale e
-- scrive "INTERESSI/COMPETENZA Competenze complessive al 30/09/2026".
-- Due impronte diverse per la stessa riga di banca, e il controllo dei
-- doppioni non se ne accorgeva.
--
-- Qui si riscrivono le impronte gia' in archivio con la formula nuova,
-- cosi' un prossimo caricamento riconosce quello che c'e' gia'. Nessun
-- rischio di collisione: oggi non esistono due righe con lo stesso
-- conto, giorno, importo e progressivo (verificato prima di scrivere).
update movimenti_banca
   set impronta = conto || '|' || data_operazione::text || '|' || importo::text || '|' || progressivo::text
 where impronta like '%|%';

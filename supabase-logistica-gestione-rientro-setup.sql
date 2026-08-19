-- ---------------------------------------------------------
-- Logistica prodotti: "Gestione rientro" — un flag che, una volta
-- spuntato, apre altre 4 fasi (Bolla rientro emessa, Pacco ritirato,
-- Pacco rientrato, Prodotti ripristinati) sotto le 5 già esistenti,
-- stesso principio (una fase alla volta, pillole cliccabili).
--
-- "Prodotti ripristinati" ricarica in giacenza_magazzino esattamente
-- le quantità già registrate come scaricate per l'edizione (kit,
-- kit speciale, accessori) — nessuna colonna nuova serve per quello,
-- riusa quantita_scaricata_magazzino/kit_speciale_scaricato/
-- accessori_scaricati già presenti.
--
-- Additivo puro, nessuna riga toccata.
-- ---------------------------------------------------------

alter table public.logistica_kit_edizioni
  add column if not exists gestione_rientro_attiva boolean not null default false,
  add column if not exists fase_rientro text;

notify pgrst, 'reload schema';

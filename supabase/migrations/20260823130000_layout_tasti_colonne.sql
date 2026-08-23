-- Numero di colonne desktop scelto dal programmatore per una pagina a
-- tasti (Home/Amministrazione/Gestione magazzino e shop/Statistiche):
-- null = usa il default della pagina (4 in Home, 3 nelle altre). Il
-- mobile resta sempre a 3 per riga, non è toccato da questa scelta.
alter table impostazioni_layout_tasti add column if not exists colonne integer;

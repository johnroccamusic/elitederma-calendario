-- Etichette personalizzate dei tasti (Home e le pagine a tasti che
-- riusano GrigliaTasti): rinominabile in modalità programmatore
-- toccando il testo sotto l'icona (vedi TileHome/GrigliaTasti in
-- App.jsx). Stessa riga già usata per ordine/colonne, una per pagina.
alter table impostazioni_layout_tasti add column if not exists etichette jsonb not null default '{}'::jsonb;

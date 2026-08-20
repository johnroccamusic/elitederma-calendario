-- Sezione 132: "Consulenze" in Logistica prodotti / Inventario Master.
-- Ogni consulenza spedita da Raf per un'edizione è una riga indipendente
-- (stesso prodotto ripetuto = righe distinte, ognuna col proprio livello
-- di riempimento a 5 pallini), quindi un array e non una mappa per
-- prodotto: { id, prodotto_id, livello } — additiva, nessun dato storico
-- da migrare.
alter table logistica_kit_edizioni
  add column if not exists consulenze_edizione jsonb not null default '[]'::jsonb;

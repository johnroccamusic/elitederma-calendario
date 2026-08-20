-- Sezione 136: "Prodotti sciolti" — terza voce di "Prodotti che sto per rispedire"
-- ---------------------------------------------------------
-- "Prodotti interi" (rinominata "Kit interi") ragiona per kit intero
-- spedito, ma i prodotti sciolti (accessori didattica del corso,
-- prodotti extra kit) non appartengono a nessun kit: serve una nuvola
-- separata per sceglierli uno per uno, come prima. Additiva pura,
-- nessuna riga toccata: rientro_prodotti_interi resta con le stesse
-- chiavi (kit_id) già in uso.

alter table public.logistica_kit_edizioni
  add column if not exists rientro_prodotti_sciolti jsonb not null default '{}'::jsonb,
  add column if not exists rientro_sciolti_processato jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

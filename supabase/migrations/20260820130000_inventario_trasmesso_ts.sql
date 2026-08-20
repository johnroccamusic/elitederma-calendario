-- Sezione 134: "Trasmetti inventario" (Inventario Master → Logistica prodotti)
-- ---------------------------------------------------------
-- "Materiali da rientrare" in Logistica prodotti mostrava dal vivo
-- quanto la master stava dichiarando in Inventario Master, anche a
-- metà lavoro. Ora resta nascosta finché la master non preme
-- "Trasmetti inventario" (accanto a "Verifica di congruità"): solo da
-- quel momento Raf vede i Prodotti interi/mancanti dichiarati. Additiva
-- pura, nessuna riga toccata.

alter table public.logistica_kit_edizioni
  add column if not exists inventario_trasmesso_ts timestamptz;

notify pgrst, 'reload schema';

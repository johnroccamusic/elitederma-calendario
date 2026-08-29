-- La tabella righe_preparate_spedizione era nata con una policy
-- "to authenticated", mentre tutte le altre tabelle dell'app sono ancora
-- "to anon": l'app si collega con la chiave anonima, quindi ogni spunta
-- veniva rifiutata da RLS ("new row violates row-level security policy").
--
-- Qui si allinea alla convenzione in uso. Il giorno in cui si passerà
-- davvero all'accesso autenticato, questa tabella si stringerà insieme a
-- tutte le altre e non da sola.
drop policy if exists righe_preparate_staff on public.righe_preparate_spedizione;
create policy "accesso interno righe_preparate_spedizione"
  on public.righe_preparate_spedizione
  for all to anon, authenticated
  using (true) with check (true);

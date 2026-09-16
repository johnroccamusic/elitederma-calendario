-- I tre errori del pannello Sicurezza di Supabase (17/09/2026).
--
-- 1) La vista woo_ordini_con_codice girava con i permessi di chi l'ha
--    creata invece che di chi la interroga: cosi' le regole delle tabelle
--    sotto (vendite_shop) non venivano applicate. Con security_invoker la
--    vista rispetta i permessi del chiamante, quindi il giorno che le
--    policy si chiuderanno varra' anche qui.
alter view public.woo_ordini_con_codice set (security_invoker = on);

-- 2) e 3) Due tabelle di servizio dei kit erano le uniche senza protezione
--    accesa: senza regole, il controllo non veniva nemmeno tentato. Si
--    accende, e si mette la stessa regola di tutte le altre, cosi' oggi
--    non cambia nulla e domani si chiudono tutte insieme.
alter table public.corsi_kit_prodotti_dermografi_rimossi enable row level security;
drop policy if exists "accesso interno corsi_kit_prodotti_dermografi_rimossi" on public.corsi_kit_prodotti_dermografi_rimossi;
create policy "accesso interno corsi_kit_prodotti_dermografi_rimossi"
  on public.corsi_kit_prodotti_dermografi_rimossi
  for all to anon, authenticated using (true) with check (true);

alter table public.corsi_kit_prodotti_anellini_sostituiti enable row level security;
drop policy if exists "accesso interno corsi_kit_prodotti_anellini_sostituiti" on public.corsi_kit_prodotti_anellini_sostituiti;
create policy "accesso interno corsi_kit_prodotti_anellini_sostituiti"
  on public.corsi_kit_prodotti_anellini_sostituiti
  for all to anon, authenticated using (true) with check (true);

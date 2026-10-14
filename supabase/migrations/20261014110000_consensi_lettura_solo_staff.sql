-- I CONSENSI SI LEGGONO SOLO DOPO AVER FATTO ACCESSO.
--
-- Da quando il consenso porta l'anamnesi (14/10/2026) questa tabella
-- contiene HIV, epatite, gravidanza, patologie autoimmuni: categorie
-- particolari ai sensi dell'art. 9 GDPR. L'unica policy era
-- `for all to anon, authenticated`, cioe' chiunque avesse la chiave
-- pubblicabile del bundle poteva leggerle senza entrare nel gestionale.
--
-- Si puo' stringere QUESTA tabella da sola, senza aspettare le altre 95,
-- perche' dall'08/10/2026 il cancello di accesso e' acceso e la sessione
-- arriva davvero al client dell'app: verificato il 13/10 su
-- `lunchflow_conti`, che ha una policy riservata a `authenticated` e in
-- pagina si vede.
--
-- LA SCRITTURA RESTA APERTA. La modella compila dal link del QR, non ha
-- un account e non lo avra': se si chiudesse anche l'inserimento, il
-- modulo smetterebbe di funzionare per tutti. Puo' scrivere, non puo'
-- rileggere ne' modificare: niente `select`, `update` o `delete` per
-- `anon`. Il consenso e' un atto che si firma una volta.
drop policy if exists "consensi_modelle_tutti" on consensi_modelle;

create policy "consensi_modelle_invio" on consensi_modelle
  for insert to anon, authenticated with check (true);

create policy "consensi_modelle_lettura_staff" on consensi_modelle
  for select to authenticated using (true);

create policy "consensi_modelle_modifica_staff" on consensi_modelle
  for update to authenticated using (true) with check (true);

create policy "consensi_modelle_cancella_staff" on consensi_modelle
  for delete to authenticated using (true);

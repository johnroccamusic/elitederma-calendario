-- 18/10/2026 — LE POLICY SI CHIUDONO A CHI HA FATTO ACCESSO.
--
-- Fino a stasera 134 tabelle su 152 erano aperte a `anon`, e 133 di
-- quelle policy erano `for all using (true) with check (true)`: con la
-- chiave pubblicabile — che sta nel bundle, scaricabile da chiunque
-- conosca l'indirizzo — si leggevano e si riscrivevano anagrafiche degli
-- allievi, pagamenti, movimenti di banca, le password in chiaro di
-- venditori e utenti_app.
--
-- Qui dentro NON si cambia una sola riga di dati: si cambia solo chi
-- puo' leggerli. La regola resta identica (`using (true)`), cambia il
-- ruolo: da `anon` a `authenticated`.
--
-- PERCHE' ADESSO SI PUO', e il 15/08 ando' male. Allora il cancello di
-- Accesso.jsx era spento e nessuno aveva una sessione: chiudere a
-- `authenticated` spense l'app per tutti, e fu annullato in giornata.
-- Dall'08/10 il cancello e' acceso, quindi chi entra e' `authenticated`.
-- E da stasera la registrazione pubblica su Supabase Auth e' spenta
-- (`disable_signup: true`, verificato dall'esterno): senza quella, un
-- estraneo si sarebbe creato un account e sarebbe rientrato da
-- `authenticated`.
--
-- LE SETTE ROTTE PUBBLICHE NON SI ROMPONO: sei passano da funzioni
-- `security definer` (master_vista, modelle_vista, biglietti_vista,
-- ricevuta_pos, modulo_vista/salva, recesso_vista), che girano coi
-- permessi del proprietario e ignorano le policy. La settima — il
-- consenso che la modella firma col QR — scrive dritta in
-- `consensi_modelle`, e per quella c'e' l'eccezione in fondo.
--
-- Il rollback e' nel file accanto: 20261018230001_rls_rollback_anon.sql.
-- La fotografia delle policy di prima e' in _policy_snapshot_20261018.

-- Il lavoro lo fa un ciclo e non 132 blocchi ribattuti a mano: ogni
-- policy viene riscritta con LA SUA stessa regola, cambiando solo il
-- ruolo. Ribattendole a mano, prima o poi un `using` sarebbe stato
-- copiato storto, e sarebbe sparita una riga dall'app senza un errore.
do $$
declare p record; comando text;
begin
  for p in
    select tablename, policyname, cmd, qual::text as usando, with_check::text as controllo
    from pg_policies
    where schemaname = 'public' and 'anon' = any(roles)
      and not (tablename = 'consensi_modelle')     -- l'eccezione sta sotto
  loop
    comando := case p.cmd
      when 'ALL' then 'all' when 'SELECT' then 'select' when 'INSERT' then 'insert'
      when 'UPDATE' then 'update' when 'DELETE' then 'delete' else lower(p.cmd) end;
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for %s to authenticated%s%s',
      p.policyname, p.tablename, comando,
      case when p.usando is not null then ' using (' || p.usando || ')' else '' end,
      case when p.controllo is not null then ' with check (' || p.controllo || ')' else '' end);
  end loop;
end $$;

-- L'ECCEZIONE: il consenso che la modella firma col QR.
--
-- Quella pagina non ha una sessione e non ne avra' mai una: scrive
-- dritta in `consensi_modelle`. Finora pero' aveva `for all`, cioe'
-- poteva anche RILEGGERE i consensi e i documenti d'identita' di tutte
-- le altre. Da adesso puo' solo scrivere il proprio, come gia' succede
-- per i moduli di iscrizione: si carica, non si rilegge.
drop policy if exists "accesso interno consensi_modelle" on public.consensi_modelle;
create policy "staff autenticato consensi_modelle" on public.consensi_modelle
  for all to authenticated using (true) with check (true);
create policy "la modella firma il suo consenso" on public.consensi_modelle
  for insert to anon with check (true);

-- STORAGE: i documenti d'identita' delle modelle non si rileggono da fuori.
drop policy if exists "consensi_documenti_leggi" on storage.objects;
create policy "consensi_documenti_leggi" on storage.objects
  for select to authenticated using (bucket_id = 'consensi-documenti');

-- E gli allegati degli allievi: la lettura e la scrittura passano da una
-- sessione. (Il secchio resta "pubblico" a livello di bucket: quello e'
-- il capitolo dopo, e richiede di sostituire getPublicUrl con URL
-- firmati in quattordici punti dell'app.)
drop policy if exists "accesso interno allegati-iscritti" on storage.objects;
create policy "accesso interno allegati-iscritti" on storage.objects
  for all to authenticated using (bucket_id = 'allegati-iscritti') with check (bucket_id = 'allegati-iscritti');
drop policy if exists "lettura allegati iscritti" on storage.objects;
create policy "lettura allegati iscritti" on storage.objects
  for select to authenticated using (bucket_id = 'allegati-iscritti');
drop policy if exists "upload allegati iscritti" on storage.objects;
create policy "upload allegati iscritti" on storage.objects
  for insert to authenticated with check (bucket_id = 'allegati-iscritti');

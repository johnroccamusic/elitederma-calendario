-- DA ESEGUIRE A MANO (editor SQL di Supabase). Non e' stato applicato
-- automaticamente: contiene la creazione di una policy e la
-- programmazione di un lavoro notturno, e ha bisogno della service role
-- key, che non deve passare da una chat ne' finire in questo repository.
--
-- Fino a quando non si esegue:
--   * `email_regole` ha RLS attiva e NESSUNA policy, quindi il pannello
--     "Invii automatici" in Setting non riesce a leggerla e lo dice;
--   * nessuna mail automatica parte, perche' nessuno chiama la funzione.
-- Non e' una situazione pericolosa: e' tutto fermo.

-- 1. LA POLICY. Come `email_modelli` e `email_inviate`: solo chi ha fatto
--    accesso. Qui si decide cosa parte da solo a nome di Elitederma.
drop policy if exists "staff autenticato email_regole" on public.email_regole;
create policy "staff autenticato email_regole"
  on public.email_regole for all to authenticated
  using (true) with check (true);

-- 2. IL SEGRETO. Dalla dashboard: Project Settings → API → service_role
--    key. Si mette nel vault una volta sola. NON incollare la chiave in
--    chat: copiala dal pannello e incollala qui sotto, esegui, e poi
--    cancella la riga dall'editor.
--
--    select vault.create_secret('<SERVICE_ROLE_KEY>', 'email_cron_service_key');
--
--    La funzione `email-programmate` accetta solo la service role key o la
--    sessione di una persona: la chiave pubblicabile NON basta, perche' sta
--    nel bundle e chiunque potrebbe far partire gli invii.

-- 3. IL LAVORO NOTTURNO. Alle 6 UTC come il referral automatico: in Italia
--    sono le 7 d'inverno e le 8 d'estate. Va bene per una mail che deve
--    farsi trovare la mattina.
--
--    Dentro la funzione "oggi" e' calcolato sul fuso di Roma, non su UTC:
--    girando a quest'ora la differenza non si vedrebbe comunque, ma se un
--    giorno si spostasse il lavoro a tarda sera conterebbe eccome.
select cron.schedule(
  'email-programmate-giornaliero',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/email-programmate',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'email_cron_service_key' limit 1
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Per spegnere tutto in fretta, se mai servisse:
--   select cron.unschedule('email-programmate-giornaliero');
-- oppure, piu' mirato, dalla pagina Setting → Modelli email → Invii
-- automatici, spegnendo la singola regola.

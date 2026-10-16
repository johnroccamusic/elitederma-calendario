-- IL LAVORO NOTTURNO. APPLICATA il 16/10/2026 via MCP.
--
-- Alle 6 UTC come il referral automatico: in Italia sono le 7 d'inverno
-- e le 8 d'estate. Va bene per una mail che deve farsi trovare la
-- mattina.
--
-- Dentro la funzione "oggi" e' calcolato sul fuso di Roma, non su UTC:
-- girando a quest'ora la differenza non si vedrebbe comunque, ma se un
-- giorno si spostasse il lavoro a tarda sera conterebbe eccome.
--
-- I DUE HEADER, e perche' servono entrambi:
--   Authorization  il JWT anon del progetto. Non autorizza niente: serve
--                  a passare il cancello di Supabase (verify_jwt), che
--                  altrimenti respinge la richiesta prima che arrivi al
--                  codice della funzione.
--   x-cron-token   il gettone nato nel vault. E' questo che dice "sono
--                  il lavoro notturno". Lo verifica public.email_cron_ok.
--
-- Anche con questo acceso non parte nessuna mail finche' non c'e' una
-- regola ACCESA in email_regole: le regole nascono spente.
--
-- Provato il 16/10/2026 per questa stessa strada:
--   gettone giusto      -> 200  {"regole":0,"messaggio":"Nessuna regola accesa."}
--   gettone inventato   -> 403
--   senza gettone       -> 403
--
-- Per spegnere tutto in fretta, se mai servisse:
--   select cron.unschedule('email-programmate-giornaliero');
-- oppure, piu' mirato, da Setting -> Modelli email -> Invii automatici,
-- spegnendo la singola regola.

select cron.unschedule('email-programmate-giornaliero')
where exists (select 1 from cron.job where jobname = 'email-programmate-giornaliero');

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
        where name = 'referral_cron_anon_key' limit 1
      ),
      'x-cron-token', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'email_cron_token' limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);

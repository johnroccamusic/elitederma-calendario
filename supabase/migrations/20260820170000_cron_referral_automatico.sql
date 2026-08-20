-- Schedula "genera-referral-automatico" (una volta al giorno, alle 6:00 UTC)
-- così i referral code delle master vengono creati davvero da soli, non
-- solo tramite il tasto manuale "Genera i codici di oggi" in Impostazioni.
--
-- L'header Authorization richiesto dalla Edge Function (verify_jwt: true)
-- viene letto da Vault per nome, MAI scritto qui in chiaro — evita di
-- lasciare una chiave, anche solo pubblica, nella cronologia delle
-- migrazioni. Il segreto va creato una tantum con:
--   select vault.create_secret('<VITE_SUPABASE_ANON_KEY del progetto>', 'referral_cron_anon_key');
-- (via SQL Editor su Supabase, non da qui)

select cron.schedule(
  'genera-referral-automatico-giornaliero',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/genera-referral-automatico',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'referral_cron_anon_key'
        limit 1
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

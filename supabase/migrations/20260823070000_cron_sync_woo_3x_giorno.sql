-- Sincronizza automaticamente 3 volte al giorno (8:00, 14:00, 20:00 ora
-- italiana) sia il catalogo prodotti sia le vendite dallo shop online, così
-- non serve più premere a mano "Sincronizza catalogo"/"Recupera ordini
-- mancanti" per avere numeri aggiornati.
--
-- pg_cron gira in UTC e non converte da solo per il cambio ora legale: gli
-- orari qui sotto (6/12/18 UTC) sono giusti in ora legale (CEST, marzo-
-- ottobre). In ora solare (CET, il resto dell'anno) scattano un'ora prima
-- (7/13/19 locali) — stessa imprecisione già presente in
-- genera-referral-automatico-giornaliero, non risolta nemmeno lì.
--
-- Riusa il secret di Vault già creato per il cron dei referral code
-- (contiene la stessa VITE_SUPABASE_ANON_KEY, valida per qualunque Edge
-- Function): niente di nuovo da configurare a mano.

select cron.schedule(
  'woo-sync-catalogo-3x-giorno',
  '0 6,12,18 * * *',
  $$
  select net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/woo-sync-catalogo',
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

select cron.schedule(
  'woo-import-storico-3x-giorno',
  '0 6,12,18 * * *',
  $$
  select net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/woo-import-storico',
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

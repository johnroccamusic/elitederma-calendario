-- IL REFERRAL DELLE MASTER DURA UN MESE (28/10/2026, chiesto dal titolare).
--
-- Ogni mese il referral personale di una master scade, ne nasce uno nuovo
-- con lo stesso sconto, e il vecchio smette di funzionare e sparisce: dal
-- sito si cancella, nell'app si segna `scaduto` e non compare piu' in
-- nessun elenco. La riga resta perche' e' lei che dice di chi sono le
-- vendite fatte con quel codice (v_punti_master_righe trova la master dal
-- codice): cancellarla toglierebbe alle master i punti dei mesi passati.
--
-- Il lavoro lo fa la edge function `ruota-referral-master`; le regole
-- stanno in supabase/functions/_shared/referralMensile.js.
--
-- PERCHE' OGNI ORA E NON UNA VOLTA AL MESE. Il cron gira in UTC e il mese
-- e' quello di Roma: mezzanotte del primo, in Italia, sono le 22 o le 23
-- UTC a seconda dell'ora legale. Girando ogni ora al minuto 5 il cambio
-- avviene alle 00:05 italiane tutto l'anno, senza una riga da cambiare a
-- marzo e a ottobre. E se il sito e' giu' quella notte, il giro dopo
-- riprova da solo. Gli altri 700 giri del mese leggono la tabella, non
-- trovano niente da fare e finiscono li': nessuna chiamata al sito.
--
-- Al primo giro, i 17 codici di sempre (nati il 03/09 senza scadenza)
-- prendono la fine del mese in corso: non si cambiano a meta' mese,
-- qualcuno li ha gia' in mano. Ruotano il primo del mese dopo.
--
-- Autenticazione come email-programmate: il JWT anon per il cancello di
-- Supabase, e il gettone `email_cron_token` del vault, verificato da
-- public.email_cron_ok. La chiave pubblicabile da sola risponde 403.
--
-- Per fermare tutto:
--   select cron.unschedule('ruota-referral-master-orario');

select cron.unschedule('ruota-referral-master-orario')
where exists (select 1 from cron.job where jobname = 'ruota-referral-master-orario');

select cron.schedule(
  'ruota-referral-master-orario',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/ruota-referral-master',
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

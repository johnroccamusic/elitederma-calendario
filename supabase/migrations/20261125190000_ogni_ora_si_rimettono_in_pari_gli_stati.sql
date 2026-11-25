-- LA RETE SOTTO LE ALTRE DUE: ogni ora si chiede a Resend com'e' finita
-- ogni mail di campagna ferma su «inviata» (25/11/2026).
--
-- Le altre due difese stanno a monte: gli id del lotto si scrivono in una
-- volta sola (la finestra cieca passa da secondi a millisecondi) e un
-- avviso che non trova la sua riga si mette da parte invece di essere
-- buttato. Ma un avviso puo' sempre perdersi davvero — Resend giu' per un
-- minuto, il nostro endpoint che risponde 500, un rinvio che non arriva
-- mai — e allora quella riga resterebbe «inviata» per sempre: non «non
-- arrivata», proprio «non lo sappiamo».
--
-- Alle 40 di ogni ora si guardano cento righe ferme da piu' di un'ora e
-- si chiede a Resend. Non spedisce niente: legge e scrive lo stato con la
-- stessa scala di tutti gli altri avvisi.
--
-- L'ORA, e perche' il minuto 40: i lavori notturni di questo progetto
-- stanno fra le 04 e le 06, e il quarto d'ora della sincronizzazione shop
-- sta su 0/15/30/45. Il 40 e' libero.
--
-- SERVE UNA CHIAVE CHE SAPPIA LEGGERE. Le chiavi di Resend sono «Sending
-- access» o «Full access», e `GET /emails/{id}` vuole la seconda: quella
-- che usiamo per spedire risponde 401, misurato il 25/11/2026. Finche'
-- nei secret non c'e' `RESEND_API_KEY_LETTURA` questo lavoro gira e non
-- fa niente, dicendo perche' — non scrive, non sbaglia, non avvisa.
--
-- ROLLBACK:
--   select cron.unschedule('campagne-stati-in-pari');

select cron.schedule(
  'campagne-stati-in-pari',
  '40 * * * *',
  $$
  select net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/crm-campagna-riallinea',
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
    body := jsonb_build_object('quante', 100, 'minutiFermi', 60),
    timeout_milliseconds := 120000
  );
  $$
);

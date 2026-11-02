-- La sincronizzazione degli ordini del sito partiva una volta l'ora e, se
-- si appendeva (successo dal 1/11/2026 in poi), il buco durava finche'
-- qualcuno non se ne accorgeva. Ora parte ogni quarto d'ora: un giro
-- fallito costa un quarto d'ora, non un'ora o un giorno. La funzione ha
-- un budget di tempo suo (110 s) e scrive l'esito in sync_shop_esiti.
create or replace function public.sincronizza_shop_frequente()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  chiave text;
begin
  select decrypted_secret into chiave from vault.decrypted_secrets where name = 'referral_cron_anon_key' limit 1;
  if chiave is null then
    raise warning 'sincronizza_shop_frequente: chiave non trovata nel vault, sincronizzazione saltata';
    return;
  end if;
  perform net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/woo-import-storico',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  );
end;
$function$;

revoke execute on function public.sincronizza_shop_frequente() from public, anon, authenticated;

select cron.alter_job(
  (select jobid from cron.job where jobname = 'sincronizza-shop'),
  schedule := '*/15 * * * *',
  command := 'select public.sincronizza_shop_frequente()'
);

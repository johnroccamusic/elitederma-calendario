-- Da quattro volte al giorno a ogni ora.
--
-- Finche' la sincronizzazione era solo una rifinitura, quattro giri
-- bastavano. Da quando si e' visto cosa succede se si ferma — due
-- settimane di stati fermi, scoperte dai clienti — e' la rete sotto al
-- webhook, e una rete si guarda spesso.
--
-- Il cron passa gia' ogni mezz'ora (0,30): qui si apre il cancello a
-- tutti i minuti :00, cioe' una volta all'ora.
create or replace function public.sincronizza_shop_orario()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  minuto_roma text := to_char(now() at time zone 'Europe/Rome', 'MI');
  chiave text;
begin
  if minuto_roma <> '00' then
    return;
  end if;
  select decrypted_secret into chiave from vault.decrypted_secrets where name = 'referral_cron_anon_key' limit 1;
  if chiave is null then
    raise warning 'sincronizza_shop_orario: chiave non trovata nel vault, sincronizzazione saltata';
    return;
  end if;
  perform net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/woo-import-storico',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

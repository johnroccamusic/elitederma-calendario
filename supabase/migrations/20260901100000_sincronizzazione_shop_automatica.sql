-- ---------------------------------------------------------
-- Il magazzino si allinea allo shop da solo, quattro volte al giorno.
--
-- Il webhook di WooCommerce resta la via principale, ma non basta: quando
-- il sito è irraggiungibile — e succede — WooCommerce riprova qualche
-- volta e poi smette, e quello che si è perso non torna più da solo. È così
-- che tre ordini di fine agosto sono arrivati in app senza scaricare
-- niente, e che l'ordine 10130 è rimasto "in lavorazione" per due settimane
-- mentre sul sito era chiuso da un pezzo.
--
-- Da qui in avanti, alle 07:00, 12:30, 17:00 e 20:30 (ora di Roma), l'app
-- va a riprendersi tutto da sola: ordini nuovi, stati cambiati e movimenti
-- di magazzino mai applicati. Il lavoro vero lo fa woo-import-storico, che
-- è idempotente — rieseguirla non duplica ordini e non scarica due volte
-- gli stessi pezzi, perché guarda i PASSAGGI di stato, non lo stato.
--
-- Il cron gira ogni mezz'ora e la funzione decide se è il momento: pg_cron
-- ragiona in UTC, e con l'ora legale gli orari italiani si sposterebbero di
-- un'ora due volte l'anno (era il difetto del vecchio cron alle 6-12-18
-- UTC, che questo sostituisce). Chiedendo a Postgres che ore sono a Roma
-- il problema non esiste.
--
-- La chiave per chiamare la funzione si legge dal vault, dove già sta per
-- il cron dei referral: non si scrive dentro il codice.
-- ---------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.sincronizza_shop_orario()
returns void
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  ora_roma text := to_char(now() at time zone 'Europe/Rome', 'HH24:MI');
  chiave text;
begin
  if ora_roma not in ('07:00', '12:30', '17:00', '20:30') then
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

select cron.unschedule('sincronizza-shop') where exists (select 1 from cron.job where jobname = 'sincronizza-shop');
select cron.schedule('sincronizza-shop', '0,30 * * * *', 'select public.sincronizza_shop_orario()');

select cron.unschedule('woo-import-storico-3x-giorno')
 where exists (select 1 from cron.job where jobname = 'woo-import-storico-3x-giorno');

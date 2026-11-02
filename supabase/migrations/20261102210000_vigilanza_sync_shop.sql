-- LA VIGILANZA SULLA SINCRONIZZAZIONE DEL SITO: notifica push e mail
-- quando gli ordini non entrano piu'.
--
-- PERCHE' NON DENTRO woo-import-storico. Il guasto dell'1/11/2026 ha
-- ucciso la funzione a meta' (546 WORKER_RESOURCE_LIMIT): non e' arrivata
-- a scrivere l'esito, e non sarebbe arrivata nemmeno a mandare un avviso
-- di se stessa. Chi muore non si segnala. Il sorvegliante deve stare
-- fuori, guardare il SILENZIO, ed essere un altro processo: qui e' un
-- cron che chiama la edge function `sync-shop-vigilanza`.
--
-- La soglia (settanta minuti senza un giro riuscito) e il testo
-- dell'avviso stanno in `supabase/functions/_shared/sync-vigilanza.js`,
-- condiviso fra il browser e Deno: il semaforo in Vendite shop e la
-- notifica devono dire lo stesso numero.

create table if not exists public.sync_shop_vigilanza (
  -- una riga sola: e' lo stato di un fatto solo. Il check impedisce che
  -- se ne creino due, perche' due righe vorrebbero dire due verita'.
  id integer primary key default 1 check (id = 1),
  acceso boolean not null default true,
  stato text not null default 'a_posto' check (stato in ('a_posto', 'guasto', 'muto')),
  guasto_dal timestamptz,
  ultimo_controllo_il timestamptz,
  ultimo_avviso_il timestamptz,
  avvisi_mandati integer not null default 0,
  -- A chi arriva. Scelto dal titolare il 2/11/2026: la mail a lui, le
  -- push solo a chi amministra. Si cambiano da Vendite shop, senza
  -- ripubblicare niente.
  --
  -- I dispositivi si nominano per UTENTE e non per endpoint o per id:
  -- l'endpoint cambia a ogni reinstallazione dell'app e l'id e' quello
  -- di una riga che muore con lei, mentre il nome di chi ha acceso le
  -- notifiche resta. Il prezzo e' che se quel nome cambia il telefono
  -- smette di ricevere: per questo la pagina mostra quanti dispositivi
  -- corrispondono davvero.
  email_avviso text[] not null default array['commerciale.elitederma@gmail.com'],
  push_utenti text[] not null default array['GianLuca Rocca'],
  -- Un avviso ripetuto ogni quarto d'ora e' un avviso che si silenzia.
  ore_fra_avvisi numeric not null default 6,
  ultimo_esito_avviso text
);

insert into public.sync_shop_vigilanza (id) values (1) on conflict (id) do nothing;

alter table public.sync_shop_vigilanza enable row level security;

drop policy if exists "vigilanza sync shop: accesso staff" on public.sync_shop_vigilanza;
create policy "vigilanza sync shop: accesso staff" on public.sync_shop_vigilanza
  for select to authenticated using (true);
drop policy if exists "vigilanza sync shop: la correggono gli autenticati" on public.sync_shop_vigilanza;
create policy "vigilanza sync shop: la correggono gli autenticati" on public.sync_shop_vigilanza
  for update to authenticated using (true) with check (true);
-- niente insert ne' delete: la riga e' una e c'e' gia'. Lo stato lo
-- scrive la edge function con la service role, che le policy non le
-- guarda: dall'app si cambiano i destinatari, non la storia.

-- Il cron. Due intestazioni, come il lavoro notturno delle email: il JWT
-- del progetto serve solo a passare il cancello `verify_jwt` di Supabase,
-- e il gettone nato dentro Postgres (`email_cron_token`, mai uscito dal
-- database) e' quello che la funzione fa verificare a `email_cron_ok`.
-- La service role key nel vault e' di prima del passaggio alle chiavi
-- nuove e risponderebbe 403.
create or replace function public.vigila_sync_shop()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  chiave text;
  gettone text;
begin
  select decrypted_secret into chiave from vault.decrypted_secrets where name = 'referral_cron_anon_key' limit 1;
  select decrypted_secret into gettone from vault.decrypted_secrets where name = 'email_cron_token' limit 1;
  if chiave is null or gettone is null then
    raise warning 'vigila_sync_shop: chiave o gettone non trovati nel vault, controllo saltato';
    return;
  end if;
  perform net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/sync-shop-vigilanza',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chiave,
      'x-cron-token', gettone),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$function$;

revoke execute on function public.vigila_sync_shop() from public, anon, authenticated;

-- Qualche minuto dopo il giro di sincronizzazione (:00 :15 :30 :45), per
-- dargli il tempo di scrivere il suo esito.
select cron.unschedule('vigilanza-sync-shop') where exists (select 1 from cron.job where jobname = 'vigilanza-sync-shop');
select cron.schedule('vigilanza-sync-shop', '8,23,38,53 * * * *', 'select public.vigila_sync_shop()');

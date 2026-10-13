-- LUNCH FLOW SCRIVE DOVE SCRIVE GIA' L'ESTRATTO CONTO.
-- I movimenti scaricati dall'API entrano in movimenti_banca, dove ci
-- sono gia' quelli importati da file, con sopra la riconciliazione, le
-- regole automatiche, il pannello doppioni e "Contabilizza".
-- L'anti-duplicato resta "impronta": per questi vale 'lf:' || id.
--
-- Applicata il 13/10/2026.
alter table movimenti_banca add column if not exists origine text not null default 'file';
alter table movimenti_banca add column if not exists lunchflow_id text;
alter table movimenti_banca drop constraint if exists movimenti_banca_origine_valida;
alter table movimenti_banca add constraint movimenti_banca_origine_valida
  check (origine in ('file', 'lunchflow'));
create unique index if not exists movimenti_banca_lunchflow_id_unico
  on movimenti_banca (lunchflow_id) where lunchflow_id is not null;

-- Il saldo e' il dato piu' sensibile dell'applicazione: questa tabella e'
-- chiusa a chi ha fatto accesso, piu' stretta del resto del database.
create table if not exists lunchflow_conti (
  id text primary key, nome text, iban text,
  valuta text not null default 'EUR',
  saldo numeric, saldo_il timestamptz,
  ultimo_sync timestamptz, ultimo_esito text,
  creato_il timestamptz not null default now()
);
alter table lunchflow_conti enable row level security;
drop policy if exists lunchflow_conti_lettura on lunchflow_conti;
create policy lunchflow_conti_lettura on lunchflow_conti for select to authenticated using (true);

-- pg_cron ragiona in UTC e non sa dell'ora legale: il job gira ogni ora e
-- l'ora giusta la controlla la funzione, guardando l'orologio di Roma.
create or replace function public.sincronizza_banca_giornaliera()
returns void language plpgsql security definer set search_path to 'public' as $$
declare ora_roma text := to_char(now() at time zone 'Europe/Rome', 'HH24'); chiave text;
begin
  if ora_roma <> '07' then return; end if;
  select decrypted_secret into chiave from vault.decrypted_secrets where name = 'referral_cron_anon_key' limit 1;
  if chiave is null then raise warning 'sincronizza_banca_giornaliera: chiave non trovata'; return; end if;
  perform net.http_post(
    url := 'https://snhvvipszhfllrgemsdu.supabase.co/functions/v1/lunchflow-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
end; $$;
select cron.schedule('sincronizza-banca', '0 * * * *', 'select public.sincronizza_banca_giornaliera()');

-- Sezione 137: Referral code per master — "Genera Coupon" a 3 tab
-- ---------------------------------------------------------
-- "coupon" guadagna un legame opzionale a una master: i coupon "referral"
-- (creati a mano dalla tab "Genera referral code", o in automatico dal
-- cron a inizio corso) hanno master_id valorizzato, i coupon generici
-- della tab "Generazione manuale" restano con master_id null, esattamente
-- come oggi. generato_da_cron distingue nello storico i codici nati dal
-- cron da quelli creati a mano nella tab referral.
--
-- "regole_referral_automatico" è una riga singola con il template usato
-- dal cron per generare i codici automatici (sconto, validità,
-- cumulabilità, utilizzi, spesa minima).
--
-- pg_cron + pg_net servono per far girare davvero, ogni giorno, la nuova
-- Edge Function che genera i referral code — senza bisogno che qualcuno
-- apra l'app.

alter table public.coupon
  add column if not exists master_id uuid references public.master(id),
  add column if not exists generato_da_cron boolean not null default false;

create table if not exists public.regole_referral_automatico (
  id uuid primary key default gen_random_uuid(),
  percentuale_sconto numeric not null default 10,
  giorni_validita_dopo_corso integer not null default 30,
  valido_durante_corso boolean not null default true,
  non_cumulabile boolean not null default true,
  utilizzi_max integer,
  utilizzi_max_per_cliente integer default 1,
  spesa_minima numeric,
  aggiornato_ts timestamptz not null default now()
);
alter table public.regole_referral_automatico enable row level security;
create policy regole_referral_automatico_all on public.regole_referral_automatico
  for all to anon using (true) with check (true);
insert into public.regole_referral_automatico (id)
  select gen_random_uuid()
  where not exists (select 1 from public.regole_referral_automatico);

create extension if not exists pg_cron;
create extension if not exists pg_net;

notify pgrst, 'reload schema';

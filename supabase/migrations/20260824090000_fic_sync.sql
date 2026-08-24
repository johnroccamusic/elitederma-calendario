-- ============================================================================
-- Sincronizzazione Fatture in Cloud: connessioni, documenti, log, schedulazione
-- ============================================================================

create table if not exists fic_connessioni (
  company_id    bigint primary key,          -- id azienda su Fatture in Cloud
  nome          text,
  access_token  text not null,
  refresh_token text not null,
  scade_il      timestamptz not null,
  attiva        boolean not null default true,
  aggiornata_il timestamptz not null default now()
);
comment on table fic_connessioni is 'Token OAuth per azienda. Mai esporre al client: solo service_role.';

do $$ begin
  create type fic_direzione as enum ('emesso','ricevuto');
exception when duplicate_object then null; end $$;

-- Documenti emessi (fatture attive) e ricevuti (acquisti + SPESE)
create table if not exists fic_documenti (
  company_id    bigint not null references fic_connessioni(company_id) on delete cascade,
  fic_id        bigint not null,
  direzione     fic_direzione not null,
  tipo          text not null,               -- invoice | credit_note | expense | delivery_note
  numero        text,
  data          date,
  controparte   text,                        -- fornitore (ricevuti) o cliente (emessi)
  piva          text,
  cf            text,
  imponibile    numeric(14,2),
  iva           numeric(14,2),
  totale        numeric(14,2),
  categoria     text,
  allegato      text,                        -- nome file allegato su FIC
  raw           jsonb not null,              -- risposta integrale: non si perde nulla
  aggiornato_il timestamptz not null default now(),
  primary key (company_id, direzione, fic_id)
);
create index if not exists fic_documenti_data on fic_documenti (company_id, data desc);
create index if not exists fic_documenti_tipo on fic_documenti (company_id, direzione, tipo);

-- "Da registrare": e-fatture arrivate dallo SdI non ancora registrate.
-- SOLA LETTURA: le API di Fatture in Cloud non permettono di registrarle.
create table if not exists fic_documenti_pending (
  company_id  bigint not null references fic_connessioni(company_id) on delete cascade,
  fic_id      bigint not null,
  fornitore   text,
  piva        text,
  data        date,
  totale      numeric(14,2),
  file_nome   text,
  raw         jsonb not null,
  visto_il    timestamptz not null default now(),
  sparito_il  timestamptz,                   -- valorizzato quando non e' piu' in lista (= registrato)
  primary key (company_id, fic_id)
);
create index if not exists fic_pending_aperti on fic_documenti_pending (company_id) where sparito_il is null;

create table if not exists fic_sync_log (
  id          bigserial primary key,
  company_id  bigint,
  modo        text,
  iniziata_il timestamptz not null default now(),
  finita_il   timestamptz,
  esito       text,                          -- ok | parziale | errore
  emessi      int not null default 0,
  ricevuti    int not null default 0,
  pending     int not null default 0,
  messaggio   text
);
create index if not exists fic_sync_log_recenti on fic_sync_log (iniziata_il desc);

alter table fic_connessioni       enable row level security;
alter table fic_documenti         enable row level security;
alter table fic_documenti_pending enable row level security;
alter table fic_sync_log          enable row level security;
-- Nessuna policy = accesso solo via service_role (le Edge Function).
-- fic_documenti ha una policy di sola lettura per anon, aggiunta in
-- 20260824190000_fic_documenti_select_anon.sql, per la sezione "Note di
-- credito" di Contabilità. Le altre tre restano solo service_role.

-- ============================================================================
-- Schedulazione: mattina e pomeriggio, tutti i giorni
-- ============================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Metti la service_role key nel Vault (una volta sola, dalla dashboard o con:
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'fic_service_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'fic_project_url');

create or replace function fic_avvia_sync(p_modo text default 'incrementale')
returns bigint language plpgsql security definer as $$
declare v_url text; v_key text; v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'fic_project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'fic_service_key';

  select net.http_post(
    url     := v_url || '/functions/v1/fic-sync',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || v_key),
    body    := jsonb_build_object('modo', p_modo),
    timeout_milliseconds := 600000
  ) into v_req;

  return v_req;
end $$;

-- ATTENZIONE: cron.schedule lavora in UTC.
-- 05:00 UTC = 07:00 in Italia d'estate (06:00 d'inverno)
-- 13:00 UTC = 15:00 in Italia d'estate (14:00 d'inverno)
select cron.schedule('fic-sync-mattina',    '0 5 * * *',  $$ select fic_avvia_sync('incrementale') $$);
select cron.schedule('fic-sync-pomeriggio', '0 13 * * *', $$ select fic_avvia_sync('incrementale') $$);

-- Per disattivare:  select cron.unschedule('fic-sync-mattina');
-- Per lanciare a mano: select fic_avvia_sync('completo');

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Setup completo (tutte le migrazioni)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
--
-- E scritto per essere sicuro da eseguire in qualunque momento: ogni
-- pezzo controlla prima se esiste gia (tabelle, colonne, policy, bucket)
-- e se si lo salta, quindi puoi lanciarlo anche se il tuo database ha
-- gia alcune di queste modifiche - non duplica ne rompe nulla.
--
-- Nota: alcune colonne di "iscritti" e di "corsi_date" (i dettagli di
-- vendita/pagamento dell'iscritto, le date come "data_inizio"/"data_fine")
-- sono state aggiunte in passato direttamente dal pannello Supabase,
-- senza passare da un file .sql: qui sono comunque incluse dove note con
-- certezza, cosi il file resta utilizzabile anche per ricreare il
-- database da zero, non solo per aggiornare quello attuale.
-- =========================================================


-- ---------------------------------------------------------
-- 1) Base: corsi, location, corsi_date, iscritti
-- ---------------------------------------------------------
create table if not exists public.corsi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  colore text not null unique,
  posti_max int not null default 10,
  ts timestamptz not null default now()
);

create table if not exists public.location (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ts timestamptz not null default now()
);

create table if not exists public.corsi_date (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi(id) on delete cascade,
  location_id uuid not null references public.location(id) on delete cascade,
  data date not null,
  posti_max int,
  ts timestamptz not null default now()
);

create table if not exists public.iscritti (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  nome text not null,
  cognome text not null,
  note text,
  ts timestamptz not null default now()
);

alter table public.corsi enable row level security;
alter table public.location enable row level security;
alter table public.corsi_date enable row level security;
alter table public.iscritti enable row level security;

drop policy if exists "accesso interno corsi" on public.corsi;
create policy "accesso interno corsi" on public.corsi for all to anon using (true) with check (true);
drop policy if exists "accesso interno location" on public.location;
create policy "accesso interno location" on public.location for all to anon using (true) with check (true);
drop policy if exists "accesso interno corsi_date" on public.corsi_date;
create policy "accesso interno corsi_date" on public.corsi_date for all to anon using (true) with check (true);
drop policy if exists "accesso interno iscritti" on public.iscritti;
create policy "accesso interno iscritti" on public.iscritti for all to anon using (true) with check (true);


-- ---------------------------------------------------------
-- 2) Master + assegnazione a una data
-- ---------------------------------------------------------
create table if not exists public.master (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.master enable row level security;
drop policy if exists "accesso interno master" on public.master;
create policy "accesso interno master" on public.master for all to anon using (true) with check (true);

alter table public.corsi_date add column if not exists master_id uuid references public.master(id) on delete set null;


-- ---------------------------------------------------------
-- 3) Hotel, Assistente, Leva
-- ---------------------------------------------------------
create table if not exists public.hotel (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.hotel enable row level security;
drop policy if exists "accesso interno hotel" on public.hotel;
create policy "accesso interno hotel" on public.hotel for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.hotel to anon, authenticated;

create table if not exists public.assistente (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.assistente enable row level security;
drop policy if exists "accesso interno assistente" on public.assistente;
create policy "accesso interno assistente" on public.assistente for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.assistente to anon, authenticated;

create table if not exists public.leva (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.leva enable row level security;
drop policy if exists "accesso interno leva" on public.leva;
create policy "accesso interno leva" on public.leva for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.leva to anon, authenticated;


-- ---------------------------------------------------------
-- 4) Campi "Assegnazione Master" su corsi_date
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists sede_confermata boolean not null default false;
alter table public.corsi_date add column if not exists note text;
alter table public.corsi_date add column if not exists assistente_id uuid references public.assistente(id) on delete set null;
alter table public.corsi_date add column if not exists leva_id uuid references public.leva(id) on delete set null;
alter table public.corsi_date add column if not exists alloggio_id uuid references public.hotel(id) on delete set null;
alter table public.corsi_date add column if not exists viaggio_prenotato boolean not null default false;
alter table public.corsi_date add column if not exists viaggio_file text[];
alter table public.corsi_date add column if not exists note_viaggio text;


-- ---------------------------------------------------------
-- 5) Piu assistenti e piu leve per data (elenchi, non un solo id)
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists assistente_ids uuid[] not null default '{}';
alter table public.corsi_date add column if not exists leva_ids uuid[] not null default '{}';

update public.corsi_date set assistente_ids = array[assistente_id]
  where assistente_id is not null and assistente_ids = '{}';
update public.corsi_date set leva_ids = array[leva_id]
  where leva_id is not null and leva_ids = '{}';


-- ---------------------------------------------------------
-- 5b) Date con inizio/fine (corsi di piu giorni) + campi vendita/pagamento
-- di un iscritto (modulo completo di iscrizione)
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists data_inizio date;
alter table public.corsi_date add column if not exists data_fine date;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'corsi_date' and column_name = 'data'
  ) then
    update public.corsi_date set data_inizio = data, data_fine = data
      where data_inizio is null and data is not null;
  end if;
end $$;

alter table public.iscritti add column if not exists tutor text;
alter table public.iscritti add column if not exists telefono text;
alter table public.iscritti add column if not exists acconto_imponibile numeric;
alter table public.iscritti add column if not exists acconto_totale numeric;
alter table public.iscritti add column if not exists acconto_metodo text;
alter table public.iscritti add column if not exists acconto_interessi numeric;
alter table public.iscritti add column if not exists precorso_imponibile numeric;
alter table public.iscritti add column if not exists precorso_totale numeric;
alter table public.iscritti add column if not exists precorso_metodo text;
alter table public.iscritti add column if not exists precorso_interessi numeric;
alter table public.iscritti add column if not exists saldo_imponibile numeric;
alter table public.iscritti add column if not exists saldo_totale numeric;
alter table public.iscritti add column if not exists saldo_metodo text;
alter table public.iscritti add column if not exists accordi_commerciali text;
alter table public.iscritti add column if not exists richiede_modelle boolean;
alter table public.iscritti add column if not exists numero_modelle int;
alter table public.iscritti add column if not exists prezzo_speciale_modelle numeric;
alter table public.iscritti add column if not exists pacchetto_kit text;
alter table public.iscritti add column if not exists taglia_divisa text;
alter table public.iscritti add column if not exists totale_pattuito numeric;
alter table public.iscritti add column if not exists quota_venditore numeric;
alter table public.iscritti add column if not exists file_iscrizione text;
alter table public.iscritti add column if not exists file_screen_acconto text;
alter table public.iscritti add column if not exists file_screen_recap text;

-- bucket per i file caricati sulla scheda iscritto (modulo/screen)
insert into storage.buckets (id, name, public)
values ('allegati-iscritti', 'allegati-iscritti', true)
on conflict (id) do nothing;
drop policy if exists "accesso interno allegati-iscritti" on storage.objects;
create policy "accesso interno allegati-iscritti" on storage.objects for all to anon
  using (bucket_id = 'allegati-iscritti') with check (bucket_id = 'allegati-iscritti');


-- ---------------------------------------------------------
-- 6) Quota speciale iscritto (sostituisce la quota venditore del 7%)
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists quota_speciale numeric;


-- ---------------------------------------------------------
-- 7) Stampa diplomi: template per corso, font globali, posizione globale
-- ---------------------------------------------------------
alter table public.corsi add column if not exists diploma_template_path text;

create table if not exists public.font_diplomi (
  id uuid primary key default gen_random_uuid(),
  font_allievo_path text,
  font_data_path text,
  font_firma_path text,
  diploma_riferimento_path text,
  nome_pos_x numeric not null default 50,
  nome_pos_y numeric not null default 50,
  nome_font_size int not null default 24,
  nome_colore text not null default '#000000',
  nome_allineamento text not null default 'center',
  data_pos_x numeric not null default 50,
  data_pos_y numeric not null default 65,
  data_font_size int not null default 16,
  data_colore text not null default '#000000',
  data_allineamento text not null default 'center',
  firma_pos_x numeric not null default 50,
  firma_pos_y numeric not null default 80,
  firma_font_size int not null default 16,
  firma_colore text not null default '#000000',
  firma_allineamento text not null default 'center',
  ts timestamptz not null default now()
);
alter table public.font_diplomi enable row level security;
drop policy if exists "accesso interno font_diplomi" on public.font_diplomi;
create policy "accesso interno font_diplomi" on public.font_diplomi for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('diploma-templates', 'diploma-templates', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('diploma-fonts', 'diploma-fonts', true)
on conflict (id) do nothing;

drop policy if exists "accesso interno diploma-templates" on storage.objects;
create policy "accesso interno diploma-templates" on storage.objects for all to anon
  using (bucket_id = 'diploma-templates') with check (bucket_id = 'diploma-templates');

drop policy if exists "accesso interno diploma-fonts" on storage.objects;
create policy "accesso interno diploma-fonts" on storage.objects for all to anon
  using (bucket_id = 'diploma-fonts') with check (bucket_id = 'diploma-fonts');


-- ---------------------------------------------------------
-- 8) Eccezioni diplomi: diplomi alternativi assegnabili al singolo
-- iscritto (template e/o data diversi da quelli normali del corso)
-- ---------------------------------------------------------
create table if not exists public.diploma_eccezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  file_path text not null,
  ts timestamptz not null default now()
);
alter table public.diploma_eccezioni enable row level security;
drop policy if exists "accesso interno diploma_eccezioni" on public.diploma_eccezioni;
create policy "accesso interno diploma_eccezioni" on public.diploma_eccezioni for all to anon using (true) with check (true);

alter table public.iscritti add column if not exists diploma_eccezione_id uuid references public.diploma_eccezioni(id) on delete set null;
alter table public.iscritti add column if not exists diploma_eccezione_data date;


-- ---------------------------------------------------------
-- 9) Stampa Segnaposto: font, foglio A4 di stampa, posizione dei 7 posti
-- ---------------------------------------------------------
create table if not exists public.segnaposti_config (
  id uuid primary key default gen_random_uuid(),
  font_path text,
  riferimento_path text,
  font_size int not null default 20,
  colore text not null default '#000000',
  limite_pos_x numeric not null default 85,
  slot1_pos_x numeric not null default 50, slot1_pos_y numeric not null default 12.5,
  slot2_pos_x numeric not null default 50, slot2_pos_y numeric not null default 25,
  slot3_pos_x numeric not null default 50, slot3_pos_y numeric not null default 37.5,
  slot4_pos_x numeric not null default 50, slot4_pos_y numeric not null default 50,
  slot5_pos_x numeric not null default 50, slot5_pos_y numeric not null default 62.5,
  slot6_pos_x numeric not null default 50, slot6_pos_y numeric not null default 75,
  slot7_pos_x numeric not null default 50, slot7_pos_y numeric not null default 87.5,
  ts timestamptz not null default now()
);
alter table public.segnaposti_config enable row level security;
drop policy if exists "accesso interno segnaposti_config" on public.segnaposti_config;
create policy "accesso interno segnaposti_config" on public.segnaposti_config for all to anon using (true) with check (true);
alter table public.segnaposti_config add column if not exists limite_pos_x numeric not null default 85;


notify pgrst, 'reload schema';

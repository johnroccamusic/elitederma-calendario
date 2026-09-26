-- Gestione eventi: fiere, congressi, giornate fuori sede.
--
-- Un evento NON e' un corso. Si somiglia — ha un nome, delle date, una
-- citta', della gente che ci va e del materiale da portare — ma non ha
-- iscritti, ne' quote, ne' kit da consegnare, ne' una busta da chiudere.
-- Metterlo dentro "corsi_date" avrebbe voluto dire che ogni conto che
-- pesa i corsi (contabilita', punti, provvigioni, statistiche) si
-- sarebbe trovato in mezzo delle righe che corsi non sono. Quindi vive
-- per conto suo, nella tabella "eventi" che gia' c'era — la usano le
-- spese per imputare i costi (spese.evento_id).
alter table eventi
  add column if not exists nome_luogo text,
  add column if not exists indirizzo text,
  add column if not exists citta text,
  add column if not exists note text,
  add column if not exists stato text not null default 'programmato',
  add column if not exists aggiornato_il timestamptz not null default now();

alter table eventi drop constraint if exists eventi_stato_valido;
alter table eventi add constraint eventi_stato_valido
  check (stato in ('programmato', 'concluso', 'annullato'));

create index if not exists eventi_data on eventi (data_inizio desc);

create table if not exists eventi_team (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventi(id) on delete cascade,
  persona_tipo text,
  persona_id uuid,
  nome text not null,
  ruolo text,
  note text,
  ordine smallint not null default 0,
  creato_il timestamptz not null default now()
);
create index if not exists eventi_team_evento on eventi_team (evento_id, ordine);

-- ATTENZIONE: queste righe NON muovono il magazzino. E' un elenco di
-- cosa preparare, non uno scarico. Il giorno in cui si decidera' che
-- l'evento scarica davvero, quel passaggio deve entrare da muoviStock
-- come tutti gli altri, non da qui.
create table if not exists eventi_materiali (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventi(id) on delete cascade,
  prodotto_id uuid references prodotti_shop(id) on delete set null,
  nome text not null,
  quantita numeric not null default 1,
  unita text,
  preparato boolean not null default false,
  note text,
  ordine smallint not null default 0,
  creato_il timestamptz not null default now()
);
create index if not exists eventi_materiali_evento on eventi_materiali (evento_id, ordine);

create table if not exists eventi_trasferimenti (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventi(id) on delete cascade,
  tipo text,
  descrizione text,
  chi text,
  partenza timestamptz,
  arrivo timestamptz,
  da_dove text,
  a_dove text,
  riferimento text,
  costo numeric,
  allegato_path text,
  allegato_nome text,
  note text,
  creato_il timestamptz not null default now()
);
create index if not exists eventi_trasferimenti_evento on eventi_trasferimenti (evento_id, partenza);

create table if not exists eventi_hotel_gruppi (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventi(id) on delete cascade,
  nome text,
  hotel_id uuid references hotel(id) on delete set null,
  hotel_nome text,
  check_in date,
  check_out date,
  riferimento text,
  note text,
  ordine smallint not null default 0,
  creato_il timestamptz not null default now()
);
create index if not exists eventi_hotel_gruppi_evento on eventi_hotel_gruppi (evento_id, ordine);

create table if not exists eventi_hotel_stanze (
  id uuid primary key default gen_random_uuid(),
  gruppo_id uuid not null references eventi_hotel_gruppi(id) on delete cascade,
  nome text,
  tipo text,
  check_in date,
  check_out date,
  occupanti jsonb not null default '[]'::jsonb,
  costo numeric,
  note text,
  ordine smallint not null default 0,
  creato_il timestamptz not null default now()
);
create index if not exists eventi_hotel_stanze_gruppo on eventi_hotel_stanze (gruppo_id, ordine);

alter table eventi_team enable row level security;
alter table eventi_materiali enable row level security;
alter table eventi_trasferimenti enable row level security;
alter table eventi_hotel_gruppi enable row level security;
alter table eventi_hotel_stanze enable row level security;

do $$
declare t text;
begin
  foreach t in array array['eventi_team','eventi_materiali','eventi_trasferimenti','eventi_hotel_gruppi','eventi_hotel_stanze'] loop
    execute format('drop policy if exists %I_tutti on %I', t, t);
    execute format('create policy %I_tutti on %I for all to anon, authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

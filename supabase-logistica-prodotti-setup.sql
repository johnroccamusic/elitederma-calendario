-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Logistica prodotti (kit corsi)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists"/migrazione dati
-- idempotente (non duplica nulla se lanciata più volte).
-- =========================================================

-- Catalogo dei kit "creati": ogni kit ha un nome e, facoltativamente, un
-- corso per cui è il kit di default (usato per la preselezione in
-- "Preparazione kit"). Un kit senza corso di default è un "kit speciale"
-- puro, selezionabile per qualunque edizione.
create table if not exists public.kit_definizioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  corso_id uuid references public.corsi(id) on delete set null,
  ordine integer not null default 0,
  ts timestamptz not null default now()
);
alter table public.kit_definizioni add column if not exists ordine integer not null default 0;
alter table public.kit_definizioni enable row level security;
drop policy if exists "kit_definizioni_all" on public.kit_definizioni;
create policy "kit_definizioni_all" on public.kit_definizioni for all to anon using (true) with check (true);

-- Contenuto di ciascun kit: quali prodotti del magazzino (prodotti_shop)
-- lo compongono ("tipo"='kit', con quantità per singolo kit) e quali
-- sono "altri accessori" ("tipo"='accessorio', senza quantità fissa: la
-- quantità inviata la scrive chi prepara la spedizione, edizione per
-- edizione). La vecchia colonna "corso_id" resta per compatibilità ma
-- non è più la chiave: ora è "kit_id".
create table if not exists public.corsi_kit_prodotti (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid references public.corsi(id) on delete cascade,
  kit_id uuid references public.kit_definizioni(id) on delete cascade,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  tipo text not null default 'kit', -- 'kit' oppure 'accessorio'
  quantita integer not null default 1, -- rilevante solo per tipo='kit'
  ts timestamptz not null default now()
);
alter table public.corsi_kit_prodotti add column if not exists kit_id uuid references public.kit_definizioni(id) on delete cascade;
alter table public.corsi_kit_prodotti alter column corso_id drop not null;

-- Migrazione: un kit_definizioni per ogni corso che aveva già un
-- "contenuto kit" (dalla versione precedente, un kit per corso), poi
-- ricollega le righe esistenti al nuovo kit_id.
do $$
declare r record;
declare nuovo_kit_id uuid;
begin
  for r in select distinct corso_id from public.corsi_kit_prodotti where kit_id is null and corso_id is not null loop
    select id into nuovo_kit_id from public.kit_definizioni where corso_id = r.corso_id limit 1;
    if nuovo_kit_id is null then
      insert into public.kit_definizioni (nome, corso_id)
      select nome, id from public.corsi where id = r.corso_id
      returning id into nuovo_kit_id;
    end if;
    update public.corsi_kit_prodotti set kit_id = nuovo_kit_id where corso_id = r.corso_id and kit_id is null;
  end loop;
end $$;

alter table public.corsi_kit_prodotti drop constraint if exists corsi_kit_prodotti_corso_id_prodotto_id_tipo_key;
drop index if exists corsi_kit_prodotti_corso_id_prodotto_id_tipo_key;
alter table public.corsi_kit_prodotti drop constraint if exists corsi_kit_prodotti_kit_id_prodotto_id_tipo_key;
alter table public.corsi_kit_prodotti add constraint corsi_kit_prodotti_kit_id_prodotto_id_tipo_key unique (kit_id, prodotto_id, tipo);

alter table public.corsi_kit_prodotti enable row level security;
drop policy if exists "corsi_kit_prodotti_all" on public.corsi_kit_prodotti;
create policy "corsi_kit_prodotti_all" on public.corsi_kit_prodotti for all to anon using (true) with check (true);

-- Stato operativo per singola edizione (corsi_date): fase di
-- preparazione/spedizione, checklist, e DUE selezioni di kit indipendenti
-- — quello "principale" (di default il kit del corso, ma selezionabile
-- tra tutti quelli creati) e uno "speciale" facoltativo, ciascuno con il
-- proprio numero di kit per iscritti/di riserva.
--
-- Lo scarico dal magazzino è "reattivo" per ciascuna selezione:
-- quantita_scaricata_magazzino (kit principale) e kit_speciale_scaricato
-- (kit speciale) registrano quanti kit sono già stati applicati al
-- magazzino l'ultima volta; se il numero attuale cambia, il pulsante
-- "Modifica quantità di magazzino" si riattiva e, al click, si applica
-- solo la DIFFERENZA (mai il valore assoluto) — stesso principio per
-- accessori_scaricati rispetto ad accessori_quantita, chiave per chiave
-- ("kitId::prodottoId", per non confondere l'accessorio dello stesso
-- prodotto se compare sia nel kit principale sia in quello speciale).
create table if not exists public.logistica_kit_edizioni (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade unique,
  fase text not null default 'da_preparare',
  kit_id uuid references public.kit_definizioni(id) on delete set null,
  kit_per_iscritti integer,
  kit_di_riserva integer,
  quantita_scaricata_magazzino integer not null default 0,
  kit_speciale_id uuid references public.kit_definizioni(id) on delete set null,
  kit_speciale_per_iscritti integer,
  kit_speciale_di_riserva integer,
  kit_speciale_scaricato integer not null default 0,
  checklist jsonb not null default '{}',
  accessori_quantita jsonb not null default '{}',
  accessori_scaricati jsonb not null default '{}',
  ts timestamptz not null default now()
);
alter table public.logistica_kit_edizioni add column if not exists kit_id uuid references public.kit_definizioni(id) on delete set null;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_id uuid references public.kit_definizioni(id) on delete set null;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_per_iscritti integer;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_di_riserva integer;
alter table public.logistica_kit_edizioni add column if not exists kit_speciale_scaricato integer not null default 0;
alter table public.logistica_kit_edizioni add column if not exists quantita_scaricata_magazzino integer not null default 0;
alter table public.logistica_kit_edizioni add column if not exists accessori_scaricati jsonb not null default '{}';
alter table public.logistica_kit_edizioni enable row level security;
drop policy if exists "logistica_kit_edizioni_all" on public.logistica_kit_edizioni;
create policy "logistica_kit_edizioni_all" on public.logistica_kit_edizioni for all to anon using (true) with check (true);

notify pgrst, 'reload schema';

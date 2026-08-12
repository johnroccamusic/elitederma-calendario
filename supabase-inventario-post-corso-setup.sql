-- ---------------------------------------------------------
-- Inventario Post Corso — fase 1: fondamenta.
--
-- rientro_obbligatorio_se_aperto: attributo del prodotto (stessa scheda
-- da cui il POS pesca nome e prezzo) — pigmenti SÌ, consumabili di
-- servizio NO. Guida da solo cosa succede quando un pezzo viene
-- dichiarato "aperto" in inventario, senza liste separate da tenere
-- allineate.
--
-- vendite_shop.corso_data_id: serve al conteggio "Venduti" della
-- verifica di congruità — una vendita POS fatta durante un corso viene
-- attribuita anche a quel corso, non solo all'operatore.
--
-- prodotti_aperti_magazzino: tabella già esistente (popolata dal
-- vecchio flusso "rientro prodotti aperti" di Logistica prodotti), qui
-- estesa con nota/master_id/stato — diventa così il magazzino prodotti
-- aperti "da valutare" in sede voluto dalla specifica, senza duplicare
-- la tabella.
--
-- magazzino_locale_consumabili: stock persistente per città dei
-- consumabili di servizio parzialmente usati, con livello a pallini
-- (1-5) — più righe per lo stesso prodotto quando i livelli sono
-- diversi (es. due rotoli aperti a metà diversa).
--
-- inventario_ammanchi: una riga per ogni causale che la master assegna
-- ai pezzi "da giustificare" nella verifica di congruità.
-- ---------------------------------------------------------
alter table public.prodotti_shop add column if not exists rientro_obbligatorio_se_aperto boolean not null default false;
alter table public.vendite_shop add column if not exists corso_data_id uuid references public.corsi_date(id) on delete set null;

alter table public.prodotti_aperti_magazzino add column if not exists nota text;
alter table public.prodotti_aperti_magazzino add column if not exists master_id uuid references public.master(id) on delete set null;
alter table public.prodotti_aperti_magazzino add column if not exists stato text not null default 'da_valutare';

create table if not exists public.magazzino_locale_consumabili (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.location(id) on delete cascade,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  quantita integer not null default 1,
  livello integer not null default 5 check (livello between 1 and 5),
  corso_data_id uuid references public.corsi_date(id) on delete set null,
  master_id uuid references public.master(id) on delete set null,
  ts timestamptz not null default now()
);
alter table public.magazzino_locale_consumabili enable row level security;
drop policy if exists "accesso interno magazzino_locale_consumabili" on public.magazzino_locale_consumabili;
create policy "accesso interno magazzino_locale_consumabili" on public.magazzino_locale_consumabili for all to anon using (true) with check (true);
create index if not exists magazzino_locale_consumabili_location_idx on public.magazzino_locale_consumabili (location_id);

create table if not exists public.inventario_ammanchi (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid not null references public.corsi_date(id) on delete cascade,
  master_id uuid references public.master(id) on delete set null,
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  quantita integer not null default 1,
  causale text not null,
  nota text,
  foto_path text,
  ts timestamptz not null default now()
);
alter table public.inventario_ammanchi enable row level security;
drop policy if exists "accesso interno inventario_ammanchi" on public.inventario_ammanchi;
create policy "accesso interno inventario_ammanchi" on public.inventario_ammanchi for all to anon using (true) with check (true);
create index if not exists inventario_ammanchi_corso_idx on public.inventario_ammanchi (corso_data_id);

insert into storage.buckets (id, name, public) values ('inventario-foto', 'inventario-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno inventario-foto" on storage.objects;
create policy "accesso interno inventario-foto" on storage.objects for all to anon
  using (bucket_id = 'inventario-foto') with check (bucket_id = 'inventario-foto');

notify pgrst, 'reload schema';

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Magazzino" (catalogo prodotti WooCommerce)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- categorie prodotto, con gerarchia (una categoria può avere sotto-categorie)
create table if not exists public.categorie_prodotti (
  id uuid primary key default gen_random_uuid(),
  woo_category_id integer not null unique,
  nome text not null,
  categoria_padre_id uuid references public.categorie_prodotti(id) on delete set null,
  ts_sync timestamptz not null default now()
);
alter table public.categorie_prodotti enable row level security;
drop policy if exists "accesso interno categorie_prodotti" on public.categorie_prodotti;
create policy "accesso interno categorie_prodotti" on public.categorie_prodotti for all to anon using (true) with check (true);

-- prodotti dello shop. costo_acquisto e scorta_minima sono dati propri
-- dell'app (mai scritti da WooCommerce): la Edge Function di sync non
-- li tocca mai in aggiornamento
create table if not exists public.prodotti_shop (
  id uuid primary key default gen_random_uuid(),
  woo_product_id integer not null unique,
  nome text not null,
  sku text,
  prezzo_vendita numeric,
  giacenza integer,
  scorta_minima integer,
  costo_acquisto numeric,
  attivo boolean not null default true,
  ts_sync timestamptz not null default now()
);
alter table public.prodotti_shop enable row level security;
drop policy if exists "accesso interno prodotti_shop" on public.prodotti_shop;
create policy "accesso interno prodotti_shop" on public.prodotti_shop for all to anon using (true) with check (true);

-- un prodotto può appartenere a più categorie (come su WooCommerce)
create table if not exists public.prodotti_categorie (
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  categoria_id uuid not null references public.categorie_prodotti(id) on delete cascade,
  primary key (prodotto_id, categoria_id)
);
alter table public.prodotti_categorie enable row level security;
drop policy if exists "accesso interno prodotti_categorie" on public.prodotti_categorie;
create policy "accesso interno prodotti_categorie" on public.prodotti_categorie for all to anon using (true) with check (true);

create index if not exists prodotti_shop_attivo_idx on public.prodotti_shop (attivo);
create index if not exists prodotti_categorie_categoria_idx on public.prodotti_categorie (categoria_id);

notify pgrst, 'reload schema';

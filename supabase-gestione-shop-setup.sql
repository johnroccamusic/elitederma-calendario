-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Gestione Shop" (pannello categorie/prodotti/immagini WooCommerce)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- Richiede che supabase-magazzino-shop-setup.sql sia già stato eseguito.
-- =========================================================

-- descrizione, immagine e ordine di visualizzazione (da menu_order di
-- WooCommerce, per rispettare l'ordine reale con cui le categorie
-- appaiono sullo shop online)
alter table public.categorie_prodotti add column if not exists descrizione text;
alter table public.categorie_prodotti add column if not exists immagine_url text;
alter table public.categorie_prodotti add column if not exists ordine integer not null default 0;

-- descrizioni e stato pubblicazione (mirror di "status" di WooCommerce)
alter table public.prodotti_shop add column if not exists descrizione text;
alter table public.prodotti_shop add column if not exists descrizione_breve text;
alter table public.prodotti_shop add column if not exists stato text not null default 'publish';

-- galleria immagini di un prodotto, in ordine di visualizzazione (la
-- posizione 0 è l'immagine di copertina, esattamente come su WooCommerce)
create table if not exists public.prodotti_immagini (
  id uuid primary key default gen_random_uuid(),
  prodotto_id uuid not null references public.prodotti_shop(id) on delete cascade,
  woo_image_id integer,
  url text not null,
  ordine integer not null default 0,
  ts_sync timestamptz not null default now()
);
alter table public.prodotti_immagini enable row level security;
drop policy if exists "accesso interno prodotti_immagini" on public.prodotti_immagini;
create policy "accesso interno prodotti_immagini" on public.prodotti_immagini for all to anon using (true) with check (true);

create index if not exists prodotti_immagini_prodotto_ordine_idx on public.prodotti_immagini (prodotto_id, ordine);

-- storage per le immagini caricate da "Gestione Shop" (poi passate a
-- WooCommerce come URL: WooCommerce le scarica nella sua media library)
insert into storage.buckets (id, name, public) values ('shop-immagini', 'shop-immagini', true) on conflict (id) do nothing;
drop policy if exists "accesso interno shop-immagini" on storage.objects;
create policy "accesso interno shop-immagini" on storage.objects for all to anon
  using (bucket_id = 'shop-immagini') with check (bucket_id = 'shop-immagini');

notify pgrst, 'reload schema';

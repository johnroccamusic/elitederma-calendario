-- ---------------------------------------------------------
-- Genera Coupon: form per creare codici sconto scritti su WooCommerce.
-- Base anche per la futura generazione automatica dei premi alle
-- master. "valido_da" non esiste in WooCommerce (che ha solo la
-- scadenza): un coupon con valido_da futura resta in stato
-- "programmato" qui, e viene creato su WooCommerce solo quando si
-- preme "Attiva ora" (nessuna schedulazione automatica per ora).
-- ---------------------------------------------------------
create table if not exists public.coupon (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,
  descrizione text,
  tipo_sconto text not null check (tipo_sconto in ('percent', 'fixed_cart', 'fixed_product')),
  valore numeric(12, 2) not null,
  valido_da date,
  valido_fino_a date,
  ambito text not null default 'tutto' check (ambito in ('tutto', 'categorie', 'prodotti')),
  categorie_ids integer[] default '{}',
  prodotti_ids integer[] default '{}',
  escludi_categorie_ids integer[] default '{}',
  escludi_prodotti_ids integer[] default '{}',
  utilizzi_max integer,
  utilizzi_max_per_utente integer,
  spesa_minima numeric(12, 2),
  non_cumulabile boolean not null default false,
  limita_a_email text[],
  woo_coupon_id integer,
  stato text not null default 'bozza' check (stato in ('bozza', 'programmato', 'attivo', 'scaduto', 'annullato')),
  creato_da text,
  created_at timestamptz not null default now()
);
alter table public.coupon enable row level security;
drop policy if exists "accesso interno coupon" on public.coupon;
create policy "accesso interno coupon" on public.coupon for all to anon using (true) with check (true);

notify pgrst, 'reload schema';

-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Vendite shop" (integrazione WooCommerce)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: usa "if not exists".
-- =========================================================

-- una riga per ogni ordine WooCommerce, tenuta aggiornata dalla Edge
-- Function "woo-webhook" (nuovo ordine/aggiornamento stato) e popolata
-- una tantum dalla Edge Function "woo-import-storico" per gli ordini
-- già esistenti prima di attivare il webhook
create table if not exists public.vendite_shop (
  id uuid primary key default gen_random_uuid(),
  woo_order_id integer not null unique,
  numero_ordine text,
  data_ordine timestamptz,
  stato text,
  cliente_nome text,
  cliente_email text,
  totale numeric,
  totale_imponibile numeric,
  totale_iva numeric,
  prodotti jsonb not null default '[]',
  payload_raw jsonb,
  ts_ricevuto timestamptz not null default now()
);
alter table public.vendite_shop enable row level security;
drop policy if exists "accesso interno vendite_shop" on public.vendite_shop;
create policy "accesso interno vendite_shop" on public.vendite_shop for all to anon using (true) with check (true);

create index if not exists vendite_shop_data_ordine_idx on public.vendite_shop (data_ordine desc);
create index if not exists vendite_shop_stato_idx on public.vendite_shop (stato);

notify pgrst, 'reload schema';

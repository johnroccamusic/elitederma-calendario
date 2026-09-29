-- Le righe d'ordine che il magazzino non ha saputo scaricare.
--
-- Fino a ieri, quando una riga di un ordine WooCommerce non trovava il
-- suo prodotto in anagrafica, lo scarico saltava e restava soltanto un
-- `console.error` nei log dell'edge function — che nessuno legge. Il
-- pacco parte, la giacenza non scende, e ce ne si accorge mesi dopo
-- contando gli scaffali.
--
-- Qui ci finisce una riga per ogni scarico mancato, e Logistica la
-- mostra in cima agli Ordini in arrivo finché qualcuno non la sistema.
-- Non e' un log: e' una coda di lavoro, e si svuota.
create table if not exists scarichi_non_riusciti (
  id uuid primary key default gen_random_uuid(),
  -- l'ordine da cui viene: il numero e' l'unica cosa che permette di
  -- andarselo a guardare sul sito
  woo_order_id bigint,
  numero_ordine text,
  vendita_id uuid references vendite_shop(id) on delete cascade,
  -- la riga com'era scritta sull'ordine, non come la vorremmo: serve a
  -- capire PERCHE' non e' stata riconosciuta
  nome_riga text not null,
  sku text,
  woo_product_id bigint,
  woo_variation_id bigint,
  quantita numeric not null default 0,
  motivo text not null,
  -- quando qualcuno la sistema, si segna chi e quando invece di
  -- cancellarla: un pezzo di magazzino sparito e poi ritrovato e' una
  -- cosa che si vuole poter rileggere
  risolto_il timestamptz,
  risolto_da text,
  nota_risoluzione text,
  ts timestamptz not null default now()
);
create index if not exists scarichi_non_riusciti_aperti
  on scarichi_non_riusciti (ts desc) where risolto_il is null;

alter table scarichi_non_riusciti enable row level security;
drop policy if exists scarichi_non_riusciti_tutti on scarichi_non_riusciti;
create policy scarichi_non_riusciti_tutti on scarichi_non_riusciti
  for all to anon, authenticated using (true) with check (true);

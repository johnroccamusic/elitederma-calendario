-- Lo specchio dei codici promozionali di WooCommerce (li scarica la edge
-- function "woo-sync-coupon") e la vista che ci aggancia quando e per
-- quanto ogni codice e' stato speso davvero nei nostri ordini.
create table if not exists woo_coupon (
  woo_coupon_id bigint primary key,
  codice text not null,
  tipo_sconto text,
  importo numeric,
  descrizione text,
  prodotti_ids jsonb not null default '[]'::jsonb,
  usati integer not null default 0,
  limite_uso integer,
  data_scadenza date,
  data_creazione timestamptz,
  ts_sincronizzato timestamptz not null default now()
);
create index if not exists woo_coupon_codice on woo_coupon (lower(codice));
alter table woo_coupon enable row level security;
drop policy if exists "accesso interno woo_coupon" on woo_coupon;
create policy "accesso interno woo_coupon" on woo_coupon
  for all to anon, authenticated using (true) with check (true);

-- WooCommerce dice solo QUANTE volte un codice e' stato usato, non quando
-- ne' per quanto: quello sta dentro payload_raw.coupon_lines dei nostri
-- ordini. "discount" e' lo sconto vero di quell'ordine — un 15% vale una
-- cifra diversa ogni volta.
create or replace view woo_coupon_con_utilizzi
with (security_invoker = on) as
select
  c.*,
  u.primo_utilizzo,
  u.ultimo_utilizzo,
  coalesce(u.ordini_con_codice, 0) as ordini_con_codice,
  coalesce(u.sconto_totale, 0) as sconto_totale,
  coalesce(u.incasso_ordini, 0) as incasso_ordini
from woo_coupon c
left join (
  select
    codice,
    min(data) as primo_utilizzo,
    max(data) as ultimo_utilizzo,
    count(*) as ordini_con_codice,
    round(sum(sconto)::numeric, 2) as sconto_totale,
    round(sum(totale_ordine)::numeric, 2) as incasso_ordini
  from (
    select
      lower(trim(cl->>'code')) as codice,
      (v.data_ordine)::date as data,
      coalesce(nullif(cl->>'discount', '')::numeric, 0)
        + coalesce(nullif(cl->>'discount_tax', '')::numeric, 0) as sconto,
      coalesce(v.totale, 0) as totale_ordine
    from vendite_shop v
    cross join lateral jsonb_array_elements(coalesce(v.payload_raw->'coupon_lines', '[]'::jsonb)) cl
    where coalesce(v.stato, '') not in ('cancelled', 'failed', 'trash')
  ) x
  group by codice
) u on u.codice = lower(trim(c.codice));

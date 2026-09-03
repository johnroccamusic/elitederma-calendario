-- Aggiunge alla vista l'elenco dei singoli utilizzi: per ogni ordine in
-- cui il codice e' stato speso, data, cliente, quanto e' stato speso e
-- quanto sconto ha fatto. L'id dell'ordine serve all'app per mostrare il
-- carrello di quella spesa.
create or replace view woo_coupon_con_utilizzi
with (security_invoker = on) as
select
  c.*,
  u.primo_utilizzo,
  u.ultimo_utilizzo,
  coalesce(u.ordini_con_codice, 0) as ordini_con_codice,
  coalesce(u.sconto_totale, 0) as sconto_totale,
  coalesce(u.incasso_ordini, 0) as incasso_ordini,
  coalesce(u.utilizzi, '[]'::jsonb) as utilizzi
from woo_coupon c
left join (
  select
    codice,
    min(data) as primo_utilizzo,
    max(data) as ultimo_utilizzo,
    count(*) as ordini_con_codice,
    round(sum(sconto)::numeric, 2) as sconto_totale,
    round(sum(totale_ordine)::numeric, 2) as incasso_ordini,
    jsonb_agg(
      jsonb_build_object(
        'vendita_id', vendita_id,
        'numero_ordine', numero_ordine,
        'data', data,
        'cliente', cliente,
        'spesa', round(totale_ordine::numeric, 2),
        'sconto', round(sconto::numeric, 2)
      ) order by data desc
    ) as utilizzi
  from (
    select
      lower(trim(cl->>'code')) as codice,
      v.id as vendita_id,
      v.numero_ordine,
      (v.data_ordine)::date as data,
      v.cliente_nome as cliente,
      coalesce(nullif(cl->>'discount', '')::numeric, 0)
        + coalesce(nullif(cl->>'discount_tax', '')::numeric, 0) as sconto,
      coalesce(v.totale, 0) as totale_ordine
    from vendite_shop v
    cross join lateral jsonb_array_elements(coalesce(v.payload_raw->'coupon_lines', '[]'::jsonb)) cl
    where coalesce(v.stato, '') not in ('cancelled', 'failed', 'trash')
  ) x
  group by codice
) u on u.codice = lower(trim(c.codice));

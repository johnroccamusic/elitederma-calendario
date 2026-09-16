-- Analisi codici sconto (Statistiche): ogni ordine del sito con il codice
-- usato, letto dalle coupon_lines dell'ordine WooCommerce. Si legge da
-- qui e non da woo_coupon, perche' molti codici sono stati cancellati dal
-- sito dopo l'uso e li' non ci sono piu'. Applicata via MCP il 16/09/2026.
create or replace view woo_ordini_con_codice as
select v.id as vendita_id,
       v.numero_ordine,
       v.data_ordine::date as data,
       v.cliente_nome as cliente,
       v.stato,
       coalesce(v.totale, 0) as totale,
       lower(trim(cl.value ->> 'code')) as codice,
       coalesce(nullif(cl.value ->> 'discount', '')::numeric, 0) + coalesce(nullif(cl.value ->> 'discount_tax', '')::numeric, 0) as sconto
from vendite_shop v
cross join lateral jsonb_array_elements(coalesce(v.payload_raw -> 'coupon_lines', '[]'::jsonb)) cl(value)
where v.origine = 'woocommerce' and v.simulazione = false
  and coalesce(v.stato, '') not in ('cancelled', 'failed', 'trash')
  and coalesce(v.tipo_movimento, 'vendita') = 'vendita';
grant select on woo_ordini_con_codice to anon, authenticated;

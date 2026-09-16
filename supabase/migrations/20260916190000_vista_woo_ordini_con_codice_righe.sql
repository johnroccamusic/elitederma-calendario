-- Analisi codici sconto: per simulare i punti che le vendite storiche
-- avrebbero dato alle master servono le righe dell'ordine (prodotto,
-- quantita', prezzo pieno e prezzo scontato). Si leggono dalle line_items
-- del payload WooCommerce: "subtotal" e' prima del codice, "total" dopo,
-- e la differenza e' lo sconto ottenuto dall'allievo su quella riga.
-- Il prodotto di oggi si riconosce dal codice del sito (product_id o
-- variation_id), oppure da SKU e nome per i prodotti ricreati.
-- Applicata via MCP il 16/09/2026.
create or replace view woo_ordini_con_codice as
select v.id as vendita_id,
       v.numero_ordine,
       v.data_ordine::date as data,
       v.cliente_nome as cliente,
       v.stato,
       coalesce(v.totale, 0) as totale,
       lower(trim(cl.value ->> 'code')) as codice,
       coalesce(nullif(cl.value ->> 'discount', '')::numeric, 0) + coalesce(nullif(cl.value ->> 'discount_tax', '')::numeric, 0) as sconto,
       (select jsonb_agg(jsonb_build_object(
                 'woo_product_id', nullif(li ->> 'product_id', '')::int,
                 'woo_variation_id', nullif(nullif(li ->> 'variation_id', ''), '0')::int,
                 'sku', li ->> 'sku',
                 'nome', li ->> 'name',
                 'quantita', coalesce(nullif(li ->> 'quantity', '')::numeric, 0),
                 'subtotale', coalesce(nullif(li ->> 'subtotal', '')::numeric, 0),
                 'totale', coalesce(nullif(li ->> 'total', '')::numeric, 0)))
          from jsonb_array_elements(coalesce(v.payload_raw -> 'line_items', '[]'::jsonb)) li) as righe
from vendite_shop v
cross join lateral jsonb_array_elements(coalesce(v.payload_raw -> 'coupon_lines', '[]'::jsonb)) cl(value)
where v.origine = 'woocommerce' and v.simulazione = false
  and coalesce(v.stato, '') not in ('cancelled', 'failed', 'trash')
  and coalesce(v.tipo_movimento, 'vendita') = 'vendita';
grant select on woo_ordini_con_codice to anon, authenticated;

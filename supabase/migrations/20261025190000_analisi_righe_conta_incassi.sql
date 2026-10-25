-- La vista delle righe vendute dice anche se il prodotto CONTA come
-- incasso (25/10/2026). «Pelle sintetica Premium High Quality - 1pz» e'
-- un componente (conta_incassi = false): nelle righe entra 26 volte a
-- settembre per 17,44 € in tutto, e l'assistente lo dava come il piu'
-- venduto del mese. La pagina Analisi prodotti dell'app lo esclude da
-- sempre; adesso la vista porta il flag e il catalogo dice al modello di
-- escluderlo, cosi' i due conti partono dalla stessa regola.
-- Le due colonne si aggiungono IN CODA: create or replace su una vista
-- accetta solo questo.
create or replace view public.analisi_vendite_righe as
select v.id as vendita_id, v.numero_ordine,
  (v.data_ordine at time zone 'Europe/Rome')::date as data,
  extract(year from v.data_ordine at time zone 'Europe/Rome')::int as anno,
  extract(month from v.data_ordine at time zone 'Europe/Rome')::int as mese,
  case when v.origine = 'woocommerce' then 'shop online' else 'banco' end as canale,
  v.stato, coalesce(v.tipo_movimento, 'vendita') as tipo_movimento, v.metodo_pagamento,
  v.operatore_nome as operatore,
  c.nome as corso, coalesce(cd.citta, l.citta, l.nome) as citta, e.nome as evento,
  coalesce(p.nome, r->>'nome') as prodotto, p.sku, cat.nome as categoria,
  coalesce((r->>'quantita')::numeric, 1) as quantita,
  coalesce((r->>'totale_riga')::numeric, (r->>'prezzo_unitario')::numeric * coalesce((r->>'quantita')::numeric, 1), 0) as totale_riga,
  (r->>'sconto_riga')::numeric as sconto_riga,
  p.costo_acquisto,
  case when p.costo_acquisto is not null
       then coalesce((r->>'totale_riga')::numeric, (r->>'prezzo_unitario')::numeric * coalesce((r->>'quantita')::numeric, 1), 0) - p.costo_acquisto * coalesce((r->>'quantita')::numeric, 1)
  end as margine_stimato,
  coalesce(p.conta_incassi, true) as conta_incassi,
  p.tipo_prodotto
from vendite_shop v
cross join lateral jsonb_array_elements(coalesce(v.prodotti, '[]'::jsonb)) r
left join corsi_date cd on cd.id = v.corso_data_id
left join corsi c on c.id = cd.corso_id
left join location l on l.id = cd.location_id
left join eventi e on e.id = v.evento_id
left join lateral (
  select ps.* from prodotti_shop ps
  where (nullif(r->>'prodotto_id','') is not null and ps.id = (r->>'prodotto_id')::uuid)
     or (nullif(r->>'woo_product_id','') is not null and ps.woo_product_id = (r->>'woo_product_id')::int)
  limit 1
) p on true
left join lateral (
  select cp.nome from prodotti_categorie pc join categorie_prodotti cp on cp.id = pc.categoria_id
  where pc.prodotto_id = p.id order by pc.ordine limit 1
) cat on true
where coalesce(v.simulazione, false) = false;

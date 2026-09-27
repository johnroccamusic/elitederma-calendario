-- Il listino a blocchi: rifà v_prezzi_listini come la vuole la pagina
-- "Prezzi e listini" (brief del 27/09/2026).
--
-- Quattro numeri per prodotto: pubblico lordo, pubblico netto, sconto
-- massimo che si può concedere continuando a guadagnare bene, e il
-- prezzo che paga il rivenditore applicando quello sconto al netto.
--
-- LO SCONTO MASSIMO non è una percentuale decisa a tavolino: è quella
-- che divide il guadagno **a metà** fra te e il rivenditore. Ricavata
-- così — se cedi la quota d, tu incassi N(1−d), ci paghi il 15% di costi
-- aziendali e il costo della merce; perché a te resti quanto a lui:
--
--     N(1−d)(1−0,15) − C = dN     ->     d = (0,85N − C) / (1,85N)
--
-- Non è metà dello spazio cedibile totale, ed è la cosa che non torna a
-- occhio: sul tuo residuo paghi ancora i costi aziendali, lui no. Con
-- uno spazio totale del 66% la divisione alla pari è ~30,8%, non 33.
--
-- Si arrotonda per DIFETTO a passi di 5: meglio concedere un po' meno
-- del calcolabile che un po' di più, e vengono numeri che si dicono al
-- telefono. Sui 151 prodotti con un costo va da 3% a 44%.
--
-- I BLOCCHI seguono l'ordine del menu del sito. Un prodotto sta in un
-- blocco solo: si prende il primo che combacia, e "Colle e Primer" viene
-- prima di "Lash Extension" perché ne è figlia.
--
-- Restano fuori i prodotti che non sono in vendita sullo shop: senza
-- codice WooCommerce, non pubblicati, solo offline, vetrine, senza
-- prezzo, e le spese di spedizione.
create or replace view v_prezzi_listini
with (security_invoker = on) as
with impostazioni as (
  select chiave,
         case when (valore #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' then (valore #>> '{}')::numeric end as n
  from impostazioni_layout_tabelle
  where chiave in ('prezziListini_quotaVenditorePct',
                   'dettaglioProdotti_margineOperativoPct',
                   'puntiMaster_incidenzaCostiPct')
),
parametri as (
  select
    coalesce((select n from impostazioni where chiave = 'prezziListini_quotaVenditorePct'), 50) as quota_venditore_pct,
    coalesce((select n from impostazioni where chiave = 'dettaglioProdotti_margineOperativoPct'), 28) as costi_aziendali_pct,
    coalesce((select n from impostazioni where chiave = 'puntiMaster_incidenzaCostiPct'), 15) as sicurezza_pct
),
in_vendita as (
  select p.id, p.nome, coalesce(p.tipo_prodotto, 'semplice') as tipo, p.stato,
         p.woo_product_id, p.costo_acquisto, p.prezzo_vendita,
         coalesce(p.aliquota_iva_vendita, 22) as iva,
         p.quota_negoziante_pct
  from prodotti_shop p
  where p.woo_product_id is not null
    and p.stato = 'publish'
    and p.attivo is not false
    and p.solo_offline is not true
    and p.prezzo_vendita > 0
    and coalesce(p.tipo_prodotto, 'semplice') <> 'vetrina'
    and p.nome <> 'Spese di spedizione'
),
distinta as (
  select bc.bundle_id,
         sum(c.costo_acquisto * bc.quantita_per_bundle) as costo,
         count(*) as componenti,
         count(*) filter (where c.costo_acquisto is null or c.costo_acquisto = 0) as componenti_senza_costo
  from bundle_componenti bc
  join prodotti_shop c on c.id = bc.componente_id
  group by bc.bundle_id
),
-- le categorie WooCommerce di ogni prodotto, come insieme di numeri
cat as (
  select pc.prodotto_id, array_agg(c.woo_category_id) filter (where c.woo_category_id is not null) as woo_ids
  from prodotti_categorie pc
  join categorie_prodotti c on c.id = pc.categoria_id
  group by pc.prodotto_id
),
conto as (
  select v.*, par.costi_aziendali_pct, par.sicurezza_pct, par.quota_venditore_pct,
         d.componenti, d.componenti_senza_costo,
         coalesce(cat.woo_ids, '{}') as woo_cats,
         case
           when v.tipo = 'bundle' then
             case when d.componenti is null or d.componenti_senza_costo > 0 or d.costo is null or d.costo = 0
                  then null else d.costo end
           else nullif(v.costo_acquisto, 0)
         end as costo
  from in_vendita v
  cross join parametri par
  left join distinta d on d.bundle_id = v.id
  left join cat on cat.prodotto_id = v.id
),
blocchi as (
  select c.*,
    case
      when 99 = any(woo_cats) then 2
      when woo_cats && array[31,32,33,34,35,87,88] then 1
      when 39 = any(woo_cats) then 3
      when woo_cats && array[41,79]    then 4
      when woo_cats && array[36,37,38] then 5
      when 89 = any(woo_cats) then 6
      when 63 = any(woo_cats) then 7
      when 90 = any(woo_cats) then 8
      when 64 = any(woo_cats) then 9
      when 57 = any(woo_cats) then 10
      when 55 = any(woo_cats) then 11
      when 97 = any(woo_cats) then 12
      else 99
    end as blocco_ordine
  from conto c
),
calcolato as (
  select b.*,
    case when b.costo is not null and b.prezzo_vendita > 0
         then greatest(0, ((1 - b.sicurezza_pct/100.0) * b.prezzo_vendita - b.costo)
                           / ((1 + (1 - b.sicurezza_pct/100.0)) * b.prezzo_vendita) * 100)
    end as sconto_esatto_pct
  from blocchi b
)
select
  id, nome, tipo, stato, woo_product_id, woo_cats,
  blocco_ordine,
  case blocco_ordine
    when 1 then 'PIGMENTI' when 2 then 'COLLE DA EXTENSIONS' when 3 then 'DERMOGRAFI'
    when 4 then 'AGHI' when 5 then 'MICROBLADING' when 6 then 'LASH EXTENSION'
    when 7 then 'LAMINAZIONE' when 8 then 'HENNE' when 9 then 'NEEDLING'
    when 10 then 'PROGETTAZIONE' when 11 then 'ACCESSORI' when 12 then 'WEAR & ACC'
    else 'ALTRI PRODOTTI' end as blocco,
  costo                                                        as costo_acquisto,
  componenti                                                   as componenti_distinta,
  componenti_senza_costo,
  round(prezzo_vendita * (1 + iva / 100.0), 2)                  as pubblico_lordo,
  round(prezzo_vendita, 2)                                      as pubblico_netto,
  -- per difetto a passi di 5, e mai sopra il 50%: oltre si esce dal
  -- "buon guadagno" e si entra nella trattativa, che non è un listino
  case when sconto_esatto_pct is not null
       then least(50, floor(sconto_esatto_pct / 5) * 5) end     as sconto_max_pct,
  case when sconto_esatto_pct is not null
       then round(prezzo_vendita * (1 - least(50, floor(sconto_esatto_pct / 5) * 5) / 100.0), 2) end as prezzo_rivenditore,
  round(sconto_esatto_pct, 1)                                   as sconto_esatto_pct,
  iva                                                           as aliquota_iva,
  costi_aziendali_pct, sicurezza_pct
from calcolato;

comment on view v_prezzi_listini is
  'Listino a blocchi (27/09/2026). Sconto massimo = la quota che divide il guadagno a meta'' fra azienda e rivenditore, per difetto a passi di 5. Solo prodotti in vendita sullo shop.';

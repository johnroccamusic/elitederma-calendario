-- Il listino per i venditori, separato dal prezzo dello shop.
--
-- La regola, dettata dal titolare il 26/09/2026: al venditore va il 50%
-- del listino. L'altro 50% e' quello che incassa l'azienda, e su quello
-- stanno il 28% di costi aziendali e il 15% di margine di sicurezza.
-- Quindi al costo della merce resta il 57% di meta' listino, cioe' il
-- 28,5% del listino:
--
--   listino netto = costo / ((1 - quota venditore) x (1 - costi - sicurezza))
--                 = costo / (0,50 x 0,57) = costo / 0,285 = 3,51 volte il costo
--
-- Verificato sull'esempio dato: Mixer per pigmenti 5 punte, costo 2,71 ->
-- 9,51 netto, 11,60 IVA inclusa, 4,75 al venditore. I tre numeri si
-- arrotondano tutti dal listino ESATTO, non uno dall'altro: arrotondando
-- prima il listino, la quota veniva 4,76.
--
-- Questa view non scrive niente. Il prezzo dello shop resta dov'e': qui si
-- legge soltanto quanto dovrebbe costare perche' la regola stia in piedi.
create or replace view v_prezzi_listini
with (security_invoker = on) as
with impostazioni as (
  -- i parametri stanno in Impostazioni, non nel codice. Il valore e' jsonb:
  -- si legge solo se e' davvero un numero, altrimenti vale il predefinito
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
    -- le due percentuali aziendali sono quelle che l'app usa gia' in
    -- Dettaglio prodotti: una sola verita', non due che divergono sui soldi.
    -- Nella formula conta solo la loro somma, quindi i nomi incrociati
    -- (nell'app 28 sta su "margine operativo" e 15 su "incidenza costi")
    -- non cambiano il risultato
    coalesce((select n from impostazioni where chiave = 'dettaglioProdotti_margineOperativoPct'), 28) as costi_aziendali_pct,
    coalesce((select n from impostazioni where chiave = 'puntiMaster_incidenzaCostiPct'), 15) as sicurezza_pct
),
pubblicati as (
  select p.id, p.nome, coalesce(p.tipo_prodotto, 'semplice') as tipo, p.stato,
         p.woo_product_id, p.costo_acquisto, p.prezzo_vendita,
         coalesce(p.aliquota_iva_vendita, 22) as iva,
         p.quota_negoziante_pct
  from prodotti_shop p
  where p.woo_product_id is not null
    and p.attivo is not false
    and coalesce(p.tipo_prodotto, 'semplice') <> 'vetrina'
    and p.nome <> 'Spese di spedizione'
),
distinta as (
  -- il costo di un bundle sta nella sua distinta, mai sulla sua riga.
  -- Se un solo componente non ha un costo la somma e' una bugia: si
  -- conta quanti sono e piu' sopra il costo diventa nullo
  select bc.bundle_id,
         sum(c.costo_acquisto * bc.quantita_per_bundle) as costo,
         count(*) as componenti,
         count(*) filter (where c.costo_acquisto is null or c.costo_acquisto = 0) as componenti_senza_costo
  from bundle_componenti bc
  join prodotti_shop c on c.id = bc.componente_id
  group by bc.bundle_id
),
conto as (
  select b.*, par.quota_venditore_pct, par.costi_aziendali_pct, par.sicurezza_pct,
         d.componenti, d.componenti_senza_costo,
         -- la quota del singolo prodotto vince sul predefinito, se c'e'
         coalesce(b.quota_negoziante_pct, par.quota_venditore_pct) as quota_usata,
         case
           when b.tipo = 'bundle' then
             case when d.componenti is null or d.componenti_senza_costo > 0 or d.costo is null or d.costo = 0
                  then null else d.costo end
           else nullif(b.costo_acquisto, 0)
         end as costo
  from pubblicati b
  cross join parametri par
  left join distinta d on d.bundle_id = b.id
),
esatto as (
  select c.*,
         (1 - coalesce(c.quota_usata, 0) / 100.0) * (1 - (c.costi_aziendali_pct + c.sicurezza_pct) / 100.0) as divisore
  from conto c
),
calcolato as (
  select e.*,
         case when e.costo is not null and e.divisore > 0 then e.costo / e.divisore end as listino_esatto
  from esatto e
)
select
  id, nome, tipo, stato, woo_product_id,
  costo                                                         as costo_acquisto,
  componenti                                                    as componenti_distinta,
  componenti_senza_costo,
  round(listino_esatto, 2)                                      as listino_netto,
  round(listino_esatto * (1 + iva / 100.0), 2)                   as listino_ivato,
  round(listino_esatto * coalesce(quota_usata, 0) / 100.0, 2)    as quota_venditore,
  prezzo_vendita                                                as prezzo_shop_netto,
  round(prezzo_vendita * (1 + iva / 100.0), 2)                   as prezzo_shop_ivato,
  -- scarto = quanto manca al prezzo dello shop per arrivare al listino.
  -- Positivo = lo shop e' SOTTO, cioe' su quel prodotto non si puo' dare
  -- la quota al venditore senza intaccare costi e sicurezza
  round(listino_esatto * (1 + iva / 100.0), 2)
    - round(prezzo_vendita * (1 + iva / 100.0), 2)               as scarto,
  case when costo is not null and costo > 0 then round(prezzo_vendita / costo, 2) end as moltiplicatore_attuale,
  case
    when costo is null then 'costo_mancante'
    when divisore is null or divisore <= 0 then 'parametri_impossibili'
    when round(prezzo_vendita * (1 + iva / 100.0), 2) < round(listino_esatto * (1 + iva / 100.0), 2) then 'sotto'
    else 'sopra'
  end                                                            as stato_prezzo,
  iva                                                            as aliquota_iva,
  quota_usata                                                    as quota_venditore_pct,
  (quota_negoziante_pct is not null)                             as quota_propria,
  costi_aziendali_pct, sicurezza_pct
from calcolato;

comment on view v_prezzi_listini is
  'Listino per i venditori (27/09/2026). Sola lettura: costo / ((1-quota)x(1-costi-sicurezza)). I parametri stanno in impostazioni_layout_tabelle; quota_negoziante_pct sul prodotto vince sul predefinito.';

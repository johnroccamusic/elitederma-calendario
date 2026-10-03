-- La provvigione alla master diventa UN TERZO del margine del rivenditore,
-- e si puo' scrivere a mano prodotto per prodotto.
--
-- LA REGOLA (03/10/2026). Prima era il 15% del margine secco, un conto
-- buono in media ma che non si legge: nessuno sa a mente quanto sia il
-- 15% del margine di un pigmento. Un terzo dello sconto che prende un
-- rivenditore si dice e si verifica a voce — rivenditore al 30%, master
-- al 10% — e tiene in piedi la differenza che conta: chi compra e
-- rischia prende tre volte chi vende e basta.
--
-- Resta una percentuale SUL NETTO: il lordo contiene l'IVA, che non e'
-- mai tua, e pagarci sopra una provvigione vuol dire pagarla sui soldi
-- dello Stato.
--
-- A MANO. La regola e' un punto di partenza, non una legge: su un
-- prodotto che si vuole spingere, o su uno dove il margine e' gia'
-- sottile, la cifra la si decide. prodotti_shop.provvigione_master_pct
-- tiene la scelta a mano; vuota, vale il terzo calcolato.
alter table prodotti_shop
  add column if not exists provvigione_master_pct numeric;

comment on column prodotti_shop.provvigione_master_pct is
  'Provvigione alla master scritta a mano, in percentuale sul prezzo netto. Vuota = un terzo dello sconto massimo del rivenditore.';

create or replace view v_prezzi_listini
with (security_invoker = on) as
with impostazioni as (
  select chiave,
         case when (valore #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$' then (valore #>> '{}')::numeric end as n
  from impostazioni_layout_tabelle
  where chiave in ('dettaglioProdotti_margineOperativoPct',
                   'puntiMaster_incidenzaCostiPct',
                   'listino_imposteRedditoPct',
                   'listino_quotaMasterSulMarginePct')
),
parametri as (
  select
    coalesce((select n from impostazioni where chiave = 'dettaglioProdotti_margineOperativoPct'), 28) as costi_aziendali_pct,
    coalesce((select n from impostazioni where chiave = 'puntiMaster_incidenzaCostiPct'), 15) as sicurezza_pct,
    coalesce((select n from impostazioni where chiave = 'listino_imposteRedditoPct'), 27.9) as imposte_pct,
    coalesce((select n from impostazioni where chiave = 'listino_quotaMasterSulMarginePct'), 15) as quota_master_pct
),
in_vendita as (
  select p.id, p.nome, coalesce(p.tipo_prodotto, 'semplice') as tipo, p.stato,
         p.woo_product_id, p.costo_acquisto, p.prezzo_vendita,
         coalesce(p.aliquota_iva_vendita, 22) as iva
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
foto as (
  select distinct on (prodotto_id) prodotto_id, url
  from prodotti_immagini order by prodotto_id, ordine
),
cat as (
  select pc.prodotto_id, array_agg(c.woo_category_id) filter (where c.woo_category_id is not null) as woo_ids
  from prodotti_categorie pc
  join categorie_prodotti c on c.id = pc.categoria_id
  group by pc.prodotto_id
),
conto as (
  select v.*, par.costi_aziendali_pct, par.sicurezza_pct, par.imposte_pct, par.quota_master_pct,
         d.componenti, d.componenti_senza_costo,
         coalesce(cat.woo_ids, '{}') as woo_cats,
         foto.url as foto_url,
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
  left join foto on foto.prodotto_id = v.id
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
    end as sconto_esatto
  from blocchi b
),
prezzi as (
  select c.*,
    case when c.sconto_esatto is not null then least(50, floor(c.sconto_esatto / 5) * 5) end as sconto_pct
  from calcolato c
),
utili as (
  select p.*,
    case when p.costo is not null then p.prezzo_vendita * (1 - p.sicurezza_pct/100.0) - p.costo end as utile_diretto,
    case when p.costo is not null and p.sconto_pct is not null
         then p.prezzo_vendita * (1 - p.sconto_pct/100.0) * (1 - p.sicurezza_pct/100.0) - p.costo end as utile_riv,
    case when p.costo is not null then greatest(0, p.prezzo_vendita - p.costo) end as margine_secco
  from prezzi p
),
-- la scelta a mano si pesca qui invece di passarla di CTE in CTE: un
-- terzo dello sconto del rivenditore, salvo quello scritto a mano
amano as (
  select u.*,
    (select ps.provvigione_master_pct from prodotti_shop ps where ps.id = u.id) as master_a_mano,
    coalesce((select ps.provvigione_master_pct from prodotti_shop ps where ps.id = u.id),
             case when u.sconto_pct is not null then round(u.sconto_pct / 3.0, 1) end) as master_pct
  from utili u
)
select
  id, nome, tipo, woo_product_id, blocco_ordine, foto_url,
  case blocco_ordine
    when 1 then 'PIGMENTI' when 2 then 'COLLE DA EXTENSIONS' when 3 then 'DERMOGRAFI'
    when 4 then 'AGHI' when 5 then 'MICROBLADING' when 6 then 'LASH EXTENSION'
    when 7 then 'LAMINAZIONE' when 8 then 'HENNE' when 9 then 'NEEDLING'
    when 10 then 'PROGETTAZIONE' when 11 then 'ACCESSORI' when 12 then 'WEAR & ACC'
    else 'ALTRI PRODOTTI' end as blocco,
  costo as costo_acquisto,
  componenti as componenti_distinta,
  componenti_senza_costo,
  round(prezzo_vendita * (1 + iva / 100.0), 2) as pubblico_lordo,
  round(prezzo_vendita, 2)                     as pubblico_netto,
  sconto_pct                                   as sconto_max_pct,
  case when sconto_pct is not null then round(prezzo_vendita * (1 - sconto_pct/100.0), 2) end as prezzo_rivenditore,
  round(utile_diretto, 2) as utile_diretto,
  round(utile_riv, 2)     as utile_rivenditore,
  round(case when utile_diretto > 0 then utile_diretto * (1 - imposte_pct/100.0) else utile_diretto end, 2) as ti_resta_diretto,
  round(case when utile_riv > 0 then utile_riv * (1 - imposte_pct/100.0) else utile_riv end, 2) as ti_resta_rivenditore,
  round(sconto_esatto, 1) as sconto_esatto_pct,
  iva as aliquota_iva,
  costi_aziendali_pct, sicurezza_pct, imposte_pct,
  -- gli euro seguono la percentuale, non piu' il margine: la percentuale
  -- e' la cifra che si decide, e l'importo e' la sua conseguenza
  round(prezzo_vendita * master_pct / 100.0, 2) as provvigione_master_euro,
  master_pct                                    as provvigione_master_pct,
  quota_master_pct,
  -- le colonne nuove vanno IN FONDO: create or replace non sa inserirle
  -- in mezzo, si rifiuta con "cannot change name of view column"
  (master_a_mano is not null)                   as provvigione_master_manuale,
  margine_secco                                 as margine_secco
from amano;

comment on view v_prezzi_listini is
  'Listino a blocchi. Sconto massimo = la quota che divide il guadagno a meta'' fra azienda e rivenditore. provvigione_master_pct = un terzo di quello sconto, in percentuale sul netto, salvo il valore scritto a mano in prodotti_shop.provvigione_master_pct (03/10/2026).';

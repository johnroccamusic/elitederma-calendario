-- La provvigione che si puo' riconoscere a una master che vende un
-- prodotto al corso.
--
-- NON E' UN RIVENDITORE, e il numero non c'entra niente con lo sconto
-- massimo. Un rivenditore compra: anticipa i soldi, si porta la merce, si
-- tiene l'invenduto. Una master vende la tua merce, al tuo prezzo, dentro
-- un corso che paghi tu — sede, suo compenso, allievi — e l'incasso ti
-- arriva intero. Non rischia niente, quindi non prende come chi rischia.
--
-- Si calcola sul MARGINE (netto meno costo d'acquisto), che e' la stessa
-- base delle provvigioni sulle vendite: pagare sul prezzo vorrebbe dire
-- pagare anche sul costo della merce.
--
-- Il 15% viene dal conto fatto sui corsi veri (01/10/2026): a un corso si
-- vendono in media 409 euro di prodotti, 209 di margine. Il 15% fa 31 euro
-- a corso, circa il 5% di quello che la master gia' prende di compenso:
-- si vede abbastanza da far venire voglia di proporre il prodotto, non
-- abbastanza da somigliare a una fetta di utile. Alla pari con un
-- rivenditore sarebbe il 40%, ed e' esattamente quello che non si vuole.
--
-- In pagina si mostra come PERCENTUALE SUL NETTO, perche' il lordo
-- contiene l'IVA — che non e' mai tua, e pagarci sopra una provvigione
-- vuol dire pagarla sui soldi dello Stato.
--
-- Il 15 e' un parametro: si cambia da impostazioni_layout_tabelle con la
-- chiave listino_quotaMasterSulMarginePct, senza toccare questa vista.
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
  where p.woo_product_id is not null and p.stato = 'publish' and p.attivo is not false
    and p.solo_offline is not true and p.prezzo_vendita > 0
    and coalesce(p.tipo_prodotto, 'semplice') <> 'vetrina' and p.nome <> 'Spese di spedizione'
),
foto as (
  select distinct on (prodotto_id) prodotto_id, url from prodotti_immagini order by prodotto_id, ordine
),
distinta as (
  select bc.bundle_id, sum(c.costo_acquisto * bc.quantita_per_bundle) as costo,
         count(*) as componenti,
         count(*) filter (where c.costo_acquisto is null or c.costo_acquisto = 0) as componenti_senza_costo
  from bundle_componenti bc join prodotti_shop c on c.id = bc.componente_id group by bc.bundle_id
),
cat as (
  select pc.prodotto_id, array_agg(c.woo_category_id) filter (where c.woo_category_id is not null) as woo_ids
  from prodotti_categorie pc join categorie_prodotti c on c.id = pc.categoria_id group by pc.prodotto_id
),
conto as (
  select v.*, par.costi_aziendali_pct, par.sicurezza_pct, par.imposte_pct, par.quota_master_pct,
         d.componenti, d.componenti_senza_costo,
         coalesce(cat.woo_ids, '{}') as woo_cats, foto.url as foto_url,
         case when v.tipo = 'bundle' then
                case when d.componenti is null or d.componenti_senza_costo > 0 or d.costo is null or d.costo = 0
                     then null else d.costo end
              else nullif(v.costo_acquisto, 0) end as costo
  from in_vendita v cross join parametri par
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
    -- il margine secco, senza costi aziendali: e' la base su cui si
    -- calcolano tutte le provvigioni, qui come in Definizione provvigioni
    case when p.costo is not null then greatest(0, p.prezzo_vendita - p.costo) end as margine_secco
  from prezzi p
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
  -- Le colonne nuove vanno IN FONDO: `create or replace view` non sa
  -- inserirle in mezzo, si rifiuta con "cannot change name of view column".
  --
  -- Quanto puoi riconoscere a una master, in euro e come percentuale del
  -- NETTO — il lordo contiene l'IVA, che non e' tua.
  round(margine_secco * quota_master_pct / 100.0, 2) as provvigione_master_euro,
  case when margine_secco is not null and prezzo_vendita > 0
       then round(margine_secco * quota_master_pct / 100.0 / prezzo_vendita * 100, 1) end as provvigione_master_pct,
  quota_master_pct
from utili;

comment on view v_prezzi_listini is
  'Listino a blocchi. Sconto massimo = la quota che divide il guadagno a meta'' fra azienda e rivenditore. provvigione_master_* = quota sul margine per una master che vende al corso, mostrata in percentuale sul netto (02/10/2026).';

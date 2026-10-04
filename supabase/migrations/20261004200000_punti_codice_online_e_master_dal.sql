-- I punti di un codice usato sullo SHOP, e da quando valgono per una master.
--
-- DUE COSE CHE NON TORNAVANO.
--
-- 1) Sugli ordini di WooCommerce `vendite_shop.codice_coupon` e' vuoto: su
--    4.157 vendite online risulta scritto 4 volte. Il codice c'e' ma sta
--    dentro al payload dell'ordine (`payload_raw -> coupon_lines`), ed e'
--    da li' che lo legge gia' `woo_ordini_con_codice`. La vista dei punti
--    guardava solo la colonna, quindi NESSUNA vendita online poteva essere
--    attribuita a una master: i movimenti che vedeva erano tutti del POS.
--    Ora il codice si prende dalla colonna e, quando e' vuota, dal
--    payload. Il filtro che tiene veloce la vista si allarga di
--    conseguenza: da 58 vendite a 892 candidate, che restano poche.
--
-- 2) "Da adesso i punti di quel codice sono suoi" non si poteva dire.
--    `coupon.master_id` vale da sempre, quindi assegnare una master a un
--    codice gia' girato le avrebbe regalato anche lo storico — e lo
--    storico di un codice promozionale non e' suo. `master_dal` mette una
--    data di inizio: prima di quella il codice non porta punti a nessuno.
--    Vuota = vale da sempre, come prima.
alter table coupon
  add column if not exists master_dal date;

comment on column coupon.master_dal is
  'Da quando i punti di questo codice vanno alla sua master. Vuota = da sempre.';

create or replace view v_punti_master_righe
with (security_invoker = on) as
with scaglioni as (
  select
    coalesce((i.valore->'soglie'->>0)::numeric, 60)  as soglia1,
    coalesce((i.valore->'soglie'->>1)::numeric, 120) as soglia2,
    coalesce((i.valore->'quote'->>0)::numeric, 100)  as quota1,
    coalesce((i.valore->'quote'->>1)::numeric, 100)  as quota2,
    coalesce((i.valore->'quote'->>2)::numeric, 100)  as quota3
  from (select null::jsonb as valore) vuoto
  left join impostazioni_layout_tabelle i on i.chiave = 'puntiNeedling_scaglioni'
),
vendite_master as (
  select v.id, v.numero_ordine, v.data_ordine, v.origine, v.metodo_pagamento,
         coalesce(v.tipo_movimento, 'vendita') as tipo_movimento,
         -- il codice davvero usato: la colonna quando c'e' (POS), altrimenti
         -- il primo delle coupon_lines dell'ordine (shop). Il primo e non
         -- tutti: due codici sullo stesso ordine sono rari, e dividere i
         -- punti fra due master sarebbe una regola che nessuno ha deciso.
         lower(nullif(trim(coalesce(
           nullif(v.codice_coupon, ''),
           (select trim(cl.value->>'code')
              from jsonb_array_elements(coalesce(v.payload_raw->'coupon_lines', '[]'::jsonb)) cl
             limit 1)
         )), '')) as codice_coupon,
         v.corso_data_id, v.prodotti, v.payload_raw,
         coalesce(
           case when v.operatore_tipo = 'master' then v.operatore_id end,
           (select c.master_id from coupon c
             where lower(c.codice) = lower(nullif(trim(coalesce(
                     nullif(v.codice_coupon, ''),
                     (select trim(cl.value->>'code')
                        from jsonb_array_elements(coalesce(v.payload_raw->'coupon_lines', '[]'::jsonb)) cl
                       limit 1)
                   )), ''))
               and (c.master_dal is null or v.data_ordine::date >= c.master_dal))
         ) as master_id
  from vendite_shop v
  where coalesce(v.simulazione, false) = false
    and v.prodotti is not null
    and coalesce(v.tipo_movimento, 'vendita') <> 'omaggio'
    and (v.operatore_tipo = 'master'
         or v.codice_coupon is not null
         or jsonb_array_length(coalesce(v.payload_raw->'coupon_lines', '[]'::jsonb)) > 0)
),
listino as (select * from v_prezzi_listini),
per_nome as (
  select distinct on (lower(nome)) lower(nome) as nome_min, id
  from prodotti_shop order by lower(nome), id
),
righe as (
  select vm.id as vendita_id, vm.numero_ordine, vm.data_ordine, vm.origine,
         vm.metodo_pagamento, vm.tipo_movimento, vm.codice_coupon, vm.corso_data_id,
         vm.master_id, t.r as riga,
         vm.payload_raw->'line_items'->(t.n::int - 1) as riga_woo
  from vendite_master vm, lateral jsonb_array_elements(vm.prodotti) with ordinality t(r, n)
  where vm.master_id is not null
),
agganciate as (
  select x.*,
    coalesce(
      nullif(x.riga->>'prodotto_id','')::uuid,
      (select p.id from prodotti_shop p where p.woo_product_id = nullif(x.riga->>'woo_product_id','')::int),
      (select pn.id from per_nome pn where pn.nome_min = lower(x.riga->>'nome'))
    ) as prodotto_id,
    greatest(1, coalesce(nullif(x.riga->>'quantita','')::numeric, 1)) as quantita,
    nullif(x.riga->>'totale_riga','')::numeric      as totale_riga,
    nullif(x.riga->>'prezzo_listino','')::numeric   as prezzo_listino_pos,
    nullif(x.riga->>'prezzo_unitario','')::numeric  as prezzo_unitario_netto,
    case when (x.riga_woo->>'name') = (x.riga->>'nome')
         then nullif(x.riga_woo->>'subtotal','')::numeric end as subtotal_woo
  from righe x
),
prezzata as (
  select a.*, l.nome as prodotto, l.sconto_max_pct, l.aliquota_iva, l.blocco, l.blocco_ordine,
    case when a.origine = 'pos' then coalesce(a.prezzo_listino_pos, a.totale_riga / a.quantita)
         else coalesce(a.subtotal_woo / a.quantita, a.prezzo_unitario_netto) * (1 + coalesce(l.aliquota_iva, 22)/100.0) end as lordo_allora,
    case when a.origine = 'pos' then coalesce(a.prezzo_listino_pos, a.totale_riga / a.quantita) / (1 + coalesce(l.aliquota_iva, 22)/100.0)
         else coalesce(a.subtotal_woo / a.quantita, a.prezzo_unitario_netto) end as netto_allora,
    (a.origine = 'pos' and a.metodo_pagamento in ('contanti','buono_amazon')) as e_cash,
    case when a.tipo_movimento in ('reso','annullamento') then -1 else 1 end as segno,
    case when a.origine = 'pos' and a.prezzo_listino_pos is not null then 'listino POS'
         when a.origine <> 'pos' and a.subtotal_woo is not null then 'subtotal Woo'
         else 'ripiego: totale di riga' end as fonte_prezzo
  from agganciate a
  left join listino l on l.id = a.prodotto_id
),
carrello as (
  select vendita_id, sum(lordo_allora * quantita) as totale_listino
  from prezzata group by vendita_id
),
quotata as (
  select p.*, c.totale_listino,
    case when p.blocco_ordine is distinct from 9 then 100
         when c.totale_listino < s.soglia1 then s.quota1
         when c.totale_listino < s.soglia2 then s.quota2
         else s.quota3 end as quota_punti_pct
  from prezzata p
  join carrello c on c.vendita_id = p.vendita_id
  cross join scaglioni s
)
select vendita_id, numero_ordine, data_ordine, origine, metodo_pagamento, tipo_movimento,
       codice_coupon, corso_data_id, master_id, prodotto_id, prodotto, blocco,
       quantita, sconto_max_pct, fonte_prezzo,
       round(lordo_allora, 4) as lordo_allora,
       round(netto_allora, 4) as netto_allora,
       e_cash,
       round(totale_listino, 2) as carrello_a_listino,
       quota_punti_pct,
       round(segno * quantita * (case when e_cash then lordo_allora else netto_allora end)
             * (sconto_max_pct / 100.0) * 2 * (quota_punti_pct / 100.0), 2) as punti
from quotata
where sconto_max_pct is not null;

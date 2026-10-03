-- I punti delle master, dalle vendite che le sono attribuite.
--
-- DUE RIQUADRI, divisi per COME si e' pagato e non per dove si e' passati:
--
--   SHOP/POS  shop online, bancomat, carta, link Stripe
--             base: il prezzo NETTO del giorno della vendita
--   CASH      contanti e buono Amazon battuti dal POS
--             base: il prezzo LORDO — senza fattura l'IVA non si scorpora
--             e quello che entra e' il prezzo intero
--
-- LA FORMULA e' quella del listino privato: prezzo x sconto massimo x 2.
-- Il prezzo e' quello DEL GIORNO DELLA VENDITA, letto dalla riga
-- dell'ordine: un pigmento venduto a 39,90 vale i punti di 39,90 anche se
-- oggi sta a 44,90. Lo sconto massimo invece e' quello di oggi, perche'
-- dei costi d'acquisto non esiste storico.
--
-- DOVE STA IL PREZZO DI ALLORA. Sono due posti diversi e due facce
-- diverse della stessa medaglia:
--   POS     `totale_riga` e' LORDO (44,90 scontato del 20% = 35,92)
--   online  `prezzo_unitario` e' NETTO e gia' ridotto dal coupon
-- Entrambi si riportano a netto e lordo con l'IVA del prodotto.
--
-- A CHI VANNO. Se la vendita l'ha battuta una master dal suo POS, sono
-- sue (operatore_id). Altrimenti si guarda il codice sconto usato e si
-- risale alla master dal coupon — vale sia per il codice d'aula sia per
-- il referral personale.
--
-- Resi e annullamenti tolgono i punti che avevano dato; gli omaggi non ne
-- danno, perche' non incassano niente.
create or replace view v_punti_master_righe
with (security_invoker = on) as
with righe as (
  select v.id as vendita_id, v.numero_ordine, v.data_ordine, v.origine,
         v.metodo_pagamento, coalesce(v.tipo_movimento,'vendita') as tipo_movimento,
         v.codice_coupon, v.operatore_tipo, v.operatore_id, v.corso_data_id,
         r as riga
  from vendite_shop v, lateral jsonb_array_elements(v.prodotti) r
  where coalesce(v.simulazione, false) = false
    and v.prodotti is not null
    and coalesce(v.tipo_movimento,'vendita') <> 'omaggio'
),
agganciate as (
  select x.*,
    coalesce(
      (select p.id from prodotti_shop p where p.id = nullif(x.riga->>'prodotto_id','')::uuid),
      (select p.id from prodotti_shop p where p.woo_product_id = nullif(x.riga->>'woo_product_id','')::int),
      (select p.id from prodotti_shop p where lower(p.nome) = lower(x.riga->>'nome') limit 1)
    ) as prodotto_id,
    greatest(1, coalesce(nullif(x.riga->>'quantita','')::numeric, 1)) as quantita,
    nullif(x.riga->>'totale_riga','')::numeric     as totale_riga,
    nullif(x.riga->>'prezzo_unitario','')::numeric as prezzo_unitario_netto
  from righe x
),
prezzata as (
  select a.*,
    l.nome as prodotto, l.sconto_max_pct, l.aliquota_iva, l.blocco,
    case when a.origine = 'pos' then a.totale_riga / a.quantita
         else a.prezzo_unitario_netto * (1 + coalesce(l.aliquota_iva,22)/100.0) end as lordo_allora,
    case when a.origine = 'pos' then (a.totale_riga / a.quantita) / (1 + coalesce(l.aliquota_iva,22)/100.0)
         else a.prezzo_unitario_netto end as netto_allora,
    (a.origine = 'pos' and a.metodo_pagamento in ('contanti','buono_amazon')) as e_cash,
    case when a.tipo_movimento in ('reso','annullamento') then -1 else 1 end as segno,
    coalesce(
      case when a.operatore_tipo = 'master' then a.operatore_id end,
      (select c.master_id from coupon c where lower(c.codice) = lower(a.codice_coupon))
    ) as master_id
  from agganciate a
  left join v_prezzi_listini l on l.id = a.prodotto_id
)
select vendita_id, numero_ordine, data_ordine, origine, metodo_pagamento, tipo_movimento,
       codice_coupon, corso_data_id, master_id, prodotto_id, prodotto, blocco,
       quantita, sconto_max_pct,
       round(lordo_allora, 4) as lordo_allora,
       round(netto_allora, 4) as netto_allora,
       e_cash,
       round(segno * quantita * (case when e_cash then lordo_allora else netto_allora end)
             * (sconto_max_pct / 100.0) * 2, 2) as punti
from prezzata
where master_id is not null and sconto_max_pct is not null;

create or replace view v_punti_master
with (security_invoker = on) as
select r.master_id, m.nome as master,
       round(sum(r.punti) filter (where not r.e_cash), 2) as punti_shop_pos,
       round(sum(r.punti) filter (where r.e_cash), 2)     as punti_cash,
       round(sum(r.punti), 2)                             as punti_totali,
       count(distinct r.vendita_id)                       as vendite,
       round(sum(r.quantita), 0)                          as pezzi,
       min(r.data_ordine)::date as prima_vendita,
       max(r.data_ordine)::date as ultima_vendita
from v_punti_master_righe r
join master m on m.id = r.master_id
group by r.master_id, m.nome;

comment on view v_punti_master is
  'Punti per master, divisi fra SHOP/POS (shop online, bancomat, carta, Stripe: base netta) e CASH (contanti e buono Amazon dal POS: base lorda). Formula del listino privato: prezzo del giorno della vendita x sconto massimo x 2 (03/10/2026).';

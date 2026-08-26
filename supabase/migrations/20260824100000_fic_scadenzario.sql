-- ============================================================================
-- Scadenzario: quanto resta DAVVERO da pagare
--
--   da pagare = totale fattura - note di credito abbinate - pagamenti registrati
--
-- Fatture in Cloud tiene le rate dentro il campo payments_list del documento.
-- Qui le tiriamo fuori dal JSON e le rendiamo interrogabili.
-- ============================================================================

-- Una riga per ogni rata/scadenza di ogni documento
create or replace view fic_scadenze as
select
  d.company_id,
  d.direzione,
  d.fic_id,
  d.numero,
  d.controparte,
  d.piva,
  (p.ord - 1)                                        as rata,
  nullif(p.val->>'due_date','')::date                as scadenza,
  nullif(p.val->>'paid_date','')::date               as pagata_il,
  coalesce((p.val->>'amount')::numeric, 0)           as importo,
  coalesce(p.val->>'status','not_paid')              as stato_fic,
  -- pagata se c'e' la data di incasso oppure lo stato lo dice
  (nullif(p.val->>'paid_date','') is not null
   or lower(coalesce(p.val->>'status','')) = 'paid') as pagata
from fic_documenti d
cross join lateral jsonb_array_elements(
         case when jsonb_typeof(d.raw->'payments_list') = 'array'
              then d.raw->'payments_list' else '[]'::jsonb end
       ) with ordinality as p(val, ord)
where d.tipo in ('invoice','expense');

-- Sostituisce la vista della migration precedente: ora tiene conto ANCHE dei pagamenti.
-- Cambiano le colonne, quindi va ricreata da zero.
drop view if exists fic_da_pagare;
drop view if exists fic_anomalie_pagamenti;
drop view if exists fic_fatture_residuo;

create view fic_fatture_residuo as
select
  d.company_id, d.direzione, d.fic_id, d.numero, d.data, d.controparte, d.piva,
  d.totale,
  coalesce(nc.abbattuto, 0)                                    as abbattuto,   -- note di credito
  coalesce(pg.pagato, 0)                                       as pagato,      -- rate incassate
  d.totale - coalesce(nc.abbattuto,0)                          as residuo,     -- al netto delle NC
  d.totale - coalesce(nc.abbattuto,0) - coalesce(pg.pagato,0)  as da_pagare,   -- il numero vero
  pg.prossima_scadenza
from fic_documenti d
left join lateral (
  select sum(importo) as abbattuto
  from fic_riconciliazioni r
  where r.company_id = d.company_id and r.direzione = d.direzione and r.fattura_id = d.fic_id
) nc on true
left join lateral (
  select sum(importo) filter (where pagata)          as pagato,
         min(scadenza) filter (where not pagata)     as prossima_scadenza
  from fic_scadenze s
  where s.company_id = d.company_id and s.direzione = d.direzione and s.fic_id = d.fic_id
) pg on true
where d.tipo in ('invoice','expense');

-- Lo scadenzario operativo: cosa devo pagare, e quando
create view fic_da_pagare as
select *,
       case
         when da_pagare <= 0.009                              then 'chiusa'
         when prossima_scadenza is null                       then 'senza_scadenza'
         when prossima_scadenza < current_date                then 'scaduta'
         when prossima_scadenza <= current_date + 7           then 'in_scadenza'
         else 'futura'
       end as stato,
       case when prossima_scadenza < current_date
            then current_date - prossima_scadenza end as giorni_di_ritardo
from fic_fatture_residuo
where da_pagare > 0.009;

-- Controllo di coerenza: fatture che risultano pagate PIU' del dovuto.
-- Quasi sempre significa una nota di credito abbinata due volte, o un pagamento
-- registrato su FIC che non tiene conto della nota. Da guardare a mano.
create view fic_anomalie_pagamenti as
select company_id, direzione, fic_id, numero, controparte, totale,
       abbattuto, pagato, da_pagare
from fic_fatture_residuo
where da_pagare < -0.009;

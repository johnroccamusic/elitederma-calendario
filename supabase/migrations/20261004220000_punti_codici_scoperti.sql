-- "Codici senza padrone": le vendite con un codice che non ha dato punti.
--
-- PERCHE'. Un punto che non arriva non si vede. Non compare da nessuna
-- parte, non alza nessun errore, e l'assenza non si nota finche' non
-- protesta la master — cioe' mesi dopo, quando rimettere le mani nello
-- storico costa dieci volte tanto. La catena che porta un codice ai punti
-- attraversa l'app, WooCommerce e il listino privato: tre posti dove si
-- puo' scollegare qualcosa senza che nessuno se ne accorga.
--
-- Questa vista elenca quelle vendite con il motivo accanto. In condizioni
-- normali e' VUOTA, ed e' il suo stato giusto: serve a far rumore solo
-- quando qualcosa si rompe.
--
-- LE ESCLUSIONI. I codici automatici di YITH per i punti fedelta'
-- (`ywpar_discount_...`), `master20` e i coupon automatici del sito non
-- devono dare punti per natura, e senza escluderli la tabella sarebbe
-- sempre piena. Un allarme che suona sempre
-- e' un allarme spento: la stessa lezione dei tre errori fissi
-- dell'allineamento margini. I modelli stanno in
-- impostazioni_layout_tabelle -> puntiMaster_codiciDaIgnorare, non nel
-- codice, perche' ne arriveranno altri.
insert into impostazioni_layout_tabelle (chiave, valore)
values ('puntiMaster_codiciDaIgnorare',
        '["ywpar_discount_%", "master20", "d7mq-v0om-pwgk", "6ttr5mkf", "kavv-8r3o-84gg"]'::jsonb)
on conflict (chiave) do nothing;

create or replace view v_punti_codici_scoperti
with (security_invoker = on) as
with soglia as (
  select coalesce((i.valore #>> '{}')::date, date '2026-09-01') as dal
  from (select null::jsonb as valore) vuoto
  left join impostazioni_layout_tabelle i on i.chiave = 'puntiMaster_codiciDal'
),
da_ignorare as (
  select coalesce(
           (select array_agg(x) from impostazioni_layout_tabelle i,
                  lateral jsonb_array_elements_text(i.valore) x
             where i.chiave = 'puntiMaster_codiciDaIgnorare'
               and jsonb_typeof(i.valore) = 'array'),
           array['ywpar_discount_%']
         ) as modelli
),
vendite as (
  select v.id, v.numero_ordine, v.data_ordine, v.origine, v.totale, v.cliente_nome,
         lower(nullif(trim(coalesce(
           nullif(v.codice_coupon, ''),
           (select trim(cl.value->>'code')
              from jsonb_array_elements(coalesce(v.payload_raw->'coupon_lines', '[]'::jsonb)) cl
             limit 1)
         )), '')) as codice
  from vendite_shop v
  where coalesce(v.simulazione, false) = false
    and coalesce(v.tipo_movimento, 'vendita') = 'vendita'
    and v.prodotti is not null
)
select v.id as vendita_id, v.numero_ordine, v.data_ordine::date as data, v.origine,
       v.codice, v.totale, v.cliente_nome,
       case
         when c.id is null then 'il codice non e'' registrato nell''app'
         when c.master_id is null then 'il codice non ha una master'
         when coalesce(c.master_dal, c.created_at::date) < s.dal then 'codice nato prima della soglia'
         when v.data_ordine::date < coalesce(c.master_dal, c.created_at::date) then 'vendita precedente all''assegnazione del codice'
         else 'nessun prodotto del listino privato in questa vendita'
       end as motivo,
       m.nome as master
from vendite v
cross join soglia s
cross join da_ignorare g
left join coupon c on lower(c.codice) = v.codice
left join master m on m.id = c.master_id
where v.codice is not null
  and v.data_ordine::date >= s.dal
  and not (v.codice like any (g.modelli))
  and not exists (select 1 from v_punti_master_righe r where r.vendita_id = v.id);

comment on view v_punti_codici_scoperti is
  'Le vendite fatte con un codice che NON ha prodotto punti per nessuno, dalla soglia in poi, con il motivo. Esclude i modelli in puntiMaster_codiciDaIgnorare. In condizioni normali resta vuota.';

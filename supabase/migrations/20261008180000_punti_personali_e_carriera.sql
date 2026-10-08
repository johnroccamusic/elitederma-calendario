-- I punti che una master fa comprando per se'.
--
-- Il suo codice di acquisto porta il suo master_id, quindi quello che
-- compra le veniva attribuito come una vendita qualunque: finiva nei
-- punti shop o nei punti cash, e quei punti maturano soldi. Comprare da
-- se' non e' vendere, e non deve pagare.
--
-- Da qui i punti sono tre:
--   punti_shop_pos / punti_cash  quello che ha venduto: fanno soldi
--   punti_personali              quello che ha comprato: non fanno soldi
--   punti_carriera               la somma dei tre, che e' quella che
--                                racconta quanto ha mosso in tutto
--
-- La vista grande (v_punti_master_righe) non si tocca: il riconoscimento
-- del codice sta qui, in una giunzione, e se un domani cambiasse il modo
-- di marcare quei codici si cambia un posto solo.
-- Le colonne nuove vanno in FONDO: una vista si puo' sostituire solo
-- aggiungendo in coda, non infilando una colonna in mezzo. Postgres
-- risponde "cannot change name of view column" e si ferma.
create or replace view v_punti_master as
with ultimo as (
  select master_id, max(scaricato_fino_a) as fino_a
    from punti_master_scarichi group by master_id
),
codici_acquisto as (
  select lower(c.codice) as codice from coupon c where c.serie_regole = 'acquisto_master'
)
select m.id as master_id,
       m.nome as master,
       round(coalesce(sum(r.punti) filter (where not r.e_cash and ca.codice is null), 0::numeric), 2) as punti_shop_pos,
       round(coalesce(sum(r.punti) filter (where r.e_cash and ca.codice is null), 0::numeric), 2) as punti_cash,
       round(coalesce(sum(r.punti), 0::numeric), 2) as punti_totali,
       count(distinct r.vendita_id) as vendite,
       round(coalesce(sum(r.quantita), 0::numeric), 0) as pezzi,
       max(r.data_ordine)::date as ultima_vendita,
       u.fino_a as scaricati_fino_a,
       round(coalesce(sum(r.punti) filter (where ca.codice is not null), 0::numeric), 2) as punti_personali,
       round(coalesce(sum(r.punti), 0::numeric), 2) as punti_carriera
  from master m
  left join ultimo u on u.master_id = m.id
  left join v_punti_master_righe r on r.master_id = m.id and (u.fino_a is null or r.data_ordine > u.fino_a)
  left join codici_acquisto ca on ca.codice = r.codice_coupon
 group by m.id, m.nome, u.fino_a;

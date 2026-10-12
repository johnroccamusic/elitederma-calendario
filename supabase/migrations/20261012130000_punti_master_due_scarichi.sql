-- DUE TAGLI, NON UNO.
-- Lo scarico era uno solo e azzerava tutto, carriera compresa. Ma la
-- carriera e' quanto una master ha mosso da quando c'e': pagarle i punti
-- del periodo non cancella quello che ha fatto.
--
--   'periodici' = i punti da pagare: shop/POS, cash, eventi, personali.
--   'carriera'  = il totale di sempre. Si azzera solo di proposito.
--
-- Applicata il 12/10/2026, con zero scarichi gia' scritti.
alter table punti_master_scarichi
  add column if not exists tipo text not null default 'periodici';
alter table punti_master_scarichi
  drop constraint if exists punti_master_scarichi_tipo_valido;
alter table punti_master_scarichi
  add constraint punti_master_scarichi_tipo_valido check (tipo in ('periodici', 'carriera'));

-- La vista legge due tagli invece di uno. Le colonne restano nello
-- stesso ordine — create or replace sa solo aggiungere in fondo — e in
-- fondo ne nasce una: scaricati_carriera_fino_a.
create or replace view v_punti_master as
with tagli as (
  select master_id,
         max(scaricato_fino_a) filter (where tipo = 'periodici') as fino_a,
         max(scaricato_fino_a) filter (where tipo = 'carriera')  as fino_a_carriera
    from punti_master_scarichi
   group by master_id
), codici_acquisto as (
  select lower(c.codice) as codice from coupon c where c.serie_regole = 'acquisto_master'
), vendite_distinte as (
  select distinct r.master_id, r.vendita_id, r.totale_vendita, r.data_ordine
    from v_punti_master_righe r
), valore as (
  select vd.master_id, sum(vd.totale_vendita) as venduto
    from vendite_distinte vd
    left join tagli u2 on u2.master_id = vd.master_id
   where u2.fino_a is null or vd.data_ordine > u2.fino_a
   group by vd.master_id
), carriera as (
  select m.id as master_id, round(coalesce(sum(r.punti), 0), 2) as punti
    from master m
    left join tagli t on t.master_id = m.id
    left join v_punti_master_righe r
      on r.master_id = m.id and (t.fino_a_carriera is null or r.data_ordine > t.fino_a_carriera)
   group by m.id
)
select m.id as master_id,
       m.nome as master,
       round(coalesce(sum(r.punti) filter (where not r.e_cash and ca.codice is null and not r.e_evento), 0), 2) as punti_shop_pos,
       round(coalesce(sum(r.punti) filter (where r.e_cash and ca.codice is null and not r.e_evento), 0), 2) as punti_cash,
       round(coalesce(sum(r.punti), 0), 2) as punti_totali,
       count(distinct r.vendita_id) as vendite,
       round(coalesce(sum(r.quantita), 0), 0) as pezzi,
       max(r.data_ordine)::date as ultima_vendita,
       u.fino_a as scaricati_fino_a,
       round(coalesce(sum(r.punti) filter (where ca.codice is not null), 0), 2) as punti_personali,
       coalesce(max(cr.punti), 0) as punti_carriera,
       round(coalesce(sum(r.punti) filter (where not r.e_cash and ca.codice is null and r.e_evento), 0), 2) as punti_evento_pos,
       round(coalesce(sum(r.punti) filter (where r.e_cash and ca.codice is null and r.e_evento), 0), 2) as punti_evento_cash,
       round(coalesce(max(v.venduto), 0), 2) as valore_venduto,
       u.fino_a_carriera as scaricati_carriera_fino_a
  from master m
  left join tagli u on u.master_id = m.id
  left join valore v on v.master_id = m.id
  left join carriera cr on cr.master_id = m.id
  left join v_punti_master_righe r on r.master_id = m.id and (u.fino_a is null or r.data_ordine > u.fino_a)
  left join codici_acquisto ca on ca.codice = r.codice_coupon
 group by m.id, m.nome, u.fino_a, u.fino_a_carriera;

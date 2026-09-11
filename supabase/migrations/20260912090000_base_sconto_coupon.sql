-- Una percentuale di sconto puo' voler dire due cose, e finora ne diceva
-- una sola senza chiederlo a nessuno.
--
-- "15%" sul PREZZO e' quindici euro ogni cento incassati: e' come ha
-- sempre funzionato, ed e' quello che WooCommerce sa fare da solo.
-- "15%" sul MARGINE e' quindici euro ogni cento guadagnati: su un
-- articolo che rende 22,70 sono 3,41, su uno che rende 1,20 diciotto
-- centesimi. Sconta cio' che si guadagna invece di cio' che si incassa,
-- e un codice generoso non puo' mai mangiare piu' di una fetta decisa
-- del guadagno, qualunque cosa finisca nel carrello.
--
-- La scelta sta sul singolo coupon e sul template dei referral
-- automatici. Il valore di partenza e' 'prezzo': tutti i coupon che
-- esistono oggi continuano a comportarsi esattamente come ieri.
alter table public.coupon
  add column if not exists base_sconto text not null default 'prezzo';

alter table public.regole_referral_automatico
  add column if not exists base_sconto text not null default 'prezzo';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coupon_base_sconto_valida') then
    alter table public.coupon
      add constraint coupon_base_sconto_valida check (base_sconto in ('prezzo', 'margine'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'regole_referral_base_sconto_valida') then
    alter table public.regole_referral_automatico
      add constraint regole_referral_base_sconto_valida check (base_sconto in ('prezzo', 'margine'));
  end if;
end $$;

comment on column public.coupon.base_sconto is
  'Su cosa si legge la percentuale: ''prezzo'' (sul prezzo al pubblico, come WooCommerce) oppure ''margine'' (sul guadagno del singolo prodotto, calcolato riga per riga; un prodotto senza costo di acquisto non si sconta).';
comment on column public.regole_referral_automatico.base_sconto is
  'Base di default per i referral generati in automatico. Vedi coupon.base_sconto.';

-- WooCommerce sa fare una cosa sola: una percentuale sul prezzo al
-- pubblico. Quando la base scelta e' il netto o il margine, sul sito si
-- scrive una percentuale DIVERSA, calcolata perche' tolga gli stessi
-- euro che toglierebbe il POS. Sul netto la conversione e' esatta (basta
-- dividere per l'aliquota); sul margine e' la migliore possibile, perche'
-- il margine cambia da prodotto a prodotto e una percentuale sola non
-- puo' seguirlo riga per riga.
alter table public.coupon
  add column if not exists valore_woo numeric;

comment on column public.coupon.valore_woo is
  'La percentuale realmente scritta su WooCommerce. Coincide con "valore" quando base_sconto = lordo; per netto e margine è la percentuale sul lordo che sconta gli stessi euro. Nulla = usa "valore".';

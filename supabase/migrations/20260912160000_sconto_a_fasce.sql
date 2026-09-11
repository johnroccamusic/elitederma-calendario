-- Lo sconto a fasce: una percentuale diversa a seconda di quanto rende
-- il prodotto.
--
-- Lo sconto "sul margine" gia' faceva una cosa simile, ma con una regola
-- di tre: chi rende molto sconta molto, chi rende poco sconta poco, in
-- proporzione esatta. A fasce si decide a mano, fascia per fascia — sui
-- prodotti che rendono meno del 25% si puo' scegliere di non scontare
-- niente, e su quelli oltre il 75% di essere generosi.
--
-- Le quattro fasce sono fisse: 0-25, 26-50, 51-75, 76-100 per cento di
-- margine. La percentuale di ciascuna si applica sempre SUL LORDO, cosi'
-- e' lo stesso numero che vale al POS e sul sito.
--
-- Un prodotto senza costo di acquisto non ha margine noto, non cade in
-- nessuna fascia e non si sconta: e' la stessa regola dello sconto sul
-- margine.
alter table public.coupon
  add column if not exists tipo_regola_sconto text not null default 'semplice',
  add column if not exists fasce_sconto jsonb;

alter table public.regole_referral_automatico
  add column if not exists tipo_regola_sconto text not null default 'semplice',
  add column if not exists fasce_sconto jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coupon_tipo_regola_sconto_valida') then
    alter table public.coupon
      add constraint coupon_tipo_regola_sconto_valida check (tipo_regola_sconto in ('semplice', 'fasce'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'regole_referral_tipo_regola_valida') then
    alter table public.regole_referral_automatico
      add constraint regole_referral_tipo_regola_valida check (tipo_regola_sconto in ('semplice', 'fasce'));
  end if;
end $$;

comment on column public.coupon.tipo_regola_sconto is
  'semplice = una percentuale sola, letta secondo base_sconto. fasce = una percentuale diversa per fascia di margine, sempre sul lordo (vedi fasce_sconto).';
comment on column public.coupon.fasce_sconto is
  'Solo con tipo_regola_sconto = fasce: [{da, a, percentuale}] sulle quattro fasce di margine. Sconto sul lordo della riga. Senza costo di acquisto il prodotto non rientra in nessuna fascia e non si sconta.';

-- Punti della raccolta legati al singolo referral code: "quanti punti
-- ogni quanti euro venduti con QUESTO codice". Quando sono nulli vale la
-- regola generale della raccolta (punti_master_regola_base): qui si
-- scrive solo l'eccezione.
alter table coupon add column if not exists punti_valore numeric;
alter table coupon add column if not exists punti_ogni_euro numeric;

comment on column coupon.punti_valore is 'Punti riconosciuti alla master ogni "punti_ogni_euro" euro venduti con questo codice. Nullo = vale la regola generale.';
comment on column coupon.punti_ogni_euro is 'Euro di vendita che generano "punti_valore" punti. Nullo = vale la regola generale.';

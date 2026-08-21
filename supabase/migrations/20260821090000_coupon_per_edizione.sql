-- I coupon referral automatici erano legati alla sola master, per sempre
-- (un codice unico riusato su ogni suo corso, passato e futuro). Da oggi
-- ogni edizione di corso (corsi_date) ha il proprio coupon dedicato.

alter table coupon add column if not exists corsi_date_id uuid references corsi_date(id);

create unique index if not exists coupon_corsi_date_id_uniq
  on coupon (corsi_date_id) where corsi_date_id is not null;

-- Backfill dell'unico coupon già esistente (EC59N5, Elia Cito), collegato
-- alla corsi_date che lo ha generato stamattina (master_id + data_fine
-- corrispondente a valido_fino_a meno i giorni di validità configurati).
update coupon set corsi_date_id = '3f5807e2-5192-40fa-a9f0-de88ffe01dc0'
  where codice = 'ec59n5' and corsi_date_id is null;

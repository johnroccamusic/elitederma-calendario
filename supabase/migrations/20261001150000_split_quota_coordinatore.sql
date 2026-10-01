-- Lo split bonifico/cash della riga "Quota coordinatore" nei costi della
-- classe. Due colonne proprie, come le ha la quota venditore
-- (quota_venditore_bonifico/cash) e la commissione modelle: senza, la riga
-- userebbe quota_bonifico/quota_cash, che sono gia' del compenso master, e
-- i due split si sovrascriverebbero a vicenda.
alter table corsi_date add column if not exists quota_coordinatore_bonifico numeric;
alter table corsi_date add column if not exists quota_coordinatore_cash numeric;

comment on column corsi_date.quota_coordinatore_bonifico is
  'Parte a bonifico della quota coordinatore della classe (01/10/2026).';
comment on column corsi_date.quota_coordinatore_cash is
  'Parte in contanti della quota coordinatore della classe (01/10/2026).';

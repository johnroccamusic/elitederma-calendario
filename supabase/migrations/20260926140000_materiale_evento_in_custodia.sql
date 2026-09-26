-- Il materiale che va a un evento non esce dal magazzino.
--
-- E' la differenza con i corsi, ed e' una regola dettata: il kit di un
-- corso si consegna all'allieva e non torna, quindi si scarica; quello
-- che va a una fiera resta roba nostra, solo in un altro posto — come
-- se un pezzo di magazzino fosse preso in consegna dall'evento. Scende
-- solo quando lo si vende davvero, col POS, sul posto.
--
-- Quindi qui non si tocca "prodotti_shop.quantita": si tiene il conto
-- di quanto e' partito e quanto e' tornato. La differenza e' quello che
-- e' rimasto la', e deve tornare uguale a quello che il POS ha venduto
-- all'evento.
alter table eventi_materiali
  add column if not exists quantita_portata numeric,
  add column if not exists quantita_rientrata numeric;

comment on column eventi_materiali.quantita_portata is
  'Quanto e'' partito davvero. NON scarica il magazzino: il materiale e'' in consegna all''evento, resta nostro.';
comment on column eventi_materiali.quantita_rientrata is
  'Quanto e'' tornato indietro. portata - rientrata = quello che e'' rimasto li'', che deve coincidere col venduto al POS.';

alter table vendite_shop
  add column if not exists evento_id uuid references eventi(id) on delete set null;

create index if not exists vendite_shop_evento on vendite_shop (evento_id) where evento_id is not null;

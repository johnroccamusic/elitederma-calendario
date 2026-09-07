-- "Restano da pagare" sottraeva al pattuito l'IMPONIBILE delle quote gia'
-- incassate. Su un corso il cui prezzo e' gia' lordo questo fa risultare un
-- residuo che non esiste: 300 euro pattuiti, 100 incassati con IVA, e la
-- scheda dice che ne mancano 218 invece di 200.
--
-- Non e' una regola da cambiare per tutti: dove il pattuito e' netto il
-- conto di prima e' quello giusto. Quindi e' il corso a dirlo, e non il
-- programma a indovinarlo dal nome — un corso rinominato non deve
-- cambiare di nascosto il modo in cui si contano i soldi.
--
-- Acceso oggi sul solo corso HENNE (non su HENNE INDIVI).
alter table public.corsi
  add column if not exists saldo_su_totale_pagato boolean not null default false;

comment on column public.corsi.saldo_su_totale_pagato is
  'Se vero, "Restano da pagare" sottrae il TOTALE incassato delle quote pagate invece del solo imponibile. Serve ai corsi il cui prezzo pattuito è già lordo.';

update public.corsi set saldo_su_totale_pagato = true where nome = 'HENNE';

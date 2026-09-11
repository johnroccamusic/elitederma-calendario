-- Un amministratore che vende dal proprio telefono per aiutare la master
-- del corso: la vendita deve poter contare per LEI — punti, provvigione,
-- riconoscimento — perche' e' lei che l'ha fatta davvero, non chi teneva
-- in mano il telefono.
--
-- L'attribuzione passa dai campi operatore_*, che sono quelli che punti e
-- provvigioni gia' leggono: scriverci la master significa non dover
-- toccare nessuno di quei conti. Ma allora si perderebbe chi ha battuto
-- la vendita, e su un incasso non e' un dettaglio: queste tre colonne lo
-- conservano.
--
-- Nulle = la vendita l'ha fatta chi risulta operatore, come sempre.
alter table public.vendite_shop
  add column if not exists registrata_da_tipo text,
  add column if not exists registrata_da_id uuid,
  add column if not exists registrata_da_nome text;

comment on column public.vendite_shop.registrata_da_nome is
  'Chi ha materialmente battuto la vendita, quando questa è stata attribuita a qualcun altro. Nullo = l''ha fatta chi risulta operatore.';

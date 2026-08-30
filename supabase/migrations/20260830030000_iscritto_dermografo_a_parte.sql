-- Il dermografo comprato a parte dall'allievo: quale modello, come lo
-- paga e — se lo paga insieme al corso — il conto di quella vendita.
--
-- Il modello continua a stare in iscritti.dermografo (già usato da
-- Advisor e logistica): qui si aggiunge solo il contorno commerciale.
-- Prezzo di listino e sconto si salvano come fotografia del momento: il
-- listino di magazzino cambia, quello che l'allievo ha pattuito no.
alter table public.iscritti
  add column if not exists dermografo_pagamento text,
  add column if not exists dermografo_prezzo_listino numeric,
  add column if not exists dermografo_sconto numeric,
  add column if not exists dermografo_imponibile numeric,
  add column if not exists dermografo_totale numeric,
  add column if not exists dermografo_metodo text,
  add column if not exists dermografo_pagato boolean not null default false;

comment on column public.iscritti.dermografo_pagamento is
  'gia_pagato | con_corso — come l''allievo salda il dermografo comprato a parte.';

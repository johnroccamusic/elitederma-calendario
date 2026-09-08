-- Due cose che mancavano al setting dei loghi.
--
-- La spaziatura del codice progressivo: il font ha le lettere attaccate e
-- non c'era modo di distanziarle. E' in pixel dell'immagine sorgente, come
-- la dimensione del font, e si converte in proporzione quando passa da
-- un'immagine all'altra.
--
-- "Calibrazione propria": normalmente i loghi hanno lo stesso impianto,
-- quindi quello che si regola su uno vale per tutti — dieci categorie da
-- calibrare a mano una per una sono dieci occasioni di sbagliare. Le
-- categorie con questo flag restano fuori: si regolano da sole e nessun
-- altro le tocca.
alter table public.loghi_categorie
  add column if not exists nero_numero_spaziatura numeric not null default 0,
  add column if not exists bianco_numero_spaziatura numeric not null default 0,
  add column if not exists calibrazione_propria boolean not null default false;

comment on column public.loghi_categorie.nero_numero_spaziatura is
  'Spazio in più fra un carattere e l''altro del codice progressivo, in pixel dell''immagine sorgente.';
comment on column public.loghi_categorie.calibrazione_propria is
  'Se vero questa categoria non segue la calibrazione comune: si regola da sola e non viene toccata dalle altre.';

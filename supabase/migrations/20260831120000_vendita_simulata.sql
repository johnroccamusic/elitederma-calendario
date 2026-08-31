-- ---------------------------------------------------------
-- Vendite di prova.
--
-- Il POS e' l'unica parte dell'app che non si puo' provare senza fare
-- danni: ogni prova e' un incasso in piu' nei conti e un pezzo in meno in
-- magazzino (e sul sito, per i prodotti pubblicati). Fino a ieri per
-- disfare una prova bisognava rimettere a mano le giacenze, su due sistemi.
--
-- Da qui una vendita puo' nascere dichiarata "di prova": non scarica
-- niente, non entra in nessun totale, e si cancella senza lasciare traccia.
-- Il flag lo puo' accendere solo chi programma, e la spunta sta solo nel
-- suo POS: per tutti gli altri non esiste, quindi non c'e' il rischio che
-- una vendita vera venga registrata come prova per sbaglio.
--
-- Il flag sta su entrambe le tabelle perche' la spedizione si legge da
-- sola in Logistica, senza passare dalla vendita che l'ha generata.
-- ---------------------------------------------------------

alter table public.vendite_shop
  add column if not exists simulazione boolean not null default false;

alter table public.spedizioni_pos
  add column if not exists simulazione boolean not null default false;

comment on column public.vendite_shop.simulazione is
  'vendita di prova fatta in modalita simulazione: nessun incasso, nessuno scarico, cancellabile senza traccia';
comment on column public.spedizioni_pos.simulazione is
  'spedizione nata da una vendita di prova';

create index if not exists idx_vendite_shop_simulazione
  on public.vendite_shop (simulazione) where simulazione;

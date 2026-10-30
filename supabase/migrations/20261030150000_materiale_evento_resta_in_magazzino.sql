-- Il materiale di un evento RESTA in magazzino (30/10/2026, deciso dal titolare).
--
-- "I prodotti impegnati negli eventi non devono essere scalati: e' come se
-- si spostasse una parte del magazzino all'evento. Verranno scalati solo
-- una volta venduti." Quindi: quello che e' in elenco per una fiera resta
-- in giacenza, resta impegnato finche' l'evento e' in programma (nessun
-- altro lo promette, l'Advisor lo conta), e scende solo quando il POS lo
-- vende sul posto — ed e' la vendita che scarica, come sempre.
--
-- Dal 08/10 al 30/10 la regola era l'opposta: "Partito" scaricava e
-- "Rimetti in magazzino" ricaricava (20261008200000_eventi_materiali_scarico).
-- Le colonne quantita_scaricata / quantita_ricaricata restano come storico
-- di quel periodo e non si scrivono piu'. Il giorno del cambio nessuna
-- riga le aveva diverse da zero: niente da rimettere in pari.
--
-- Al rientro non si scrive piu' un numero: si CONTA. La riga dice "venduti
-- all'evento N, ne riporti in magazzino M" e chi scarica lo scatolone
-- spunta che e' cosi'. E' una verifica sulle quantita', non un movimento.
alter table public.eventi_materiali
  add column if not exists rientro_verificato_il timestamptz;

comment on column public.eventi_materiali.rientro_verificato_il is
  'Quando qualcuno ha contato il rientro e confermato che ne sono tornati partiti - venduti - omaggiati. Solo verifica: il magazzino non si muove.';
comment on column public.eventi_materiali.quantita_portata is
  'Quanto e'' partito davvero. NON scarica il magazzino: il materiale e'' in consegna all''evento, resta nostro, scende solo quando il POS lo vende.';
comment on column public.eventi_materiali.quantita_rientrata is
  'Storico (26/09-30/10/2026): il numero scritto a mano al rientro. Non si scrive piu'', al suo posto c''e'' rientro_verificato_il.';
comment on column public.eventi_materiali.quantita_scaricata is
  'Storico (08/10-30/10/2026): pezzi tolti dalle giacenze quando "Partito" scaricava. Non si scrive piu''.';
comment on column public.eventi_materiali.quantita_ricaricata is
  'Storico (08/10-30/10/2026): pezzi rimessi in magazzino da "Rimetti in magazzino". Non si scrive piu''.';

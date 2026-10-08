-- Il materiale di un evento esce dal magazzino.
--
-- Fino a oggi quello che partiva per una fiera restava nelle giacenze:
-- "roba nostra, solo in un altro posto". Comodo da dire, ma al banco
-- quei pezzi non c'erano piu' e il magazzino continuava a prometterli —
-- ai corsi, allo shop, al POS. Da qui in avanti il giro e' quello vero:
-- si segna quanto parte, parte davvero, e quello che torna rientra.
--
-- Due coppie di colonne, non una. Serve sapere non solo quanti pezzi
-- sono partiti (quantita_portata, che chi organizza puo' correggere a
-- mano quante volte vuole) ma quanti ne sono USCITI DAVVERO dalle
-- giacenze: senza questa seconda cifra, premere "Partito" due volte
-- scaricherebbe due volte, e correggere il numero dopo lo scarico non
-- avrebbe modo di rimettere in pari la differenza. Lo stesso vale al
-- rientro.
alter table public.eventi_materiali
  add column if not exists quantita_scaricata numeric not null default 0,
  add column if not exists scaricato_il timestamptz,
  add column if not exists quantita_ricaricata numeric not null default 0,
  add column if not exists ricaricato_il timestamptz;

comment on column public.eventi_materiali.quantita_scaricata is
  'Pezzi davvero tolti dalle giacenze per questo evento. Il delta da muovere e'' sempre quantita_portata - quantita_scaricata.';
comment on column public.eventi_materiali.quantita_ricaricata is
  'Pezzi davvero rimessi in magazzino al rientro. Il delta da muovere e'' sempre quantita_rientrata - quantita_ricaricata.';

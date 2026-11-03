-- La lista dei clienti registrati ha il cestino e la matita (3/11/2026,
-- chiesti dal titolare). La correzione lascia scritto chi e quando: una
-- riga che cambia senza dire chi l'ha cambiata e' una riga di cui non si
-- puo' chiedere conto a nessuno. La cancellazione no: quella porta via
-- la riga, e chi la preme lo fa dopo una conferma col nome davanti.
alter table public.clienti_registrati
  add column if not exists modificato_il timestamptz,
  add column if not exists modificato_da text;

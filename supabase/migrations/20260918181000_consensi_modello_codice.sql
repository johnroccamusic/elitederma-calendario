-- Ogni consenso ha il suo codice, e il suo codice e' quello che la
-- modella inquadra.
--
-- Il primo si chiama "PMU e Micro". Poi verranno laminazione, extension
-- e gli altri: sono moduli diversi, con testi diversi, e ognuno ha il
-- suo QR. Qui resta scritto DA QUALE codice e' arrivata la firma —
-- senza, fra un anno una riga direbbe "consenso firmato" senza dire a
-- cosa.
alter table consensi_modelle add column if not exists modello_codice text;
create index if not exists idx_consensi_modelle_modello on consensi_modelle (modello_codice);

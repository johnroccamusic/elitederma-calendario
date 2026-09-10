-- I due segni verticali che tengono la firma della master dentro una
-- larghezza decisa.
--
-- Il nome dell'allievo li aveva gia' (nome_limite_sx/dx): si trascinano
-- sull'anteprima e, se il testo li supera, il carattere si rimpicciolisce
-- in stampa invece di uscire dal diploma. La firma no, e con una master
-- che si chiama "Maria Antonietta Della Valle" finiva sopra la cornice.
--
-- La firma pero' non ha una posizione orizzontale sua: si scrive al CENTRO
-- fra i due limiti. Un punto di ancoraggio e due limiti sono tre numeri per
-- dire una cosa che se ne fa dire due, e prima o poi si contraddicono.
alter table public.font_diplomi
  add column if not exists firma_limite_sx numeric not null default 25,
  add column if not exists firma_limite_dx numeric not null default 75;

comment on column public.font_diplomi.firma_limite_sx is
  'Bordo sinistro entro cui sta la firma, in percentuale della larghezza del diploma. La firma si scrive centrata fra questo e firma_limite_dx, e il carattere si riduce se non ci sta.';
comment on column public.font_diplomi.firma_limite_dx is
  'Bordo destro entro cui sta la firma, in percentuale della larghezza del diploma.';

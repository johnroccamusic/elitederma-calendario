-- La percentuale di commissione sui corsi, decisa corso per corso.
--
-- La commissione si calcola sul totale pattuito di ogni iscrizione, come
-- faceva la quota coordinatore allo 0,25% fisso. La differenza e' che la
-- percentuale non e' piu' una sola per tutti: la si stabilisce in
-- Impostazioni, e ogni corso puo' avere la sua — un PMU Base e una
-- Laminazione non valgono lo stesso lavoro.
--
-- NULL non vuol dire zero: vuol dire "usa quella generale", la casella in
-- Definizione provvigioni. Cosi' si compila solo dove serve una deroga,
-- invece di dover riempire ventotto righe perche' una commissione esista.
alter table corsi add column if not exists percentuale_commissione numeric;

comment on column corsi.percentuale_commissione is
  'Percentuale di commissione sul totale pattuito per questo corso. NULL = vale la percentuale generale in Definizione provvigioni (01/10/2026).';

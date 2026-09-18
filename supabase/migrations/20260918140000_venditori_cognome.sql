-- Il cognome del venditore, in una colonna sua.
--
-- Non si aggiunge al nome: venditori.nome e' un aggancio vivo, non
-- un'etichetta. Gli iscritti sono collegati al loro venditore
-- confrontando iscritti.tutor con venditori.nome, e gli acconti da
-- verificare allo stesso modo — su OLGA sono 61 iscritti e 19 acconti,
-- su KATIA 50 e 10. Scrivere "OLGA ROSSI" dentro il nome scollegherebbe
-- tutto in silenzio: le iscrizioni sparirebbero dalla sua scheda e le
-- provvigioni con loro.
--
-- Colonna nuova nullable: chi non la compila resta identico a prima.
alter table venditori add column if not exists cognome text;
comment on column venditori.cognome is
  'Cognome del venditore. Il nome resta com''e'' perche'' e'' la chiave con cui iscritti.tutor e acconti_da_verificare.venditore_nome lo trovano: il cognome serve a leggerlo per esteso, non a identificarlo.';

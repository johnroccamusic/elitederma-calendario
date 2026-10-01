-- Quota coordinatore: l'1% del totale pattuito di un'iscrizione.
--
-- Affianca `quota_venditore` (7%, minimo 50 euro, arrotondata ai 5 euro
-- superiori) e segue la stessa strada: si calcola dal totale pattuito e si
-- scrive qui al salvataggio della scheda, invece di essere ricalcolata a
-- ogni lettura. La ragione e' la stessa — se domani la percentuale cambia,
-- le iscrizioni gia' fatte devono continuare a dire la cifra pattuita
-- allora, non quella di oggi.
--
-- Nessun default e nessun backfill: sulle iscrizioni gia' esistenti resta
-- NULL, che vuol dire "non prevista", ed e' diverso da zero. Si riempie
-- da sola la prima volta che si risalva la scheda.
alter table iscritti add column if not exists quota_coordinatore numeric;

comment on column iscritti.quota_coordinatore is
  'Quota del coordinatore: 1% del totale pattuito, congelata al salvataggio della scheda (01/10/2026).';

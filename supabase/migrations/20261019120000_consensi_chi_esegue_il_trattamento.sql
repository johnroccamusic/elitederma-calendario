-- CHI ESEGUE IL TRATTAMENTO, scritto sul consenso.
--
-- Sul modulo cartaceo del microneedling ci sono tre righe vuote in cui
-- si scrive a mano il nome di chi opera: «incarico ______ di eseguire su
-- di me», «a regola d'arte da parte di ______», «dell'attività svolta da
-- ______». Trasportando il testo nell'app quelle righe erano diventate
-- una formula generica — «ELITEDERMA e l'allieva sotto supervisione» —
-- e il nome spariva.
--
-- Non e' un dettaglio di forma: quel documento serve a dire chi ha
-- fatto cosa su quella persona, e un consenso che non nomina
-- l'esecutrice risponde a meta' della domanda per cui esiste.
--
-- La colonna nasce libera (nessun NOT NULL): i consensi gia' raccolti
-- non ce l'hanno e non si inventa. Quali modelli la chiedano lo decide
-- il modello stesso, in `src/content/`.
alter table public.consensi_modelle
  add column if not exists esecutore text;

comment on column public.consensi_modelle.esecutore is
  'Nome di chi esegue il trattamento, scritto sul consenso. Sul cartaceo erano le righe vuote da riempire a mano.';

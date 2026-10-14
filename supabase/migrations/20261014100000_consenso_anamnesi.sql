-- L'ANAMNESI DEL CONSENSO MODELLA.
--
-- Venti domande chiuse sullo stato di salute, dalla v2 del consenso
-- (14/10/2026). Prima c'era solo `note_salute`, un riquadro di testo
-- libero: chi compilava di fretta lo lasciava vuoto, e l'operatore si
-- trovava davanti una modella senza sapere se fosse in gravidanza o
-- prendesse anticoagulanti.
--
-- UNA COLONNA JSONB, non venti colonne. Le domande sono versionate col
-- testo del consenso: la v3 potra' averne ventidue o diciotto, e ogni
-- consenso deve restare leggibile con le domande che aveva davanti chi
-- l'ha firmato. Venti colonne booleane avrebbero significato una
-- migrazione a ogni ritocco del modulo, e colonne morte per sempre.
--
-- La forma: { "<chiave>": { "r": true|false, "s": "<specifica>" } }
-- dove `chiave` e' quella di `anamnesi` in consenso-v2.ts.
--
-- `note_salute` resta: non e' sparito, e' diventato il campo "altro da
-- segnalare" accanto alle domande. I consensi v1 lo portano da soli.
alter table consensi_modelle
  add column if not exists anamnesi jsonb;

comment on column consensi_modelle.anamnesi is
  'Risposte al questionario sullo stato di salute, nella forma {chiave: {r: bool, s: testo}}. Le chiavi sono quelle di anamnesi nel file del consenso della versione indicata da versione_testo. Dato sanitario: categoria particolare ai sensi dell''art. 9 GDPR.';

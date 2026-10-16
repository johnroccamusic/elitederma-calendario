-- LA RESIDENZA PER INTERO SULLA SCHEDA DELL'ALLIEVA.
--
-- C'erano gia' `indirizzo_residenza`, `cap_residenza`, `citta_residenza`
-- ed `email`, ma arrivavano solo dall'importazione del modulo del sito:
-- nella scheda che compila il venditore non c'era dove scriverli. Da
-- oggi il blocco e' completo e si compila a mano, perche' e' lo stesso
-- blocco che andra' sul modulo mandato all'allieva.
--
-- Mancavano quattro pezzi: il civico separato dalla via (serve alle
-- spedizioni), l'interno, la provincia e lo stato.
alter table public.iscritti
  add column if not exists civico_residenza text,
  add column if not exists interno_residenza text,
  add column if not exists prov_residenza text,
  add column if not exists stato_residenza text;

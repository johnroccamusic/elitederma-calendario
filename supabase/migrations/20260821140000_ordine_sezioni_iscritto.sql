-- Ordine (e spazio fra) le tre card di "Modifica iscritto" (Anagrafica,
-- Dati contabili, Dati organizzativi), regolabile trascinando col mouse
-- solo da ruoloUtente "programmatore", salvato per tutti — stessa riga
-- singola già usata per gli spazi verticali della card del titolo corso.
alter table impostazioni_layout_iscrizioni
  add column if not exists ordine_sezioni jsonb;

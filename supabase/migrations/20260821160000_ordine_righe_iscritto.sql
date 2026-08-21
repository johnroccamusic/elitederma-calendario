-- Ordine (e spazio fra) le singole righe di campi dentro ciascuna delle
-- tre sezioni di "Modifica iscritto" (Anagrafica, Dati contabili, Dati
-- organizzativi) — un livello più fine del riordino di sezione già
-- aggiunto. Stessa riga singola già usata per gli spazi/l'ordine di
-- sezione, solo con più chiavi.
alter table impostazioni_layout_iscrizioni
  add column if not exists ordine_righe jsonb;

-- 17/10/2026 — RLS sulle tre tabelle di scarto rimaste aperte.
--
-- Sono i tre tavoli di backup nati dalle pulizie di ottobre: i movimenti
-- di banca scartati come doppioni del conto BPL, gli acconti pagati salvati
-- prima della migrazione jsonb, e i doppioni del primo giro di Lunch Flow.
-- Erano le uniche tre tabelle di public senza RLS, quindi leggibili e
-- scrivibili da chiunque avesse la chiave pubblicabile del bundle — e
-- dentro ci sono movimenti bancari e acconti di allievi.
--
-- Nessuna policy, di proposito: non le usa niente. Verificato il 17/10/2026
-- su tutto il repo (le nominano solo le due migrazioni che le hanno create)
-- e sul database (nessuna vista, funzione o foreign key dipende da loro).
-- Restano leggibili da service_role, che ignora la RLS: il contenuto non si
-- perde e il giorno in cui servisse basta una policy per rimetterle in piedi.
alter table public.movimenti_banca_scartati_20261006 enable row level security;
alter table public._backup_acconti_pagati_20261011 enable row level security;
alter table public._backup_lunchflow_doppioni_20261013 enable row level security;

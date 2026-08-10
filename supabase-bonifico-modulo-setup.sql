-- Verifica pagamenti: quando nel modulo di iscrizione il venditore sceglie
-- "Bonifico" come metodo di una quota (acconto, un acconto aggiuntivo,
-- quota pre corso, un pre corso aggiuntivo o il saldo), il caricamento del
-- file del bonifico è obbligatorio e viene segnalato in automatico in
-- "Verifica Pagamenti" (origine 'bonifico_modulo', etichetta "Verifica
-- bonifico"). Il percorso del file resta anche sull'iscritto stesso, per
-- ritrovarlo dalla scheda senza dover tornare nella coda di verifica.
-- Gli acconti/pre corso aggiuntivi (righe jsonb in acconto_extra/
-- precorso_extra) non hanno bisogno di una colonna: usano semplicemente
-- una chiave "bonifico_file" dentro ogni riga, già supportata dal jsonb.
alter table public.iscritti add column if not exists acconto_bonifico_file text;
alter table public.iscritti add column if not exists precorso_bonifico_file text;
alter table public.iscritti add column if not exists saldo_bonifico_file text;

notify pgrst, 'reload schema';

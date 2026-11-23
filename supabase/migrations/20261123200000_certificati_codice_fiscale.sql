-- IL CERTIFICATO NEEDLING (23/11/2026) ha una voce che il 42 ore non ha:
-- il codice fiscale dello studente. Si archivia accanto agli altri dati,
-- cosi' fra un anno si sa a chi e' stato rilasciato senza aprire il PDF.
-- Finche' questa colonna non c'e', l'app scrive la riga senza: il codice
-- resta comunque stampato nel PDF archiviato.
alter table certificati_generati add column if not exists codice_fiscale text;

-- ROLLBACK
-- alter table certificati_generati drop column if exists codice_fiscale;

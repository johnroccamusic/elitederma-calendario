-- ---------------------------------------------------------
-- Motore di match (spec-riconciliazione.md §6): il segnale "Fornitore"
-- vale 40/100 punti su P.IVA/CF identici, ma la tabella fornitori non
-- ha mai avuto questi due campi — creata solo con nome/iban/indirizzo.
-- Senza P.IVA/CF il segnale può solo scendere alla ragione sociale
-- simile (15 punti), e nessun documento raggiungerebbe mai la soglia
-- di preselezione automatica (90).
--
-- Additivo puro: due colonne nullable su una tabella esistente, nessun
-- default, nessun vincolo NOT NULL, nessuna riga esistente toccata.
-- Valorizzate da qui in avanti da fic-sync-documenti quando crea un
-- nuovo fornitore da un documento Fatture in Cloud; i fornitori già
-- esistenti restano con questi campi vuoti finché non vengono
-- aggiornati a mano o da un futuro arricchimento.
-- ---------------------------------------------------------

alter table public.fornitori
  add column if not exists partita_iva text,
  add column if not exists codice_fiscale text;

create index if not exists fornitori_partita_iva_idx on public.fornitori(partita_iva) where partita_iva is not null;

notify pgrst, 'reload schema';

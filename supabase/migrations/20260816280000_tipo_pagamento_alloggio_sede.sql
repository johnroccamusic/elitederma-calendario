-- ---------------------------------------------------------
-- "Bonifico Fattura" (spunta informativa, mai usata nei calcoli)
-- diventa "Tipo di pagamento": una tendina Bonifico/Cash su ogni riga
-- di Assegnazione Master (master principale, master extra, assistenti,
-- leve) che ha un alloggio assegnato. Il Riepilogo Amministrativo la
-- legge per scrivere il "Pattuito per periodo" di quella persona
-- interamente in Bonifico o in Cash — non più uno split libero.
--
-- Stessa cosa per la sede: nuova tendina "Pagamento sede" accanto a
-- "Sede OK?" (una per edizione, non per persona) che sceglie quale
-- tariffa giornaliera della location usare (costo_giornaliero_cash o
-- costo_giornaliero_bonifico) e in quale colonna scrivere il risultato
-- nel Riepilogo.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists tipo_pagamento_alloggio text;
alter table public.corsi_date add column if not exists pagamento_sede text;
alter table public.corsi_date drop column if exists richiesta_fattura;

alter table public.corsi_date_docenti add column if not exists tipo_pagamento_alloggio text;
alter table public.corsi_date_docenti drop column if exists richiesta_fattura;

-- "Costo location" non è più uno split libero (era location_bonifico/
-- location_cash, immessi a mano): ora è sempre calcolato da
-- costo_giornaliero_* × giorni in base a "Pagamento sede", quindi le due
-- colonne non servono più.
alter table public.corsi_date drop column if exists location_bonifico;
alter table public.corsi_date drop column if exists location_cash;

notify pgrst, 'reload schema';

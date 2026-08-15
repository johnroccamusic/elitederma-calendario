-- ---------------------------------------------------------
-- "Assistenze" in Gestione Leve/Assistenti: il numero mostrato è
-- edizioni reali (da corsi_date leva_ids/assistente_ids, contate a
-- runtime) + questa correzione manuale, per le assistenze fatte prima
-- che il calendario attuale esistesse (nessuna data reale collegata).
-- I pulsanti +/- incrementano/decrementano questo numero di 1 alla
-- volta, mai sotto zero.
-- ---------------------------------------------------------
alter table public.leva add column if not exists assistenze_extra integer not null default 0;
alter table public.assistente add column if not exists assistenze_extra integer not null default 0;

notify pgrst, 'reload schema';

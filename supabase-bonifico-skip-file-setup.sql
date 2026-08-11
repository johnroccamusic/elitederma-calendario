-- ---------------------------------------------------------
-- Scheda allievo: scegliendo Bonifico come metodo di una quota già segnata
-- "Pagato" è richiesto il file del bonifico. Solo un amministratore
-- (Contabilità classe sbloccata) vede la casella "Ora non ho il file" per
-- saltare la richiesta e caricarlo più tardi — quota acconto e quota pre
-- corso; gli acconti/pre corso aggiuntivi usano una chiave "bonifico_skip"
-- dentro ogni riga jsonb.
-- ---------------------------------------------------------
alter table public.iscritti add column if not exists acconto_bonifico_skip boolean not null default false;
alter table public.iscritti add column if not exists precorso_bonifico_skip boolean not null default false;

notify pgrst, 'reload schema';

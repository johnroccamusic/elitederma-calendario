-- Verifica pagamenti: il file del bonifico nel modulo di iscrizione ora si
-- può caricare anche mentre la quota è ancora "Da pagare" (facoltativo, non
-- blocca il salvataggio). La segnalazione a Elena in "Verifica Pagamenti"
-- scatta solo quando la quota diventa "Pagato" e ha già un file allegato —
-- non nel momento in cui si carica il file. "bonifico_segnalato" ricorda se
-- è già scattata, per non segnalarla una seconda volta ai salvataggi
-- successivi. Gli acconti/pre corso aggiuntivi usano una chiave
-- "bonifico_segnalato" dentro ogni riga jsonb, senza bisogno di colonne.
alter table public.iscritti add column if not exists acconto_bonifico_segnalato boolean not null default false;
alter table public.iscritti add column if not exists precorso_bonifico_segnalato boolean not null default false;

notify pgrst, 'reload schema';

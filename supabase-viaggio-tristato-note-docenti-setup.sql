-- ---------------------------------------------------------
-- Assegnazione Master: il pallino di viaggio diventa a tre stati
-- (si/no/non_occorre — verde/rosso/grigio, il grigio per chi non deve
-- viaggiare) invece del semplice booleano prenotato/non prenotato.
-- Backfill dal booleano esistente, idempotente (tocca solo le righe
-- ancora al valore di default 'no', non sovrascrive modifiche manuali
-- già fatte dopo l'aggiunta della colonna).
--
-- Le righe extra di tipo master/assistente (non le leve) guadagnano
-- anche Note e Note viaggio proprie, come sulla riga principale.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists viaggio_stato text not null default 'no' check (viaggio_stato in ('si', 'no', 'non_occorre'));
update public.corsi_date set viaggio_stato = case when viaggio_prenotato then 'si' else 'no' end where viaggio_stato = 'no';

alter table public.corsi_date_docenti add column if not exists viaggio_stato text not null default 'no' check (viaggio_stato in ('si', 'no', 'non_occorre'));
update public.corsi_date_docenti set viaggio_stato = case when viaggio_prenotato then 'si' else 'no' end where viaggio_stato = 'no';

alter table public.corsi_date_docenti add column if not exists note text;
alter table public.corsi_date_docenti add column if not exists note_viaggio text;

notify pgrst, 'reload schema';

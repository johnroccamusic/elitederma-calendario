-- ---------------------------------------------------------
-- Assegnazione Master: dopo Alloggio, dettagli della prenotazione per
-- ogni persona (master principale e righe extra master/assistente/
-- leva) — richiesta fattura, notti prenotate, importo pattuito a
-- notte e per l'intero periodo, pagato.
-- ---------------------------------------------------------
alter table public.corsi_date add column if not exists richiesta_fattura boolean not null default false;
alter table public.corsi_date add column if not exists notti_prenotate integer;
alter table public.corsi_date add column if not exists pattuito_a_notte numeric;
alter table public.corsi_date add column if not exists pattuito_periodo numeric;
alter table public.corsi_date add column if not exists pagato boolean not null default false;

alter table public.corsi_date_docenti add column if not exists richiesta_fattura boolean not null default false;
alter table public.corsi_date_docenti add column if not exists notti_prenotate integer;
alter table public.corsi_date_docenti add column if not exists pattuito_a_notte numeric;
alter table public.corsi_date_docenti add column if not exists pattuito_periodo numeric;
alter table public.corsi_date_docenti add column if not exists pagato boolean not null default false;

notify pgrst, 'reload schema';

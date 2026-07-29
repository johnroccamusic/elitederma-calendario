-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Aggiunta campi per "Assegnazione Master"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

alter table public.corsi_date add column if not exists sede_confermata boolean not null default false;
alter table public.corsi_date add column if not exists note text;
alter table public.corsi_date add column if not exists assistente_id uuid references public.assistente(id) on delete set null;
alter table public.corsi_date add column if not exists leva_id uuid references public.leva(id) on delete set null;
alter table public.corsi_date add column if not exists alloggio_id uuid references public.hotel(id) on delete set null;
alter table public.corsi_date add column if not exists viaggio_prenotato boolean not null default false;
alter table public.corsi_date add column if not exists viaggio_file text[];
alter table public.corsi_date add column if not exists note_viaggio text;

notify pgrst, 'reload schema';

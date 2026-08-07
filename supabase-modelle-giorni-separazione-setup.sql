-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Separa turno/trattamento di Modella del
-- Master e Modella Allievi nel template dei giorni (corsi_giorni)
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte.
-- =========================================================

-- "tipo_modella" era condiviso tra Master e Allievi: rinominato in
-- tipo_modella_master (mantiene i valori già inseriti) e aggiunto un
-- tipo_modella_allievi separato, così i due possono avere trattamenti
-- diversi nello stesso giorno
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'corsi_giorni' and column_name = 'tipo_modella'
  ) then
    alter table public.corsi_giorni rename column tipo_modella to tipo_modella_master;
  end if;
end $$;

alter table public.corsi_giorni add column if not exists tipo_modella_master text;
alter table public.corsi_giorni add column if not exists mattina_allievi boolean not null default false;
alter table public.corsi_giorni add column if not exists pomeriggio_allievi boolean not null default false;
alter table public.corsi_giorni add column if not exists tipo_modella_allievi text;

notify pgrst, 'reload schema';

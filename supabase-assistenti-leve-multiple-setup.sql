-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Più assistenti e più leve per data
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

-- nuove colonne "elenco" (array), al posto del singolo assistente_id/leva_id
alter table public.corsi_date add column if not exists assistente_ids uuid[] not null default '{}';
alter table public.corsi_date add column if not exists leva_ids uuid[] not null default '{}';

-- porta negli elenchi quello che era già assegnato con il vecchio campo singolo
update public.corsi_date set assistente_ids = array[assistente_id]
  where assistente_id is not null and assistente_ids = '{}';
update public.corsi_date set leva_ids = array[leva_id]
  where leva_id is not null and leva_ids = '{}';

-- i vecchi campi assistente_id/leva_id restano nel database (per sicurezza,
-- non li cancelliamo) ma l'app da ora usa solo assistente_ids/leva_ids

notify pgrst, 'reload schema';

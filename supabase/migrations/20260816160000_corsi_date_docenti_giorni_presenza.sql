-- ---------------------------------------------------------
-- Riepilogo amministrativo: quota assistenti. Il compenso di
-- un'assistente (assistente_corsi.compenso_giornaliero, per
-- assistente+corso, già esistente) si intende giornaliero — di
-- default vale per tutti i giorni del corso, ma su una singola
-- edizione l'assistente potrebbe non esserci stata tutti i giorni.
-- giorni_presenza (nullable: null = usa la durata intera del corso)
-- registra l'eventuale scostamento, per quella specifica edizione.
-- ---------------------------------------------------------
alter table public.corsi_date_docenti add column if not exists giorni_presenza integer;

notify pgrst, 'reload schema';

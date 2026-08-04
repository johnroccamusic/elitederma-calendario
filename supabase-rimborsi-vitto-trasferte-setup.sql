-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Rimborsi standard in "Riepilogo amministrativo"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- 3 nuovi campi standard del "Riepilogo amministrativo" (Contabilità
-- classe), in detrazione dal cash totale del corso come gli altri
-- costi fissi della classe (costo_master, costo_hotel, ecc.)
alter table public.corsi_date add column if not exists rimborso_cene_colazioni numeric;
alter table public.corsi_date add column if not exists rimborso_taxi numeric;
alter table public.corsi_date add column if not exists rimborso_parcheggi numeric;

-- la categoria "Vitto" di "Costi operativi" non ha più una voce
-- manuale "Vitto insegnanti e personale" (diventata "Vitto Docenti e
-- personale al corso", automatica dal Riepilogo amministrativo): le
-- eventuali voci già inserite a mano vengono spostate sul contenitore
-- residuale della stessa categoria, così restano visibili
update public.costi_operativi_voci
set sottovoce = 'altre_spese_vitto'
where categoria = 'vitto' and sottovoce = 'vitto_personale';

notify pgrst, 'reload schema';

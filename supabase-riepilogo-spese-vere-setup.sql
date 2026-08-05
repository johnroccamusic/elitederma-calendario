-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - "Riepilogo amministrativo": spese vere
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- Sicura da rieseguire più volte: ogni INSERT controlla prima se la
-- spesa per quella classe+sotto-categoria esiste già.
-- =========================================================

-- I 10 costi fissi del pannello "Riepilogo amministrativo" (Costo
-- Master, Costo pranzi, Rimborso cene...) finora vivevano solo come
-- numeri nudi in colonne dedicate di corsi_date. Ora ogni casella apre
-- il form "Nuova spesa" completo (fornitore, metodo di pagamento,
-- allegato...): il valore diventa una spesa vera in "spese", collegata
-- alla classe (tipo_ambito='classe'), così compare anche nel drill-down
-- di "Analisi costi di gestione". Le colonne di corsi_date NON vengono
-- toccate né cancellate (restano come archivio storico): questo script
-- si limita a copiarne il valore, una sola volta, dentro "spese".

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'personale_accademia', 'personale_accademia__costo_coordinatore', 'classe', cd.id, cd.costo_coordinatore, 0, cd.costo_coordinatore, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_coordinatore is not null and cd.costo_coordinatore <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'personale_accademia__costo_coordinatore');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'docenti_corsi', 'docenti_corsi__compensi_master', 'classe', cd.id, cd.costo_master, 0, cd.costo_master, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_master is not null and cd.costo_master <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'docenti_corsi__compensi_master');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'docenti_corsi', 'docenti_corsi__compensi_assistenti', 'classe', cd.id, cd.costo_assistenti, 0, cd.costo_assistenti, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_assistenti is not null and cd.costo_assistenti <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'docenti_corsi__compensi_assistenti');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'vitto_corsi', 'vitto_corsi__costo_pranzi', 'classe', cd.id, cd.costo_pranzi, 0, cd.costo_pranzi, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_pranzi is not null and cd.costo_pranzi <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'vitto_corsi__costo_pranzi');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'vitto_corsi', 'vitto_corsi__rimborso_cene', 'classe', cd.id, cd.rimborso_cene, 0, cd.rimborso_cene, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_cene is not null and cd.rimborso_cene <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'vitto_corsi__rimborso_cene');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'vitto_corsi', 'vitto_corsi__rimborso_colazioni', 'classe', cd.id, cd.rimborso_colazioni_spesa, 0, cd.rimborso_colazioni_spesa, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_colazioni_spesa is not null and cd.rimborso_colazioni_spesa <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'vitto_corsi__rimborso_colazioni');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'alloggi_corsi', 'alloggi_corsi__hotel', 'classe', cd.id, cd.costo_hotel, 0, cd.costo_hotel, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_hotel is not null and cd.costo_hotel <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'alloggi_corsi__hotel');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'viaggi_corsi', 'viaggi_corsi__taxi_trasporti_locali', 'classe', cd.id, cd.rimborso_taxi, 0, cd.rimborso_taxi, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_taxi is not null and cd.rimborso_taxi <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'viaggi_corsi__taxi_trasporti_locali');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'viaggi_corsi', 'viaggi_corsi__rimborso_parcheggi', 'classe', cd.id, cd.rimborso_parcheggi, 0, cd.rimborso_parcheggi, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.rimborso_parcheggi is not null and cd.rimborso_parcheggi <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'viaggi_corsi__rimborso_parcheggi');

insert into public.spese (categoria_id, sottocategoria_id, tipo_ambito, classe_id, imponibile, iva_percentuale, totale, data_documento, data_pagamento, origine, stato, includi_analisi_costi)
select 'affitto_aule_esterne', 'affitto_aule_esterne__quota_accademia', 'classe', cd.id, cd.costo_accademia, 0, cd.costo_accademia, cd.data_inizio, cd.data_inizio, 'manuale', 'pagata', true
from public.corsi_date cd
where cd.costo_accademia is not null and cd.costo_accademia <> 0
  and not exists (select 1 from public.spese s where s.classe_id = cd.id and s.sottocategoria_id = 'affitto_aule_esterne__quota_accademia');

-- campo_automatico non serve più (i valori ora sono spese vere, non
-- sintetizzate da corsi_date): lo svuoto per chiarezza, "automatico"
-- resta true così queste sotto-voci restano escluse dal "+" generico
-- (si aggiungono solo dalla casella dedicata nel Riepilogo amministrativo)
update public.costi_sottocategorie set campo_automatico = null where campo_automatico is not null;

notify pgrst, 'reload schema';

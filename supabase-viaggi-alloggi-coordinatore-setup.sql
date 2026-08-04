-- =========================================================
-- ELITEDERMA CALENDARIO CORSI - Costo viaggi/alloggi, Costo coordinatore, Stampe
-- Incolla TUTTO questo file nell'SQL Editor di Supabase e premi RUN.
-- =========================================================

-- nuovi campi standard del "Riepilogo amministrativo": Costo
-- coordinatore, e lo split di "Rimborso cene e colazioni" nei due
-- campi distinti "Rimborso cene" e "Rimborso colazioni e spesa"
alter table public.corsi_date add column if not exists costo_coordinatore numeric;
alter table public.corsi_date add column if not exists rimborso_cene numeric;
alter table public.corsi_date add column if not exists rimborso_colazioni_spesa numeric;

-- migra il vecchio campo unico sul nuovo "Rimborso cene", poi lo rimuove
update public.corsi_date set rimborso_cene = rimborso_cene_colazioni where rimborso_cene_colazioni is not null;
alter table public.corsi_date drop column if exists rimborso_cene_colazioni;

-- "Trasferte" si divide in due categorie: "Costo viaggi" (viaggio
-- master, autostrada e carburante, trasporti extra) e "Costo alloggi"
-- (alloggio — hotel, case e appartamenti). Le eventuali voci già
-- inserite a mano vengono spostate sulla categoria giusta
update public.costi_operativi_voci
set categoria = 'alloggi'
where categoria = 'trasferte' and sottovoce = 'alloggio';

update public.costi_operativi_voci
set categoria = 'viaggi'
where categoria = 'trasferte' and sottovoce in ('viaggio_master', 'autostrada_carburante', 'trasporti_extra');

update public.costi_operativi_voci
set categoria = 'viaggi', sottovoce = 'altre_spese_viaggi'
where categoria = 'trasferte' and sottovoce = 'altre_spese_trasferte';

-- le eventuali voci extra del Riepilogo amministrativo (corsi_date.costi_extra,
-- jsonb) taggate alla vecchia categoria "trasferte" confluiscono di
-- default su "Costo viaggi" (la più generale delle due nuove categorie);
-- se qualcuna riguardava in realtà un alloggio va ritaggata a mano
update public.corsi_date
set costi_extra = (
  select jsonb_agg(
    case when elem->>'categoria' = 'trasferte' then jsonb_set(elem, '{categoria}', '"viaggi"') else elem end
  )
  from jsonb_array_elements(costi_extra) elem
)
where costi_extra @> '[{"categoria": "trasferte"}]';

notify pgrst, 'reload schema';

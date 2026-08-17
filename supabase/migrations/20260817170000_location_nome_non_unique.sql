-- ---------------------------------------------------------
-- "Aggiungi location" falliva su una seconda sede nella stessa città
-- (es. due sedi a Roma): "nome" (la città) aveva un vincolo unique
-- pensato quando ogni città aveva una sola sede. Ora che una città può
-- avere più sedi (distinte per "nome_sede"), il vincolo va tolto — i
-- calendari continuano comunque a raggruppare per città (il nome), non
-- per singola sede.
-- ---------------------------------------------------------
alter table public.location drop constraint if exists location_nome_key;

notify pgrst, 'reload schema';

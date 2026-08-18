-- ---------------------------------------------------------
-- Classificazione gestionale + Budget e controllo anche su hotel: lo
-- stesso blocco già aggiunto a location, master e assistente (sezione
-- 114), inizialmente escluso da hotel su richiesta esplicita e ora
-- richiesto anche qui, con le stesse funzioni (pannello a tendina,
-- flag "applica a tutti").
-- ---------------------------------------------------------
alter table public.hotel add column if not exists diretto_indiretto text;
alter table public.hotel add column if not exists fisso_variabile text;
alter table public.hotel add column if not exists ricorrente_occasionale text;
alter table public.hotel add column if not exists natura text default 'operativo';
alter table public.hotel add column if not exists controllabilita text;
alter table public.hotel add column if not exists riducibilita text;
alter table public.hotel add column if not exists essenzialita text;
alter table public.hotel add column if not exists origine text default 'manuale';
alter table public.hotel add column if not exists ricorrenza text default 'nessuna';
alter table public.hotel add column if not exists bene_durevole boolean not null default false;
alter table public.hotel add column if not exists includi_analisi_costi boolean not null default true;
alter table public.hotel add column if not exists budget_previsto numeric;
alter table public.hotel add column if not exists soglia_allerta_personalizzata numeric;
alter table public.hotel add column if not exists responsabile_costo text;

notify pgrst, 'reload schema';

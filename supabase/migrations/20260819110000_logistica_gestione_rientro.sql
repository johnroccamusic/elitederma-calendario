alter table public.logistica_kit_edizioni
  add column if not exists gestione_rientro_attiva boolean not null default false,
  add column if not exists fase_rientro text;

notify pgrst, 'reload schema';

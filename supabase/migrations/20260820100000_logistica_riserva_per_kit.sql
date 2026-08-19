alter table public.logistica_kit_edizioni
  add column if not exists riserva_per_kit jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';

alter table public.location add column if not exists fornitore_id uuid references public.fornitori(id) on delete set null;
alter table public.hotel add column if not exists fornitore_id uuid references public.fornitori(id) on delete set null;

notify pgrst, 'reload schema';

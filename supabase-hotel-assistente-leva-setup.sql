-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Aggiunta tabelle "Hotel",
-- "Assistente" e "Leva"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

create table public.hotel (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.hotel enable row level security;
create policy "accesso interno hotel" on public.hotel for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.hotel to anon, authenticated;

create table public.assistente (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.assistente enable row level security;
create policy "accesso interno assistente" on public.assistente for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.assistente to anon, authenticated;

create table public.leva (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);
alter table public.leva enable row level security;
create policy "accesso interno leva" on public.leva for all to anon using (true) with check (true);
grant select, insert, update, delete, truncate, references, trigger on table public.leva to anon, authenticated;

notify pgrst, 'reload schema';

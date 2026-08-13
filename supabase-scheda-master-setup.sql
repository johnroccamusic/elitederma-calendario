-- ---------------------------------------------------------
-- Scheda Master: profilo dettagliato di ogni master — foto (per ora
-- resta vuota, un omino generico la sostituisce nell'interfaccia finché
-- non si caricano le foto vere), email/telefono, note libere, contratto
-- allegato, e i corsi a cui è associata con la propria fascia di
-- compenso per numero di allievi (es. 1-2 allievi: 300€, 3-5: 350€,
-- 6+: 400€).
--
-- master_corsi: un corso può essere associato a più master e viceversa
-- (unique sulla coppia, non sulla singola colonna). fasce_compenso è un
-- array libero [{da, a, compenso}] — "a" null vuol dire "in su, senza
-- limite" (l'ultima fascia, es. "oltre i 6 allievi").
-- ---------------------------------------------------------
alter table public.master add column if not exists foto_url text;
alter table public.master add column if not exists note text;
alter table public.master add column if not exists contratto_file_path text;
alter table public.master add column if not exists email text;
alter table public.master add column if not exists telefono text;

create table if not exists public.master_corsi (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.master(id) on delete cascade,
  corso_id uuid not null references public.corsi(id) on delete cascade,
  fasce_compenso jsonb not null default '[]',
  ts timestamptz not null default now(),
  unique (master_id, corso_id)
);
alter table public.master_corsi enable row level security;
drop policy if exists "accesso interno master_corsi" on public.master_corsi;
create policy "accesso interno master_corsi" on public.master_corsi for all to anon using (true) with check (true);
create index if not exists master_corsi_master_idx on public.master_corsi (master_id);

insert into storage.buckets (id, name, public) values ('master-documenti', 'master-documenti', true) on conflict (id) do nothing;
drop policy if exists "accesso interno master-documenti" on storage.objects;
create policy "accesso interno master-documenti" on storage.objects for all to anon
  using (bucket_id = 'master-documenti') with check (bucket_id = 'master-documenti');

insert into storage.buckets (id, name, public) values ('master-foto', 'master-foto', true) on conflict (id) do nothing;
drop policy if exists "accesso interno master-foto" on storage.objects;
create policy "accesso interno master-foto" on storage.objects for all to anon
  using (bucket_id = 'master-foto') with check (bucket_id = 'master-foto');

notify pgrst, 'reload schema';

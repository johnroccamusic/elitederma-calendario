-- Applicata via MCP il 02/10/2026.
create table if not exists stampe_packaging (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  foto_path text, file_path text, file_nome text,
  ordine integer not null default 0,
  creato_il timestamptz not null default now()
);
create table if not exists stampe_packaging_righe (
  id uuid primary key default gen_random_uuid(),
  stampa_id uuid not null references stampe_packaging(id) on delete cascade,
  etichetta text not null default '',
  valore text not null default '',
  ordine numeric not null default 0
);
create index if not exists stampe_packaging_righe_idx on stampe_packaging_righe(stampa_id, ordine);
alter table stampe_packaging enable row level security;
alter table stampe_packaging_righe enable row level security;
drop policy if exists stampe_packaging_tutti on stampe_packaging;
create policy stampe_packaging_tutti on stampe_packaging for all to anon, authenticated using (true) with check (true);
drop policy if exists stampe_packaging_righe_tutti on stampe_packaging_righe;
create policy stampe_packaging_righe_tutti on stampe_packaging_righe for all to anon, authenticated using (true) with check (true);
insert into storage.buckets (id, name, public) values ('stampe-packaging','stampe-packaging',true) on conflict (id) do nothing;

-- Creare il secchio non basta: senza una policy su storage.objects ogni
-- caricamento torna 400. Me ne sono accorto solo provando a caricare un
-- file davvero, non guardando il codice.
drop policy if exists "accesso interno stampe-packaging" on storage.objects;
create policy "accesso interno stampe-packaging" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'stampe-packaging')
  with check (bucket_id = 'stampe-packaging');

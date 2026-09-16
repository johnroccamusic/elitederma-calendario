-- Analisi codici sconto: le sezioni (una per master, di solito: Tommaso,
-- Marianna, Martina...) e a quale sezione appartiene ogni codice.
-- Applicata via MCP il 16/09/2026.
create table if not exists codici_sezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  master_id uuid references master(id) on delete set null,
  creata_il timestamptz not null default now()
);
create table if not exists codici_sezione_assegnazioni (
  codice text primary key,
  sezione_id uuid not null references codici_sezioni(id) on delete cascade,
  assegnato_il timestamptz not null default now()
);
alter table codici_sezioni enable row level security;
alter table codici_sezione_assegnazioni enable row level security;
drop policy if exists "accesso interno codici_sezioni" on codici_sezioni;
create policy "accesso interno codici_sezioni" on codici_sezioni for all to anon, authenticated using (true) with check (true);
drop policy if exists "accesso interno codici_sezione_assegnazioni" on codici_sezione_assegnazioni;
create policy "accesso interno codici_sezione_assegnazioni" on codici_sezione_assegnazioni for all to anon, authenticated using (true) with check (true);

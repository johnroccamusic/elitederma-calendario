-- =========================================================
-- ELITEDERMA CALENDARIO CORSI — Aggiunta tabella "Master"
-- Incolla TUTTO questo file nell'SQL Editor di Supabase
-- e premi RUN. Da eseguire UNA SOLA VOLTA.
-- =========================================================

-- Master (nomi assegnabili a una specifica edizione/data di un corso)
create table public.master (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ts timestamptz not null default now()
);

alter table public.master enable row level security;
create policy "accesso interno master" on public.master for all to anon using (true) with check (true);

-- Ogni data/edizione può avere un master assegnato (facoltativo)
alter table public.corsi_date add column master_id uuid references public.master(id) on delete set null;

-- Agenda: ottava carta di ogni settimana (appunti liberi, non legati a
-- un giorno preciso). Una riga per settimana per agenda, upsert su
-- (agenda_id, settimana_inizio) così il testo resta legato alla
-- settimana anche dopo un refresh.
create table if not exists public.agenda_note_settimanali (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references public.agende(id) on delete cascade,
  settimana_inizio date not null,
  testo text,
  ts timestamptz not null default now(),
  unique (agenda_id, settimana_inizio)
);
alter table public.agenda_note_settimanali enable row level security;
drop policy if exists "agenda_note_settimanali_all" on public.agenda_note_settimanali;
create policy "agenda_note_settimanali_all" on public.agenda_note_settimanali for all to anon using (true) with check (true);

notify pgrst, 'reload schema';

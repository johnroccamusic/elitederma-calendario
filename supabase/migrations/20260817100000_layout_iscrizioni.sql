-- ---------------------------------------------------------
-- Maniglie trascinabili (stile "ridimensiona colonna" di Excel) per
-- regolare gli spazi verticali della scheda "Gestione Iscrizioni" —
-- visibili solo a ruoloUtente "programmatore". A differenza delle
-- larghezze colonna di Assegnazione Master (personali, per browser),
-- qui il risultato si applica a TUTTI: è la stessa card che vedono
-- tutti gli utenti, non una preferenza personale. Riga singola,
-- sempre lo stesso id fisso, stesso pattern di
-- impostazioni_layout_assegnazione_master.
-- ---------------------------------------------------------
create table if not exists public.impostazioni_layout_iscrizioni (
  id uuid primary key default gen_random_uuid(),
  spazi jsonb,
  ts timestamptz not null default now()
);
alter table public.impostazioni_layout_iscrizioni enable row level security;
drop policy if exists "accesso interno impostazioni_layout_iscrizioni" on public.impostazioni_layout_iscrizioni;
create policy "accesso interno impostazioni_layout_iscrizioni" on public.impostazioni_layout_iscrizioni for all to anon using (true) with check (true);

insert into public.impostazioni_layout_iscrizioni (id)
values ('00000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

notify pgrst, 'reload schema';

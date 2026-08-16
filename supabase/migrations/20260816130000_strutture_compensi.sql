-- ---------------------------------------------------------
-- Strutture compensi riutilizzabili: una struttura (nome + fasce
-- Da/a allievi → Compenso €) può essere collegata a più corsi.
-- Quando un corso collegato viene associato a un master (Gestione
-- Master → Corsi associati), le fasce della struttura vengono
-- copiate come punto di partenza — una copia una tantum, non un
-- collegamento live: modificarle dopo per un master non tocca la
-- struttura originale né gli altri master già associati.
-- ---------------------------------------------------------
create table if not exists public.strutture_compensi (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  fasce jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.strutture_compensi enable row level security;
drop policy if exists "accesso interno strutture_compensi" on public.strutture_compensi;
create policy "accesso interno strutture_compensi" on public.strutture_compensi for all to anon using (true) with check (true);

alter table public.corsi add column if not exists struttura_compensi_id uuid references public.strutture_compensi(id) on delete set null;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- Motore di match (spec-riconciliazione.md §6.5 "Apprendimento"): alla
-- prima conferma manuale di una riconciliazione si memorizza la coppia
-- fornitore → (categoria, origine_tipo). Ai match successivi dello
-- stesso fornitore il segnale "Categoria" (§6.1, 8 punti) attinge da
-- qui invece di restare sempre a 0 per i fornitori mai visti.
--
-- Una riga per fornitore (non uno storico): la preferenza è "l'ultima
-- scelta buona", non un log — un upsert su fornitore_id la aggiorna
-- ad ogni conferma successiva.
-- ---------------------------------------------------------

create table if not exists public.preferenze_match_fornitore (
  id uuid primary key default gen_random_uuid(),
  fornitore_id uuid not null unique references public.fornitori(id) on delete cascade,
  categoria_id text references public.costi_sottocategorie(id) on delete set null,
  origine_tipo text check (origine_tipo in ('corso', 'struttura', 'marketing', 'manuale')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preferenze_match_fornitore enable row level security;
drop policy if exists "accesso interno preferenze_match_fornitore" on public.preferenze_match_fornitore;
create policy "accesso interno preferenze_match_fornitore" on public.preferenze_match_fornitore for all to anon using (true) with check (true);

notify pgrst, 'reload schema';

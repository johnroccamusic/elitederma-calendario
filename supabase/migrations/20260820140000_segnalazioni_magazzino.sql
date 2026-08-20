-- Sezione 135: "Segnalazioni" (Inventario Master → Magazzini esterni)
-- ---------------------------------------------------------
-- La master, durante l'inventario di fine corso, può scrivere una
-- segnalazione libera sulla sede (es. "uno sgabello senza rotellina",
-- "un lettino è tagliato"). Ogni segnalazione appartiene alla sede del
-- corso da cui viene fatta (location_id, dedotto da corsi_date), e
-- compare nella scheda di quella sede in "Magazzini esterni", dove chi
-- gestisce il magazzino può scrivere una propria nota di risoluzione
-- (es. "spedita lampada sostitutiva").
--
-- Stessa policy "for all to anon using (true) with check (true)" di
-- tutte le altre tabelle: lo stato reale delle policy oggi è ancora
-- quello (vedi CLAUDE.md §4, verificato più volte — il passaggio ad
-- "authenticated" non è stato applicato), non è compito di questa
-- migrazione cambiarlo.

create table if not exists public.segnalazioni_magazzino (
  id uuid primary key default gen_random_uuid(),
  corso_data_id uuid references public.corsi_date(id),
  location_id uuid references public.location(id),
  master_id uuid references public.master(id),
  testo text not null,
  nota_risoluzione text,
  ts timestamptz not null default now()
);

alter table public.segnalazioni_magazzino enable row level security;

create policy segnalazioni_magazzino_all on public.segnalazioni_magazzino
  for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
